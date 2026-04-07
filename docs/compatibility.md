# Compatibility

| @clgplatform/mcp | @modelcontextprotocol/sdk | @clgplatform/sdk |
|------------------|---------------------------|------------------|
| 1.0.0-beta.1 | >=1.0.0 <2.0.0 | ^1.1.0 |

## Tool registration order

This wrapper uses only documented public APIs from MCP SDK. Because no public iterator is currently exposed for already-registered tools, interception is forward-only.

Use `withCLG()` before `registerTool()`, or register tools on the proxy returned from `withCLG()`.
