# Environment Variables

The Claude Code SDK reads a small, namespaced set of environment variables for
convenience. Authentication is **not** among them — that is delegated entirely
to the `claude` CLI (see below).

## Authentication is handled by the CLI

This SDK does not handle API keys at all. There is **no `apiKey` option and no
`allowApiKeyFromEnv` option** — it shells out to the `claude` CLI, which owns
authentication. The SDK never reads `ANTHROPIC_API_KEY` itself.

Set up auth once with the CLI:

```bash
# Interactive login (uses your Pro/Max subscription)
claude login

# …or give the CLI an API key to read (pay-per-use billing)
export ANTHROPIC_API_KEY=sk-ant-...

# …or select a provider the CLI supports
export CLAUDE_CODE_USE_BEDROCK=1
export CLAUDE_CODE_USE_VERTEX=1
```

Any credentials live in the CLI's own config or in the process environment that
the CLI reads. There is nothing to pass through the SDK.

## Supported environment variables

These are read by the SDK and applied to options only when you have not already
set the corresponding option explicitly (explicit options win — see Precedence).

### `CLAUDE_SDK_DEBUG`
Enable debug mode for additional logging.

- **Values**: `true`, `1`, `yes`, `on` (true) | `false`, `0`, `no`, `off` (false)
- **Default**: `false`
- **Example**: `CLAUDE_SDK_DEBUG=true node your-script.js`

### `CLAUDE_SDK_VERBOSE`
Enable verbose output for more detailed information.

- **Values**: `true`, `1`, `yes`, `on` (true) | `false`, `0`, `no`, `off` (false)
- **Default**: `false`
- **Example**: `CLAUDE_SDK_VERBOSE=1 node your-script.js`

### `CLAUDE_SDK_LOG_LEVEL`
Set the logging level (0–4).

- **Values**: `0` (silent) to `4` (debug); values outside this range are ignored
- **Default**: Not set
- **Example**: `CLAUDE_SDK_LOG_LEVEL=3 node your-script.js`

### `NODE_ENV`
The Node.js environment (loaded but not applied to SDK options).

- **Values**: `development`, `production`, `test`, etc.
- **Default**: Not set
- **Example**: `NODE_ENV=development node your-script.js`

## Generic `DEBUG` / `VERBOSE` / `LOG_LEVEL` are no longer read

Earlier versions read the un-namespaced `DEBUG`, `VERBOSE`, and `LOG_LEVEL`
variables. They are **no longer read**. Those names are set ubiquitously by
unrelated tooling (CI systems, the `debug` npm package), and treating them as
the SDK's own silently enabled dumping of the command line and full stream
traffic. Use the `CLAUDE_SDK_`-prefixed variants above instead.

## Precedence

Explicit options always take precedence over environment variables. An
environment variable is applied only when the matching option is unset:

```javascript
// Environment: CLAUDE_SDK_DEBUG=true
const result = await claude()
  .debug(false) // this wins — debug stays false
  .query('Your prompt')
  .asText();
```

With the low-level `query()` function, pass the option directly:

```javascript
// Environment: CLAUDE_SDK_DEBUG=true
for await (const message of query('Your prompt', { debug: false })) {
  // debug stays false — the explicit option wins over the env var
}
```

## Example usage

```bash
# Enable debug mode via environment
CLAUDE_SDK_DEBUG=true node your-script.js

# Multiple SDK variables at once
CLAUDE_SDK_DEBUG=true CLAUDE_SDK_VERBOSE=1 CLAUDE_SDK_LOG_LEVEL=3 node your-script.js

# Environment variable set, but the explicit option overrides it
CLAUDE_SDK_DEBUG=true node your-script.js
# …with .debug(false) (fluent) or { debug: false } (query options), debug is false
```
