# Error Handling

The Claude Code SDK throws typed error classes so you can react to specific
failure modes with `instanceof` checks. Every error the SDK throws extends the
base `ClaudeSDKError`.

## Error Classes

All error classes are exported from the package root — there is no separate
`/errors/enhanced` entry point.

### Base and subprocess errors

```javascript
import {
  ClaudeSDKError,     // base class for everything below
  CLIConnectionError, // failed to connect to the CLI
  CLINotFoundError,   // the `claude` CLI is not installed / not on PATH
  ProcessError,       // the CLI process exited non-zero (has `exitCode`, `signal`)
  AbortError,         // the operation was aborted via an AbortSignal
  CLIJSONDecodeError, // the CLI emitted output the SDK could not parse (has `rawOutput`)
  ConfigValidationError
} from '@instantlyeasy/claude-code-sdk-ts';
```

### API, permission, network and streaming errors

These are surfaced when the SDK detects a matching condition in the CLI output,
or (for `TimeoutError`) when a configured timeout elapses.

```javascript
import {
  // API
  APIError,                    // generic API failure (has optional `statusCode`, `headers`)
  RateLimitError,              // 429 (has `retryAfter`, and optional `limit`, `remaining`, `resetAt`)
  AuthenticationError,         // 401 (has optional `authMethod`, `requiredAction`)
  ModelNotAvailableError,      // 404 for an unknown/denied model
  ContextLengthExceededError,  // 413, prompt too large

  // Permissions
  PermissionError,
  ToolPermissionError,         // a tool was denied (has `tool`, `permission`)
  MCPServerPermissionError,

  // Network / timeout
  NetworkError,                // base network failure (has optional `code`, `syscall`)
  TimeoutError,                // an operation timed out (subclass of NetworkError)
  ConnectionTimeoutError,
  ConnectionRefusedError,

  // Streaming
  StreamingError,
  StreamAbortedError,
  StreamPausedError,

  // Retry
  MaxRetriesExceededError,
  CircuitOpenError,

  // Validation
  ValidationError              // has optional `field`, `value`
} from '@instantlyeasy/claude-code-sdk-ts';
```

### Type guards and detection helpers

Instead of a `category` field, the SDK ships narrow `instanceof`-based type
guards and a couple of helpers for turning raw CLI text into a typed error:

```javascript
import {
  isAPIError,
  isRateLimitError,
  isAuthenticationError,
  isToolPermissionError,
  isNetworkError,
  isTimeoutError,
  isValidationError,
  isStreamAbortedError,
  isRetryableError,   // true for rate-limit, network, connection-timeout, and 5xx API errors
  detectErrorType,    // (message: string) => ErrorType
  createTypedError    // (type, message) => Error instance of the matching class
} from '@instantlyeasy/claude-code-sdk-ts';
```

> Note: these errors are plain `Error` subclasses. They do **not** carry a
> `category`, `resolution`, or `toJSON()` — use `instanceof` (or the type guards
> above) and the class-specific fields listed inline (e.g. `ProcessError.exitCode`,
> `RateLimitError.retryAfter`).

## Error Handling Examples

### Basic error handling

```javascript
import {
  claude,
  ClaudeSDKError,
  CLINotFoundError
} from '@instantlyeasy/claude-code-sdk-ts';

try {
  const result = await claude()
    .withModel('sonnet')
    .query('Your prompt')
    .asText();
} catch (error) {
  if (error instanceof CLINotFoundError) {
    console.error('Please install the Claude Code CLI first:');
    console.error('  npm install -g @anthropic-ai/claude-code');
  } else if (error instanceof ClaudeSDKError) {
    console.error(`SDK error: ${error.message}`);
  } else {
    throw error;
  }
}
```

### Handling specific error types

```javascript
import {
  claude,
  RateLimitError,
  AuthenticationError,
  TimeoutError,
  isRetryableError
} from '@instantlyeasy/claude-code-sdk-ts';

try {
  const result = await claude().query('Your prompt').asText();
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error('Not authenticated. Run: claude login');
  } else if (error instanceof RateLimitError) {
    console.error(`Rate limited. Retry after ${error.retryAfter}s`);
  } else if (error instanceof TimeoutError) {
    console.error('The operation timed out — try a shorter prompt or a larger timeout.');
  } else if (isRetryableError(error)) {
    console.error('Transient error — safe to retry.');
  } else {
    throw error;
  }
}
```

### Handling errors from the low-level `query()` iterator

The low-level `query()` function is an async generator; wrap the `for await`
loop to catch errors as they surface:

```javascript
import { query, ProcessError } from '@instantlyeasy/claude-code-sdk-ts';

try {
  for await (const message of query('Your prompt')) {
    // handle messages
  }
} catch (error) {
  if (error instanceof ProcessError) {
    console.error(`CLI exited with code ${error.exitCode}`);
  } else {
    throw error;
  }
}
```

## Common Error Resolutions

### Authentication errors

Authentication is handled entirely by the `claude` CLI — this SDK has no
`apiKey` option. If you see an `AuthenticationError`, set up the CLI once:

```bash
# Interactive login (Pro/Max subscription)
claude login

# …or point the CLI at an API key it should read
export ANTHROPIC_API_KEY=sk-ant-...
```

```javascript
import { claude, AuthenticationError } from '@instantlyeasy/claude-code-sdk-ts';

try {
  const result = await claude().query('Your prompt').asText();
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error('Run "claude login" to authenticate the CLI.');
  }
}
```

### Timeout errors

Timeouts are enforced now: `.withTimeout(ms)` (or the `timeout` option on
`query()`) is passed through to the CLI, and when it elapses the SDK throws a
`TimeoutError`. Increasing the value actually extends the deadline.

```javascript
import { claude, TimeoutError } from '@instantlyeasy/claude-code-sdk-ts';

try {
  const result = await claude()
    .withTimeout(60000) // 60s — raise this for long-running work
    .query('Your prompt')
    .asText();
} catch (error) {
  if (error instanceof TimeoutError) {
    console.error(error.message); // "Claude Code CLI timed out after 60000ms"
  }
}
```

With the low-level function:

```javascript
import { query } from '@instantlyeasy/claude-code-sdk-ts';

for await (const message of query('Your prompt', { timeout: 60000 })) {
  // …
}
```

### Subprocess / CLI-not-found errors

```javascript
// CLINotFoundError: the `claude` CLI could not be located on your PATH.
// Install it with:
//   npm install -g @anthropic-ai/claude-code
```

A non-zero exit from the CLI surfaces as a `ProcessError`, exposing `exitCode`
and `signal` so you can distinguish a crash from a clean failure.

## Retrying transient errors

`isRetryableError()` identifies errors that are usually worth retrying
(rate limits, network failures, connection timeouts, and 5xx API errors):

```javascript
import { claude, isRetryableError } from '@instantlyeasy/claude-code-sdk-ts';

async function queryWithRetry(prompt, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await claude().query(prompt).asText();
    } catch (error) {
      if (isRetryableError(error) && attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      throw error;
    }
  }
}
```

The SDK also ships a retry executor (`withRetry`, `createRetryExecutor`, and the
strategy-specific `createExponentialRetryExecutor` / `createLinearRetryExecutor` /
`createFibonacciRetryExecutor`). Note that `withRetry(fn, opts)` returns a
**wrapper function** — it does not run `fn` itself:

```javascript
import { withRetry } from '@instantlyeasy/claude-code-sdk-ts';

const run = withRetry(() => claude().query('Your prompt').asText(), { maxAttempts: 3 });
const result = await run();
// or in one expression:
// const result = await withRetry(fn, { maxAttempts: 3 })();
```

## Best Practices

1. **Handle errors explicitly** — never swallow caught errors.
2. **Match on class, not on strings** — use `instanceof` or the exported type guards.
3. **Read class-specific fields** — `ProcessError.exitCode`, `RateLimitError.retryAfter`, `ValidationError.field`, etc.
4. **Retry only transient failures** — gate retries behind `isRetryableError()`.
5. **Fail gracefully** — provide fallbacks for critical operations.

## Creating custom errors

If you want your application errors to interoperate with the SDK's base type,
extend `ClaudeSDKError`:

```javascript
import { ClaudeSDKError } from '@instantlyeasy/claude-code-sdk-ts';

class MyCustomError extends ClaudeSDKError {
  constructor(message) {
    super(message, 'MY_CUSTOM_ERROR'); // second arg is an optional `code`
    this.name = 'MyCustomError';
  }
}
```
