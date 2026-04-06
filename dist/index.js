import { CLGSidecar } from '@clgplatform/sdk';
/**
 * CLG MCP Wrapper: wraps tool calls with CLG mandate evaluation.
 * Integrates CLG into MCP (Model Context Protocol) workflows.
 */
export class CLGMCPWrapper {
    sidecar;
    config;
    constructor(config) {
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
    async evaluateTool(context, mandateRef = 'default') {
        const params = {
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
        const result = await this.sidecar.evaluateDecision(params);
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
    async guard(context, toolFn, mandateRef = 'default') {
        const evaluation = await this.evaluateTool(context, mandateRef);
        if (!evaluation.approved) {
            const error = new Error(`Tool '${context.toolName}' denied by CLG: ${evaluation.reason ?? 'no reason'}`);
            error.clgEvaluation = evaluation;
            throw error;
        }
        const result = await toolFn();
        return { result, receipt: evaluation.receipt };
    }
}
export { CLGSidecar };
//# sourceMappingURL=index.js.map