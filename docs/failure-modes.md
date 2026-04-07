# Failure modes

## closed (default)

When CLG decision evaluation fails (timeout/network/server error), tool execution is blocked and `CLGUnreachableError` is thrown.

Recommended for:

- regulated production workloads
- high-risk automations
- strict accountability requirements

## open

When CLG decision evaluation fails, tool execution continues. Wrapper attempts to submit an `tool-outcome-unverified` receipt best-effort.

Recommended for:

- low-risk internal workflows
- developer sandboxes
- temporary degraded operation with observability

## Scenarios

- CLG timeout + `closed`: tool is not executed.
- CLG timeout + `open`: tool executes; wrapper emits onError and tries unverified outcome receipt.
- Tool runtime error after approval: wrapper submits `tool-outcome-failed` and throws `CLGToolExecutionError`.
