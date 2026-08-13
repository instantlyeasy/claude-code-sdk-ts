# Release Notes — v0.3.4

**A correctness hotfix.** v0.3.4 fixes a set of bugs that broke core functionality
for anyone using more than the simplest `claude().query(...).asText()` path. No
public API was removed; this is a safe upgrade from 0.3.x.

> A companion release, **0.4.0**, follows with the deeper hygiene work (full test
> suite + CI, packaging fixes, dependency refresh, and removal of the
> never-implemented "enhanced" surfaces). 0.3.4 is the "stop the bleeding" release.

## Why upgrade

If you used any of these, they were broken before and work now:

| You did this | Before 0.3.4 | After |
| --- | --- | --- |
| `break` out of a query loop, or abort mid-stream | Could **crash your process** | Clean shutdown |
| `.asResult()` | Always returned `''` | Returns the real final text |
| `.getUsage()` | `totalCost` always `0` | Real cost + tokens |
| `.asToolExecutions()` / `.findToolResult()` | Always empty | Returns tool results |
| `.acceptEdits()` | Silently did nothing | Maps to `--permission-mode acceptEdits` |
| `{ systemPrompt }` | Dropped / prepended to prompt | Sent via `--append-system-prompt` |
| `.withTimeout(ms)` | No-op (queries hung) | Enforced; throws `TimeoutError` |
| `{ temperature }`, `{ maxTokens }`, roles with context, MCP-server-permissions | **Aborted the query** with an opaque error | Warned once and ignored |
| `.addDirectory(['/a','/b'])` | Sent one invalid path | One `--add-dir` per directory |
| MCP servers with credentials in `env` | Secrets on the **command line** (`ps`-visible) | Written to a `0600` temp file |

## Security

- **MCP `env` secrets are no longer placed on the process command line.** They
  now live in a `0600` temp file passed to `--mcp-config`.
- **Argument-injection guard:** `model`, `sessionId`, and `addDirectories`
  values beginning with `-` are rejected (they could otherwise be reinterpreted
  as CLI flags — e.g. an injected `--dangerously-skip-permissions`).
- **Debug is namespaced to `CLAUDE_SDK_DEBUG`.** The SDK no longer treats the
  generic `DEBUG` env var (set by unrelated tooling and CI) as a request to dump
  the command line and full stream traffic. `queryRaw()` no longer logs the
  prompt or `options.env`.

## New

- **`pathToClaudeCodeExecutable`** — point the SDK at a specific `claude` binary.
- **Tests are back.** A regression suite (parser, argument building, and
  subprocess lifecycle against a mock CLI) ships in the repo — the first tests
  since the suite was deleted at v0.3.0. Run with `npm test`.

## Notes / known limitations (addressed in 0.4.0 or v1.0)

- The six unsupported options above are **ignored with a one-time warning** in
  0.3.4; they are **removed** in 0.4.0.
- Typed errors mapped from CLI `stderr` (e.g. `RateLimitError`) are not wired up
  yet — failures currently surface as `ProcessError` with the stderr text
  included. The typed-error rework lands in 0.4.0.
- SSE/HTTP MCP servers and the richer message types (thinking blocks, partial
  streaming) are part of the v1.0 rebuild on the official Agent SDK.

## Upgrade

```bash
npm install @instantlyeasy/claude-code-sdk-ts@0.3.4
```

No code changes required. If you relied on the generic `DEBUG` env var to get SDK
debug output, switch to `CLAUDE_SDK_DEBUG=1`.
