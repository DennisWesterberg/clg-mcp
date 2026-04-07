// Copyright (c) 2026 Aistrateg Malmö AB. Licensed under BUSL-1.1.
import type { EvaluateDecisionResult, Receipt } from '@clgplatform/sdk';

export interface DecisionEnvelope {
  workflow_id: string;
  task_id: string;
  agent_id: string;
  mandate_ref: string;
  decision_type: string;
  decision_value: string;
  task_input: unknown;
  previous_receipt_hashes?: string[];
  timestamp: string;
}

export interface CLGConfig {
  apiKey: string;
  agentId: string;
  mandateRef: string;
  workflowId?: string;
  endpoint?: string;
  failureMode?: 'closed' | 'open';
  timeoutMs?: number;
  redact?: (input: unknown) => unknown;
  beforeSend?: (envelope: DecisionEnvelope) => DecisionEnvelope;
  onDecision?: (result: EvaluateDecisionResult) => void;
  onOutcome?: (receipt: Receipt) => void;
  onError?: (error: import('./errors.js').CLGError) => void;
}

export interface NormalizedCLGConfig {
  apiKey: string;
  agentId: string;
  mandateRef: string;
  workflowId: string;
  endpoint: string;
  failureMode: 'closed' | 'open';
  timeoutMs: number;
  redact?: (input: unknown) => unknown;
  beforeSend?: (envelope: DecisionEnvelope) => DecisionEnvelope;
  onDecision?: (result: EvaluateDecisionResult) => void;
  onOutcome?: (receipt: Receipt) => void;
  onError?: (error: import('./errors.js').CLGError) => void;
}
