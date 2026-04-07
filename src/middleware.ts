// Copyright (c) 2026 Aistrateg Malmö AB. Licensed under BUSL-1.1.
import { randomUUID } from 'node:crypto';
import type {
  CLGSidecar,
  EvaluateDecisionParams,
  EvaluateDecisionResult,
  Receipt,
  ReceiptParams,
} from '@clgplatform/sdk';
import { CLGDeniedError, CLGToolExecutionError, CLGUnreachableError } from './errors.js';
import type { DecisionEnvelope, NormalizedCLGConfig } from './types.js';

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function maybeRedact(config: NormalizedCLGConfig, value: unknown): unknown {
  return config.redact ? config.redact(value) : value;
}

function makeEnvelope(
  toolName: string,
  toolInput: unknown,
  config: NormalizedCLGConfig,
): DecisionEnvelope {
  const base: DecisionEnvelope = {
    workflow_id: config.workflowId,
    task_id: randomUUID(),
    agent_id: config.agentId,
    mandate_ref: config.mandateRef,
    decision_type: 'tool-call',
    decision_value: toolName,
    task_input: maybeRedact(config, toolInput),
    timestamp: new Date().toISOString(),
  };

  return config.beforeSend ? config.beforeSend(base) : base;
}

async function createOutcomeReceipt(
  sidecar: CLGSidecar,
  config: NormalizedCLGConfig,
  params: ReceiptParams,
): Promise<Receipt> {
  const receipt = await sidecar.createReceipt(params);
  config.onOutcome?.(receipt);
  return receipt;
}

export function wrapToolHandler<TArgs extends unknown[], TResult>(
  sidecar: CLGSidecar,
  config: NormalizedCLGConfig,
  toolName: string,
  originalHandler: (...args: TArgs) => Promise<TResult> | TResult,
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    const firstArg = args[0];
    const envelope = makeEnvelope(toolName, firstArg, config);

    let decisionResult: EvaluateDecisionResult;
    try {
      decisionResult = await sidecar.evaluateDecision(envelope as EvaluateDecisionParams);
      config.onDecision?.(decisionResult);
    } catch (error) {
      const clgError = new CLGUnreachableError('CLG decision evaluation failed', error);
      config.onError?.(clgError);

      if (config.failureMode === 'closed') {
        throw clgError;
      }

      try {
        const result = await Promise.resolve(originalHandler(...args));
        try {
          await createOutcomeReceipt(sidecar, config, {
            workflow_id: config.workflowId,
            task_id: randomUUID(),
            agent_id: config.agentId,
            task_input: maybeRedact(config, firstArg),
            output: maybeRedact(config, result),
            decision_type: 'tool-outcome-unverified',
            decision_value: toolName,
          });
        } catch (receiptError) {
          config.onError?.(
            new CLGUnreachableError('Failed to submit unverified outcome receipt', receiptError),
          );
        }
        return result;
      } catch (toolError) {
        try {
          await createOutcomeReceipt(sidecar, config, {
            workflow_id: config.workflowId,
            task_id: randomUUID(),
            agent_id: config.agentId,
            task_input: maybeRedact(config, firstArg),
            output: maybeRedact(config, {
              status: 'failed',
              error_name: toolError instanceof Error ? toolError.name : 'Error',
              error_message: toolError instanceof Error ? toolError.message : String(toolError),
            }),
            decision_type: 'tool-outcome-unverified',
            decision_value: toolName,
          });
        } catch (receiptError) {
          config.onError?.(
            new CLGUnreachableError(
              'Failed to submit unverified failed outcome receipt',
              receiptError,
            ),
          );
        }
        throw toolError;
      }
    }

    if (decisionResult.decision === 'deny') {
      const receiptRecord = asRecord(decisionResult.receipt);
      const denied = new CLGDeniedError(
        `CLG denied tool call for ${toolName}`,
        typeof receiptRecord.receipt_id === 'string' ? receiptRecord.receipt_id : null,
        decisionResult.reason,
      );
      config.onError?.(denied);
      throw denied;
    }

    try {
      const result = await Promise.resolve(originalHandler(...args));
      const decisionReceipt = asRecord(decisionResult.receipt);
      const previous =
        typeof decisionReceipt.receipt_hash === 'string'
          ? [decisionReceipt.receipt_hash]
          : undefined;

      try {
        await createOutcomeReceipt(sidecar, config, {
          workflow_id: config.workflowId,
          task_id: randomUUID(),
          agent_id: config.agentId,
          task_input: maybeRedact(config, firstArg),
          output: maybeRedact(config, result),
          decision_type: 'tool-outcome',
          decision_value: toolName,
          previous_receipt_hashes: previous,
        });
      } catch (receiptError) {
        config.onError?.(
          new CLGUnreachableError(
            'Outcome receipt submission failed after successful tool execution. Tool result returned but not recorded in CLG chain.',
            receiptError,
          ),
        );
      }

      return result;
    } catch (toolError) {
      const decisionReceipt = asRecord(decisionResult.receipt);
      const previous =
        typeof decisionReceipt.receipt_hash === 'string'
          ? [decisionReceipt.receipt_hash]
          : undefined;

      try {
        await createOutcomeReceipt(sidecar, config, {
          workflow_id: config.workflowId,
          task_id: randomUUID(),
          agent_id: config.agentId,
          task_input: maybeRedact(config, firstArg),
          output: maybeRedact(config, {
            status: 'failed',
            error_name: toolError instanceof Error ? toolError.name : 'Error',
            error_message: toolError instanceof Error ? toolError.message : String(toolError),
          }),
          decision_type: 'tool-outcome-failed',
          decision_value: toolName,
          previous_receipt_hashes: previous,
        });
      } catch (receiptError) {
        config.onError?.(
          new CLGUnreachableError(
            'Failure outcome receipt submission failed after tool crash. Original tool error is being re-thrown.',
            receiptError,
          ),
        );
      }

      const wrapped = new CLGToolExecutionError(
        `Tool '${toolName}' failed after CLG approval`,
        toolName,
        toolError,
      );
      throw wrapped;
    }
  };
}
