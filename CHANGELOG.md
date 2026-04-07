# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.0.0-beta.1] - 2026-04-07

### Added

- Real MCP SDK integration via Proxy-based tool interception
- Real-time mandate evaluation via CLG /v1/decisions/evaluate
- Signed decision receipts for every tool call (approve and deny)
- Outcome receipts chained from decision receipts on success
- Failure outcome receipts on tool execution errors
- Unverified outcome receipts in fail-open mode
- redactPaths helper for masking sensitive fields
- Configurable redact and beforeSend hooks
- Complete error type hierarchy
- fail-closed and fail-open failure modes
- Full observability via onDecision, onOutcome, onError callbacks
- Business Source License 1.1

### Changed

- Complete rewrite from v0.1.0 prototype
- Package renamed from clg-mcp to @clgplatform/mcp
- License changed from MIT to BUSL-1.1

### Removed

- v0.1.0 CLGMCPWrapper class (migration guide in docs/migration.md if you actually used the prototype — you probably shouldn't have)
