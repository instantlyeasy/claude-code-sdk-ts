# v1 API Examples

These are the fluent-API examples ported to the **v1 API** — the same `claude()`
builder ergonomics, running on the official `@anthropic-ai/claude-agent-sdk`.
See [docs/V1.md](../../docs/V1.md) for the full guide and the classic → v1
migration table.

## Setup

From the repository root (the `dist/` build is required — it is not committed):

```bash
npm install && npm run build
node examples/v1/hello-world.js
```

Auth is handled by the Claude Code CLI (`claude login` or `ANTHROPIC_API_KEY`).
The CLI itself is bundled by the official SDK — no separate install.

> ⚠️ These examples run real queries and **incur API/subscription usage**.

## Examples

| File | What it shows | v1-specific upgrades |
| --- | --- | --- |
| `hello-world.js` | Basic queries and model selection | `streamText()` — real incremental tokens |
| `code-analysis.js` | Analyzing files and a whole project | `onPreToolUse` hook for tool logging; `AbortSignal.timeout()` |
| `file-operations.js` | File create/read/search/edit flows | `canUseTool` enforcing a write sandbox (input rewriting) |
| `interactive-session.js` | Interactive REPL with Claude | **Persistent bidirectional session** — real conversation state, mid-run `setModel`/`setPermissionMode`/`interrupt` |
| `error-handling.js` | Robust error handling patterns | Native `.withFallbackModel()`; abort-based timeouts; working `succeeded()`/`getErrors()` |
| `project-scaffolding.js` | Generating project structures | Hooks with tool input; options composed in code |
| `web-research.js` | Research and synthesis tasks | **Real structured outputs** (`withOutputFormat`/`asStructured`); follow-ups via session `resume()` |
| `custom-tools.js` | **v1 only:** in-process MCP tools | `createSdkMcpServer` + `tool()` — tools as plain functions in your process |

## Ported API differences at a glance

- `withTimeout(ms)` → `.withSignal(AbortSignal.timeout(ms))`
- `.onToolUse(cb)` → `.onPreToolUse(hook)` (or `.onMessage()` + type check)
- `.withMCP([...])` (array) → `.withMCP({ name: config })` / `.withMCPServer(server)`
- `.withConfigFile()` / `.withRole()` → compose builder calls directly (or keep
  those call sites on the classic API)
- `LS` / `MultiEdit` tool names → use `Glob` / `Edit` (current CLI tool set)
