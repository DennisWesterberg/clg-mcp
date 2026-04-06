# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-04-06

### Added
- Initial release of CLG MCP Wrapper
- `CLGMCPWrapper` class for integrating CLG mandate evaluation into MCP workflows
- `evaluateTool(context, mandateRef?)` method for evaluating tool calls
- `guard(context, toolFn, mandateRef?)` method for evaluation + execution pattern
- Dependency: `@clgplatform/sdk@^1.1.0`
- TypeScript support with ES2022/NodeNext
- Vitest test suite with 100% line coverage
