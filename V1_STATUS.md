# v1 — fluent wrapper over the official Agent SDK (in progress)

This branch (`feat/v1-official-sdk-wrapper`) begins **Option B** from the audit:
rebuild the SDK's internals on top of the official
[`@anthropic-ai/claude-agent-sdk`](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk),
keeping this package's genuine differentiator — the fluent `claude()` builder and
`ResponseParser` DX — while letting the official, daily-maintained, CLI-version-
locked SDK own the wire protocol.

**Why:** every wire-format bug the audit found in the 0.3.x/0.4.x subprocess
transport (dropped tool results, wrong result shape, zero cost, crash-on-break)
is *structurally impossible* here, because we no longer parse the CLI ourselves.
Hooks, in-process MCP servers, bidirectional sessions, structured outputs, and
real partial streaming all become reachable because the official SDK provides
them.

## What works now (the vertical slice)

```ts
import { claude } from '@instantlyeasy/claude-code-sdk-ts/v1';

const text = await claude()
  .withModel('sonnet')
  .allowTools('Read', 'Grep')
  .query('Summarize the README')
  .asText();
```

- `src/v1/builder.ts` — fluent `claude()` builder (model, tools, permissions,
  cwd, env, signal, session resume/fork, maxTurns, system prompt, add-dir,
  executable, plus passthroughs for MCP servers / `canUseTool` / hooks).
- `src/v1/options.ts` — maps builder state → official `Options` (field names
  asserted by tests).
- `src/v1/adapter.ts` — maps the official `SDKMessage` stream → this package's
  classic `Message`, so the **existing `ResponseParser` is reused unchanged**.
- `src/v1/query-runner.ts` — the single seam that imports the official SDK.
- `test/v1-wrapper.test.ts` — mocks the official `query()` and verifies the whole
  chain: `asText()`, `asResult()`, `getUsage()` (real cost), `asToolExecutions()`
  (tool results correlated across messages), `getSessionId()`, and option mapping.
  8/8 passing, no CLI spawned.

Published as the `./v1` subpath so it stays clearly separate from the classic
API until it is promoted to the default at 1.0.0.

## Remaining work (checklist)

- [ ] First-class builder methods for **hooks** (typed `HookEvent` map) and
      **`canUseTool`** (permission callback with input rewriting) — currently
      accepted as opaque passthroughs.
- [ ] **In-process MCP servers**: re-export `createSdkMcpServer` / `tool()` and a
      `.withMCPServer()` builder method.
- [ ] **Sessions**: `.resume()/.fork()`, plus `listSessions()/getSessionMessages()`
      passthroughs.
- [ ] **Structured outputs** (`outputFormat: json_schema`) → a `.asStructured<T>()`
      parser helper.
- [ ] **Partial streaming** (`includePartialMessages`) → a real token stream
      backed by `stream_event` deltas (replaces the classic word-splitting).
- [ ] Surface richer message variants (thinking blocks, `stream_event`,
      `task_*`) through the adapter or a v1-native message type.
- [ ] Interrupts / `setPermissionMode` / `setModel` via the official `Query`
      control methods (needs a persistent-session builder mode).
- [ ] Decide the dependency story: at 1.0 the official SDK becomes the core, and
      the classic subprocess transport is either removed or kept behind a
      `./legacy` subpath. (Right now the official SDK is a hard dependency of the
      whole package on this branch; classic-only users shouldn't pay for it.)
- [ ] Migration guide `0.4.x (classic) → 1.0 (official-backed)`.
- [ ] Integration test against the real bundled CLI (opt-in, token-costing) in CI.

## Design notes

- The adapter returning `null` for unmapped message types means new official
  message variants degrade gracefully instead of breaking the stream.
- `env` is spread over `process.env` in the mapper because the official SDK
  *replaces* the subprocess environment when `env` is set — a common footgun.
- System prompt maps to `{ type: 'preset', preset: 'claude_code', append }` so
  ported CLI users keep Claude Code's default prompt (the official SDK defaults
  to a minimal prompt otherwise).
