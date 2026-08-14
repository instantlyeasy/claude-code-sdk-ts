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

- [x] First-class builder methods for **hooks** and **`canUseTool`**.
      `.canUseTool(handler)` takes the official `CanUseTool` callback (allow/deny +
      input rewriting). `.addHook(event, cb, {matcher?, timeout?})` plus
      `.onPreToolUse` / `.onPostToolUse` / `.onUserPromptSubmit` / `.onStop`
      conveniences build the official `Partial<Record<HookEvent, HookCallbackMatcher[]>>`.
      The official `CanUseTool` / `PermissionResult` / `HookEvent` / `HookCallback`
      types are re-exported from the `./v1` entry. Covered by tests.
- [x] **In-process MCP servers**: `createSdkMcpServer` / `tool()` re-exported from
      `./v1`, plus a `.withMCPServer(server)` builder method that keys the server
      by name (accepts the in-process sdk config or any named stdio/SSE/HTTP config).
- [x] **Sessions**: `.resume(id)` / `.forkSession()` on the builder, plus
      `listSessions` / `getSessionInfo` / `getSessionMessages` / `forkSession` /
      `renameSession` / `deleteSession` re-exported from `./v1`.
- [x] **Structured outputs**: `.withOutputFormat(schema)` (maps to the official
      `{type:'json_schema', schema}`) and `ResponseParser.asStructured<T>()` reading
      the result's `structured_output`. Covered by tests.
- [x] **Partial streaming**: `.streamText(prompt)` yields the model's real
      incremental text tokens from the official `stream_event` deltas (auto-sets
      `includePartialMessages`) — genuine streaming, not the classic
      word-splitting. `streamTextDeltas` / `runV1QueryRaw` also exported.
- [ ] Surface richer message variants (thinking blocks, non-text `stream_event`,
      `task_*`) through the adapter or a v1-native message type.
- [x] **Bidirectional sessions + mid-run controls**: `.session(initialPrompt?)`
      returns a `V1Session` — `send()` queues messages over streaming input, the
      session is `AsyncIterable<Message>`, and `interrupt()` / `setModel()` /
      `setPermissionMode()` proxy the official `Query` controls (`.controls`
      exposes the raw `Query` for the rest). `close()` ends input + tears down.
      Covered by tests (echo round-trip + control-call assertions).
- [x] **Dependency story (1.0.0-alpha.1):** the official SDK is now an OPTIONAL
      peerDependency (`>=0.3.231`) + devDependency, no longer a hard dependency.
      Verified by consumer simulation: installing the package without the peer is
      ~2.5 MB, the classic root import works, and importing `/v1` fails with
      `ERR_MODULE_NOT_FOUND: Cannot find package '@anthropic-ai/claude-agent-sdk'`
      (names exactly what to install); with the peer installed, `/v1` loads.
      The classic dist entries contain zero references to the official SDK.
      (Whether classic moves behind `./legacy` at 1.0 stays an open question.)
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
