# Claude Code SDK Examples

This directory contains practical examples demonstrating various use cases for the Claude Code SDK TypeScript implementation.

## 📁 Directory Structure

- **`v1/`** - ⭐ The fluent examples ported to the **v1 API (alpha)** — same builder
  ergonomics on the official Agent SDK backend, plus v1-only capabilities
  (real sessions, custom in-process tools, structured outputs, real token
  streaming). See [docs/V1.md](../docs/V1.md).
- **`fluent-api/`** - Modern examples using the classic fluent API with method chaining
- **`previous-syntax/`** - Examples using the traditional function-based API

## 🎯 Choose Your API Style

### Fluent API (Recommended)
The fluent API provides a more intuitive, chainable interface:
```javascript
const result = await claude()
  .withModel('opus')
  .allowTools('Read', 'Write')
  .acceptEdits()
  .query('Create a README file')
  .asText();
```

### Previous Syntax
The traditional function-based approach:
```javascript
for await (const message of query('Create a README file', {
  model: 'opus',
  allowedTools: ['Read', 'Write'],
  permissionMode: 'acceptEdits'
})) {
  // Handle messages
}
```

## 📚 Examples Overview

### Core Examples (Available in Both API Styles)

1. **Hello World** - The simplest example
   - Fluent: `node fluent-api/hello-world.js`
   - Previous: `node previous-syntax/hello-world.js`

2. **File Operations** - File creation, reading, and editing
   - Fluent: `node fluent-api/file-operations.js`
   - Previous: `node previous-syntax/file-operations.js`

3. **Code Analysis** - Analyze code patterns and quality
   - Fluent: `node fluent-api/code-analysis.js`
   - Previous: `node previous-syntax/code-analysis.js`

4. **Interactive Session** - Interactive CLI with Claude
   - Fluent: `node fluent-api/interactive-session.js`
   - Previous: `node previous-syntax/interactive-session.js`

5. **Web Research** - Research and learning tasks
   - Fluent: `node fluent-api/web-research.js`
   - Previous: `node previous-syntax/web-research.js`

6. **Project Scaffolding** - Create project structures
   - Fluent: `node fluent-api/project-scaffolding.js react-app my-project`
   - Previous: `node previous-syntax/project-scaffolding.js`

7. **Error Handling** - Comprehensive error patterns
   - Fluent: `node fluent-api/error-handling.js`
   - Previous: `node previous-syntax/error-handling.js`

### Fluent API Exclusive Examples

8. **[fluent-api-demo.js](./fluent-api-demo.js)** - Comprehensive fluent API showcase
9. **[response-parsing-demo.js](./response-parsing-demo.js)** - Advanced response handling
10. **[new-features-demo.js](./new-features-demo.js)** - Roles/personas and configuration objects
11. **[enhanced-features-demo.js](./enhanced-features-demo.js)** - Typed errors, token streaming, per-call permissions, retry
12. **[production-features.js](./production-features.js)** - Production-ready features (AbortSignal, read-only mode, logging)
13. **[sessions.js](./sessions.js)** - Session management and conversation context

## 🚀 Getting Started

1. **Build the SDK from the repo root** (required — `dist/` is gitignored, and
   some examples import the built output at `../dist/index.js`):
   ```bash
   npm install && npm run build
   ```

2. **Install the Claude CLI** (the SDK shells out to it; note the package name):
   ```bash
   npm install -g @anthropic-ai/claude-code
   ```

3. **Authenticate the CLI** — the SDK has no `apiKey` option; authentication is
   handled entirely by the CLI:
   ```bash
   claude login          # or set ANTHROPIC_API_KEY, which the CLI reads
   ```

4. **Run an example:**
   ```bash
   cd examples
   node fluent-api/hello-world.js
   ```

## 💡 Key Concepts

### Permission Modes
- `default` - Claude will ask for permission for each tool use
- `acceptEdits` - Auto-accept file edits but confirm other operations  
- `bypassPermissions` - Skip all permission prompts (use with caution)

### Tool Management
- `allowedTools` - Whitelist specific tools Claude can use
- `deniedTools` - Blacklist specific tools Claude cannot use

### Message Types
- `system` - Initialization and system messages
- `assistant` - Claude's responses and tool usage
- `user` - Tool results (from Claude's perspective)
- `result` - Final result with usage stats and cost

## 📝 Common Patterns

### Basic Query
```javascript
for await (const message of query('Your prompt here')) {
  if (message.type === 'result') {
    console.log(message.content);
  }
}
```

### With Options
```javascript
const options = {
  permissionMode: 'bypassPermissions',
  allowedTools: ['Read', 'Write']
};

for await (const message of query('Your prompt', options)) {
  // Handle messages
}
```

### Full Message Handling
```javascript
for await (const message of query('Your prompt')) {
  switch (message.type) {
    case 'system':
      // Handle system messages
      break;
    case 'assistant':
      // Handle Claude's responses
      break;
    case 'result':
      // Handle final result
      break;
  }
}
```

## 🛠️ Advanced Usage

See [error-handling.js](./error-handling.js) for:
- Retry logic implementation
- Graceful error handling
- Timeout management
- Authentication error handling

See [interactive-session.js](./interactive-session.js) for:
- Building interactive CLIs
- Dynamic option configuration
- User input handling

## 🆕 Enhanced Features (v0.4.0)

The SDK includes several enhanced features based on early adopter feedback.
(The OpenTelemetry/logging-provider integration that earlier versions advertised
was removed in v0.4.0 and is intentionally not listed here.)

### 1. **Typed Error Handling**
```javascript
import { isRateLimitError, isToolPermissionError } from '@instantlyeasy/claude-code-sdk-ts';

try {
  // Your Claude query
} catch (error) {
  if (isRateLimitError(error)) {
    console.log(`Retry after ${error.retryAfter} seconds`);
  } else if (isToolPermissionError(error)) {
    console.log(`Tool ${error.tool} denied: ${error.reason}`);
  }
}
```

### 2. **Token-Level Streaming**
```javascript
import { createTokenStream } from '@instantlyeasy/claude-code-sdk-ts';

const tokenStream = createTokenStream(messageGenerator);
for await (const chunk of tokenStream.tokens()) {
  process.stdout.write(chunk.token);
}
```

### 3. **Per-Call Tool Permissions**
```javascript
const permissionManager = createPermissionManager(options);
const isAllowed = await permissionManager.isToolAllowed('Bash', context, {
  allow: ['Read', 'Write'],
  deny: ['Bash'],
  dynamicPermissions: {
    Write: async (ctx) => ctx.role === 'admin' ? 'allow' : 'deny'
  }
});
```

### 4. **Exponential Backoff & Retry**
```javascript
import { createRetryExecutor } from '@instantlyeasy/claude-code-sdk-ts';

const retryExecutor = createRetryExecutor({
  maxAttempts: 3,
  initialDelay: 1000,
  multiplier: 2
});

const result = await retryExecutor.execute(async () => {
  return await claude().query('Your prompt').asText();
});
```

There is also a `withRetry(fn, opts)` helper. Note it returns a *wrapper
function* — it does not run `fn` itself:

```javascript
import { withRetry } from '@instantlyeasy/claude-code-sdk-ts';

const run = withRetry(() => claude().query('Your prompt').asText(), { maxAttempts: 3 });
const result = await run();
```

See [enhanced-features-demo.js](./enhanced-features-demo.js) for a complete demonstration.

### 5. **Production Features**

See [production-features.js](./production-features.js) for:
- Cancellable queries with AbortSignal
- Read-only mode enforcement with `allowTools()`
- Advanced logging with nested object support
- Message vs token streaming clarification

### 6. **Session Management**

See [sessions.js](./sessions.js) for:
- Session management with `getSessionId()` and `withSessionId()`
- Maintaining conversation context across multiple queries

## 📖 Additional Resources

- [Claude Code CLI Documentation](https://github.com/anthropics/claude-code)
- [SDK TypeScript Types](../src/types.ts)
- [Main README](../README.md)