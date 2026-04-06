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
export declare class CLGMCPWrapper {
    private sidecar;
    private config;
    constructor(config: CLGMCPConfig);
    /**
     * Evaluate a tool call against CLG mandates.
     * Returns { approved: true } or throws/rejects with { approved: false }.
     */
    evaluateTool(context: CLGMCToolContext, mandateRef?: string): Promise<CLGMCEvaluation>;
    /**
     * Guard a tool execution: evaluates, then runs the tool if approved.
     * Returns the tool result wrapped with receipt metadata.
     */
    guard<T>(context: CLGMCToolContext, toolFn: () => Promise<T>, mandateRef?: string): Promise<{
        result: T;
        receipt: Record<string, unknown>;
    }>;
}
export { CLGSidecar };
export type { EvaluateDecisionParams, EvaluateDecisionResult };
//# sourceMappingURL=index.d.ts.map