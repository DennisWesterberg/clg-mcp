import { CLGSidecar } from '@clgplatform/sdk';
import type { EvaluateDecisionParams, EvaluateDecisionResult } from '@clgplatform/sdk';

export type CLGMCPConfig = {
  apiUrl: string;
  apiKey: string;
  agentId: string;
  workflowId: string;
  timeoutMs?: number;
};

export type CLGMCToolContext = {
  toolName: string;
  toolInput: Record<string, unknown>;
  previousReceiptHashes?: string[];
};

export type CLGMCEvaluation = {
  approved: boolean;
  reason: string | null;
  receipt: Record<string, unknown>;
};

/**
 * CLG MCP Wrapper: wraps tool calls with CLG mandate evaluation.
 * Integrates CLG into MCP (Model Context Protocol) workflows.
 */
export class CLGMCPWrapper {
  private sidecar: CLGSidecar;
  private config: CLGMCPConfig;

  constructor(config: CLGMCPConfig) {
    this.config = config;
    this.sidecar = new CLGSidecar({
      apiUrl: config.apiUrl,
      apiKey: config.apiKey,
      mode: 'gateway',
      timeoutMs: config.timeoutMs ?? 5000,
    });
  }

  /**
   * Evaluate a tool call against CLG mandates.
   * Returns { approved: true } or throws/rejects with { approved: false }.
   */
  async evaluateTool(
    context: CLGMCToolContext,
    mandateRef: string = 'default'
  ): Promise<CLGMCEvaluation> {
    const params: EvaluateDecisionParams = {
      workflow_id: this.config.workflowId,
      task_id: `${this.config.workflowId}-${Date.now()}`,
      agent_id: this.config.agentId,
      mandate_ref: mandateRef,
      decision_type: 'tool-call',
      decision_value: context.toolName,
      task_input: {
        tool: context.toolName,
        input: context.toolInput,
      },
      previous_receipt_hashes: context.previousReceiptHashes,
      timestamp: new Date().toISOString(),
    };

    const result: EvaluateDecisionResult = await this.sidecar.evaluateDecision(params);

    return {
      approved: result.decision === 'approve',
      reason: result.reason,
      receipt: result.receipt,
    };
  }

  /**
   * Guard a tool execution: evaluates, then runs the tool if approved.
   * Returns the tool result wrapped with receipt metadata.
   */
  async guard<T>(
    context: CLGMCToolContext,
    toolFn: () => Promise<T>,
    mandateRef: string = 'default'
  ): Promise<{ result: T; receipt: Record<string, unknown> }> {
    const evaluation = await this.evaluateTool(context, mandateRef);

    if (!evaluation.approved) {
      const error = new Error(`Tool '${context.toolName}' denied by CLG: ${evaluation.reason ?? 'no reason'}`);
      (error as any).clgEvaluation = evaluation;
      throw error;
    }

    const result = await toolFn();
    return { result, receipt: evaluation.receipt };
  }
}

export { CLGSidecar };
export type { EvaluateDecisionParams, EvaluateDecisionResult };
