# Release Notes — v0.4.0

**Hygiene, type-surface correctness, and honest packaging.** 0.4.0 builds on the
0.3.4 correctness hotfix. It contains a few **breaking** changes (all small and
documented) alongside the "make the project trustworthy again" work.

## Breaking changes

1. **Node ≥ 20 required.** Node 18 (and 20) are EOL; `engines` now says `>=20`.
2. **Telemetry removed.** `createTelemetryProvider`, `ClaudeTelemetryProvider`,
   and `TelemetryUtils` are gone. The shipped provider was a stub whose
   `getLogger()` threw `"not fully implemented yet"` — the docs described a
   feature that never existed. Real observability is planned for the v1 rebuild.
3. **Dead enhanced-error system removed.** `isEnhancedError()` / `hasResolution()`
   are gone; they were structurally incapable of matching any error the SDK
   throws (they checked for a `category` property no thrown error has).

If you imported any of the above, remove the import. Nothing else in the public
API changed shape.

## What got fixed

- **The package passes its own typecheck.** `tsc --noEmit` reported 27 errors in
  0.3.3 (config loader, roles manager, telemetry); it now exits clean, and
  `prepublishOnly` gates releases on typecheck + lint + test + build.
- **CJS TypeScript consumers work.** `require('@instantlyeasy/claude-code-sdk-ts')`
  from a `node16`/`nodenext` TS project previously errored with TS1479 ("cannot be
  imported with require"). The `exports` map now points `require` at the CJS type
  declarations (`dist/index.d.cts`). Verified with `@arethetypeswrong/cli` — all
  resolution modes green.
- **Config `extends` is validated** (the inheritance path previously skipped
  validation), and **environment-variable expansion in config files actually
  runs** now (it was defined but never called, so `${HOME}`-style values were
  passed through literally).

## Type-surface improvements

- `ToolName` is an **open union** — MCP tool names (`mcp__server__tool`) and
  scoped patterns (`Bash(npm run test:*)`) now type-check.
- Permission maps are `Partial<Record<ToolName, …>>` — `{ Bash: 'deny' }` no
  longer forces you to specify all tools.
- `retryableErrors` accepts concrete error classes (`[RateLimitError]`).
- `PermissionMode` includes `plan` / `auto` / `dontAsk` / `manual`.
- Added `ThinkingBlock` / `RedactedThinkingBlock` to `ContentBlock`, and a named
  `Usage` type.

## Tooling / packaging

- **Tests + CI.** GitHub Actions runs typecheck, lint, tests, and build on Node
  20/22/24. A `package-lock.json` is now committed.
- **Slimmer install.** Sourcemaps and `examples/` are no longer published
  (unpacked tarball 933 kB → ~338 kB). `sideEffects: false` enables tree-shaking.
- Optional peer dependency on `@anthropic-ai/claude-code` is declared, so package
  managers surface the CLI requirement.
- Lint migrated to ESLint 9 flat config + typescript-eslint 8, clearing the
  previous 6 high `npm audit` findings (all were dev-only).

## Deferred to a follow-up

- Runtime-dependency major bumps (`execa` 8→10, `js-yaml` 4→5, `which` 4→7) and
  `vitest` 3→4. These require code/test changes (execa renamed the child-process
  type and changed cancel semantics) and are intentionally out of scope here to
  keep 0.4.0 stable.
- The v1.0 direction — a fluent wrapper over the official
  `@anthropic-ai/claude-agent-sdk` — is being scaffolded separately.

## Upgrade

```bash
npm install @instantlyeasy/claude-code-sdk-ts@0.4.0
```

Ensure you are on Node ≥ 20 and remove any telemetry / `isEnhancedError` imports.
