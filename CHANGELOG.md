# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2026-08-13

Hygiene, correctness of the type surface, and honest packaging. Builds on 0.3.4.
See `RELEASE_NOTES_0.4.0.md`.

### Changed (breaking)
- **Node 18 support dropped.** `engines` now requires Node `>=20` (18 and 20 are
  both EOL).
- **Removed the non-functional telemetry surface.** `createTelemetryProvider`,
  `ClaudeTelemetryProvider`, and `TelemetryUtils` are gone — the provider was a
  stub whose `getLogger()` threw "not fully implemented yet". Real observability
  is planned for the v1 rebuild on the official Agent SDK.
- **Removed the unreachable enhanced-error system** (`errors/enhanced.ts`) and
  the `isEnhancedError()` / `hasResolution()` guards, which could never match any
  error the SDK actually throws.
- The six options that the CLI doesn't support (`temperature`, `maxTokens`,
  `context`, `role`, `configFile`, `mcpServerPermissions`) are now marked
  `@deprecated`; they are still accepted and ignored with a one-time warning
  (from 0.3.4), and will be removed in v1.

### Fixed
- **`npm run typecheck` now passes.** The shipped source failed its own
  `tsc --noEmit` with 27 errors (config loader, roles manager, telemetry). The
  build is now gated on typecheck via `prepublishOnly`.
- **CJS TypeScript consumers no longer get TS1479.** The `exports` map now maps
  per-condition types (`./dist/index.d.cts` for `require`). Verified with
  `@arethetypeswrong/cli` (all green).
- Config `extends` chains are now validated (previously the inheritance path
  skipped validation entirely), and environment-variable expansion in config
  files is actually invoked (it was defined but never called).

### Added
- **Tests + CI.** A GitHub Actions workflow runs typecheck, lint, tests, and
  build on Node 20/22/24; a `package-lock.json` is committed; `prepublishOnly`
  gates releases.
- **Type fidelity.** `ToolName` is now an open union (accepts MCP tool names and
  scoped patterns); permission records are `Partial` (no more "must specify all
  16 tools"); `retryableErrors` accepts concrete error classes; `PermissionMode`
  includes `plan`/`auto`/`dontAsk`/`manual`; added `ThinkingBlock` and a named
  `Usage` type.

### Packaging
- `main` points at the CJS build; `sideEffects: false`; `examples/` and
  sourcemaps removed from the published tarball (933 kB → ~338 kB); optional
  peer dependency on `@anthropic-ai/claude-code` declared; `./package.json`
  export added; dead `.npmignore` and stale `RELEASE_NOTES_0.3.0.md` removed.
- Migrated lint to ESLint 9 flat config + typescript-eslint 8 (clears the
  previous 6 high `npm audit` findings, all dev-only). Runtime-dependency major
  bumps (execa 10, js-yaml 5, which 7) and vitest 4 are deferred to a follow-up.

## [0.3.4] - 2026-08-13

Correctness hotfix. No public API was removed; several long-broken options now
work or are safely ignored instead of aborting the query. See `RELEASE_NOTES_0.3.4.md`.

### Fixed
- **Host-process crash on early break / abort.** Breaking out of a `for await`
  query loop (or aborting mid-stream) could leave an unhandled subprocess
  rejection that terminated the host process under Node's default policy. The
  child's promise now always has a rejection handler, and the abort handler no
  longer rethrows inside an event listener (which became an `uncaughtException`).
- **`asResult()` always returned `''` and cost was always `0`.** The result
  message is now read from the CLI's real fields (`result`, `total_cost_usd`,
  `is_error`, `num_turns`), not the nonexistent `content` / `cost.total_cost_usd`.
- **Tool results were dropped.** The CLI delivers `tool_result` blocks inside
  `user` messages, which were discarded. They are now surfaced, so
  `asToolExecutions()`, `findToolResults()`, and `findToolResult()` work.
- **`succeeded()` reported success for failed queries.** It now honours the
  result subtype and `is_error`; `getErrors()` surfaces run-level failures and
  permission denials.
- **Options that emitted nonexistent CLI flags** (`temperature`, `maxTokens`,
  `context`, `role`, `configFile`, `mcpServerPermissions`) aborted the whole
  query with an opaque error. They are now warned about once and ignored.
- **`permissionMode: 'acceptEdits'` was a silent no-op.** It now maps to
  `--permission-mode acceptEdits` (as do `plan` / `auto` / `dontAsk`).
- **`systemPrompt` was dropped** (classic API) or prepended to the user prompt
  (fluent API). It is now sent via `--append-system-prompt`.
- **`withTimeout()` was a no-op.** The timeout is now enforced and throws
  `TimeoutError`.
- **Multiple `addDirectory()` paths** were joined into one invalid path; each is
  now passed as its own `--add-dir` token.
- **`--mcp-config` was serialized in a shape the CLI rejects** (an array). It is
  now the CLI's name-keyed object, written to a temp file (see Security).
- **`ResponseParser.stream()`** silently did nothing after the stream had been
  consumed; it now replays cached messages.
- **`allowTools()` with no arguments** denied *all* tools while claiming
  "read-only"; it now denies only mutating tools.
- Process failures now include the CLI's `stderr` in the `ProcessError` message
  instead of a bare "exited with code N".

### Security
- **MCP server `env` secrets no longer appear on the command line.** The MCP
  config is written to a `0600` temp file (readable only by the owner) rather
  than a world-readable `--mcp-config` argv element.
- **Argument-injection guard.** Option values (`model`, `sessionId`,
  `addDirectories`) that begin with `-` are rejected, so a value can no longer
  be reinterpreted by the CLI as a flag (e.g. injected
  `--dangerously-skip-permissions`).
- **Debug is namespaced.** The SDK reads `CLAUDE_SDK_DEBUG` and no longer treats
  the ubiquitous generic `DEBUG` as a signal to dump the command line and full
  stream traffic. `queryRaw()` no longer logs the full prompt or `options.env`.

### Added
- `pathToClaudeCodeExecutable` option to point at a specific `claude` binary
  (also enables the SDK's own integration tests).
- A real regression test suite (parser, argument building, and subprocess
  lifecycle via a mock CLI) — the first tests since the suite was removed at
  v0.3.0.

## [0.3.3] - 2025-06-27

### Fixed
- CLI output parsing adjustments and packaging/exports fixes
- Replaced a symlink in the published package

## [0.3.2] - 2025-06-27

### Fixed
- Configuration-file loading restoration and related fixes

## [0.3.1] - 2025-06-27

### Fixed
- Critical fix-release for exports and CLI output handling

## [0.3.0] - 2025-06-26

### Added
- **Safe Environment Variables**: Automatic loading of DEBUG, VERBOSE, LOG_LEVEL, and NODE_ENV from environment
- **Enhanced Error Handling**: Error categorization with user-friendly resolution hints
- **AbortSignal Support** (Beta): Cancel long-running queries with standard AbortSignal
- **Session Management** (Beta): Maintain conversation context across queries
- **Production Features**: Integration of retry logic, per-call permissions, and telemetry
- Comprehensive documentation for new features
- Environment variables safety guide with API key warnings

### Changed
- Error classes now include optional `category` and `resolution` properties
- Improved error messages with actionable hints
- Enhanced TypeScript type exports

### Security
- API keys are NOT automatically loaded from environment variables to prevent accidental billing
- Clear documentation about subscription billing implications

### Fixed
- Various TypeScript type improvements
- Export consistency for enhanced features

## [0.3.0-beta.2] - 2025-06-26

### Added
- AbortSignal support for query cancellation
- Repository cleanup and documentation improvements

### Fixed
- Test suite improvements
- Type export corrections

## [0.3.0-beta.1] - 2025-06-25

### Added
- Initial beta release with enhanced features
- Environment variable support
- Enhanced error handling framework

## [0.2.1] - 2025-06-22

### Added
- **YAML Configuration**: Support for YAML config files with auto-detection
- **MCP Server Permissions**: Configure permissions at the server level
- **Role-Based Access**: Define roles with specific permissions and templates
- **Configuration Loading**: Load external configs with `withConfigFile()` and `withRolesFile()`

### Improved
- YAML support for better config readability with comments
- Environment variable expansion in configurations
- Role inheritance for DRY configuration

## [0.2.0] - 2025-06-22

### Added
- **Fluent API**: New chainable API with `claude()` for improved developer experience
- **Response Parsers**: Built-in methods for extracting text, JSON, and tool results
- **Logging Framework**: Pluggable logging system with multiple implementations
- **Event Handlers**: `onMessage()`, `onAssistant()`, and `onToolUse()` callbacks
- **Usage Statistics**: Get token counts and cost information with `.getUsage()`

### Improved
- 100% backward compatible - existing code continues to work
- Comprehensive TypeScript support throughout
- New examples demonstrating fluent API patterns

## [0.1.4] - 2025-06-22

### Fixed
- Include examples in npm package

## [0.1.2] - 2025-06-22

### Fixed
- Fixed CLI command search to properly find `claude` command
- Removed unsupported authentication flags (CLI handles auth internally)
- Improved error messages for authentication failures
- Updated documentation to clarify authentication flow

## [0.1.1] - 2025-06-21

### Added
- Added `--print` flag for non-interactive mode

### Fixed
- Fixed CLI path resolution
- Initial TypeScript error fixes

## [0.1.0] - 2025-06-21

### Added
- Initial release
- TypeScript port of official Python SDK
- Full support for Claude Code CLI features
- Async generator API for streaming responses
- Comprehensive TypeScript types
- Example scripts for common use cases