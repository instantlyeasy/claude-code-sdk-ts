# Claude Code SDK for TypeScript

[![npm version](https://badge.fury.io/js/@instantlyeasy%2Fclaude-code-sdk-ts.svg)](https://www.npmjs.com/package/@instantlyeasy/claude-code-sdk-ts)
[![npm downloads](https://img.shields.io/npm/dm/@instantlyeasy/claude-code-sdk-ts.svg)](https://www.npmjs.com/package/@instantlyeasy/claude-code-sdk-ts)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js Version](https://img.shields.io/node/v/@instantlyeasy/claude-code-sdk-ts.svg)](https://nodejs.org/)

Unofficial TypeScript SDK for [Claude Code](https://github.com/anthropics/claude-code) - the powerful CLI tool for interacting with Claude.

**✨ What's New in v0.4.0:**
- 🎬 **Interactive streaming session** with working visual typewriter effects
- 🛡️ **Typed error handling** you catch with `instanceof` — no error categories, no wrappers
- ⏱️ **Timeouts and edit-acceptance that actually take effect** — `withTimeout()` throws a real `TimeoutError`, `acceptEdits()` maps to the CLI's `--permission-mode`
- 🔧 **Production-ready examples** that actually work as advertised

> **Note**: For the classic async generator API, see [Classic API Documentation](docs/CLASSIC_API.md).

## Installation

```bash
npm install @instantlyeasy/claude-code-sdk-ts
# or
yarn add @instantlyeasy/claude-code-sdk-ts
# or  
pnpm add @instantlyeasy/claude-code-sdk-ts
```

**Latest Version:** `v0.4.0` with enhanced features and working visual streaming!

**Prerequisites:**
- Node.js 20 or later
- Claude Code CLI installed (`npm install -g @anthropic-ai/claude-code`)

## Quick Start

```javascript
import { claude } from '@instantlyeasy/claude-code-sdk-ts';

// Simple query
const response = await claude()
  .query('Say "Hello World!"')
  .asText();

console.log(response); // "Hello World!"
```

## Authentication

This SDK delegates all authentication to the Claude CLI:

```bash
# One-time setup - login with your Claude account
claude login
```

The SDK does not handle authentication directly and has no `apiKey` option. The CLI owns auth — either via `claude login` or an `ANTHROPIC_API_KEY` that the CLI reads from the environment. If you see authentication errors, authenticate using the Claude CLI first.

## Core Features

### 🎯 Fluent API

Chain methods for clean, readable code:

```javascript
const result = await claude()
  .withModel('sonnet')              // Choose model
  .allowTools('Read', 'Write')      // Configure permissions
  .acceptEdits()                    // Auto-accept file edits (--permission-mode acceptEdits)
  .inDirectory('/path/to/project')  // Set working directory
  .query('Refactor this code')     // Your prompt
  .asText();                       // Get response as text
```

> `acceptEdits()` and `skipPermissions()` (full bypass) both map to the CLI's `--permission-mode` and take effect on the run.

### 📊 Response Parsing

Extract exactly what you need:

```javascript
// Get plain text
const text = await claude()
  .query('Explain this concept')
  .asText();

// Parse JSON response
const data = await claude()
  .query('Return a JSON array of files')
  .asJSON<string[]>();

// Get the final result
const result = await claude()
  .query('Complete this task')
  .asResult();

// Analyze tool usage
const tools = await claude()
  .allowTools('Read', 'Grep')
  .query('Find all TODO comments')
  .asToolExecutions();

for (const execution of tools) {
  console.log(`${execution.tool}: ${execution.isError ? 'Failed' : 'Success'}`);
}
```

### 🔧 Tool Management

Fine-grained control over Claude's capabilities:

```javascript
// Allow specific tools
await claude()
  .allowTools('Read', 'Grep', 'LS')
  .query('Analyze this codebase')
  .asText();

// Deny dangerous tools
await claude()
  .denyTools('Bash', 'Write')
  .query('Review this code')
  .asText();

// Read-only mode
await claude()
  .allowTools() // No arguments = deny the mutating tools (Write, Edit, Bash, ...), keep Read/Grep/Glob
  .query('Explain this architecture')
  .asText();
```

### 💬 Session Management

Maintain conversation context across queries. Get the session ID from the **first real query's** parser, then resume it on a new builder with `withSessionId()`:

```javascript
// First query — keep the parser so we can read its session ID
const firstQuery = claude()
  .withModel('sonnet')
  .skipPermissions()
  .query('Pick a random number between 1 and 100');

const response1 = await firstQuery.asText();
const sessionId = await firstQuery.getSessionId(); // resolved from the CLI's init message

// Resume that same conversation on a new builder
const response2 = await claude()
  .withModel('sonnet')
  .skipPermissions()
  .withSessionId(sessionId)
  .query('What number did you pick?')
  .asText();
// Claude remembers the number!
```

> Don't call `query('')` just to obtain a session ID — an empty prompt starts a brand-new session, so the follow-up would have nothing to remember.

### 🚦 Cancellation Support

Cancel long-running operations:

```javascript
import { claude, AbortError } from '@instantlyeasy/claude-code-sdk-ts';

const controller = new AbortController();

// Cancel after 5 seconds
setTimeout(() => controller.abort(), 5000);

try {
  const response = await claude()
    .withSignal(controller.signal)
    .query('Long running task')
    .asText();
} catch (error) {
  if (error instanceof AbortError) {
    console.log('Query was cancelled');
  }
}
```

### 📝 Logging

Built-in logging with multiple implementations:

```javascript
import { ConsoleLogger, LogLevel } from '@instantlyeasy/claude-code-sdk-ts';

const logger = new ConsoleLogger(LogLevel.DEBUG);

const response = await claude()
  .withLogger(logger)
  .query('Debug this issue')
  .asText();

// Also available: JSONLogger, MultiLogger, NullLogger
```

### 🎭 Event Handlers

React to events during execution:

```javascript
await claude()
  .onMessage(msg => console.log('Message:', msg.type))
  .onAssistant(content => console.log('Claude sent', content.length, 'block(s)')) // content is ContentBlock[]
  .onToolUse(tool => console.log(`Using ${tool.name}...`))                        // tool is { name, input }
  .query('Perform analysis')
  .stream(async (message) => {
    // Handle streaming messages
  });
```

## Environment Variables

The SDK automatically loads safe configuration from environment. The variables are namespaced so unrelated tooling can't flip them on by accident:

- `CLAUDE_SDK_DEBUG` - Enable debug mode (values: `true`, `1`, `yes`, `on`)
- `CLAUDE_SDK_VERBOSE` - Enable verbose output
- `CLAUDE_SDK_LOG_LEVEL` - Set log level (0-4)
- `NODE_ENV` - Node environment

> The generic `DEBUG` / `VERBOSE` / `LOG_LEVEL` variables are intentionally **not** read — they're set ubiquitously by CI and other tools. Use the `CLAUDE_SDK_` variants.

**⚠️ Important**: The SDK never reads `ANTHROPIC_API_KEY` and has no `apiKey` option — authentication belongs to the Claude CLI (see above). See [Environment Variables Documentation](docs/ENVIRONMENT_VARIABLES.md).

## Error Handling

The SDK throws typed error classes. Catch the ones you care about with `instanceof` — each carries fields specific to what went wrong:

```javascript
import {
  claude,
  RateLimitError,
  AuthenticationError,
  TimeoutError,
  AbortError,
  ProcessError
} from '@instantlyeasy/claude-code-sdk-ts';

try {
  await claude().query('Task').asText();
} catch (error) {
  if (error instanceof RateLimitError) {
    console.error(`Rate limited — retry after ${error.retryAfter}s`);
  } else if (error instanceof AuthenticationError) {
    console.error('Not authenticated. Run `claude login` and try again.');
  } else if (error instanceof TimeoutError) {
    console.error('The query timed out.');
  } else if (error instanceof AbortError) {
    console.error('The query was cancelled.');
  } else if (error instanceof ProcessError) {
    console.error(`Claude CLI exited with code ${error.exitCode}`);
  } else {
    throw error; // Unknown error — re-throw
  }
}
```

The classes fall into two families: the API/enhanced errors (`RateLimitError`, `AuthenticationError`, `TimeoutError`, `NetworkError`, `ValidationError`, `ToolPermissionError`) extend `BaseSDKError`, while the process/CLI errors (`ProcessError`, `AbortError`, `CLINotFoundError`, `CLIConnectionError`) extend `ClaudeSDKError`. Both ultimately extend the built-in `Error`, so a bare `catch` always works as a fallback.

## Advanced Usage

### Configuration Files & Roles

Load settings and define reusable roles from YAML or JSON.

> **`withConfigFile()` and `withRolesFile()` are async** — they read and parse a file, so each returns a `Promise`. `await` the call on its own line before you chain the synchronous builder methods; you can't chain straight off the promise.

```javascript
// withConfigFile applies MCP servers, global settings, and tool permissions
const builder = claude();
await builder.withConfigFile('./config/claude.yaml');

const result = await builder
  .query('Generate component')
  .asText();
```

#### Role System

Roles live in their own file (loaded with `withRolesFile()`) and provide reusable configurations with:
- Model preference
- Tool permissions (`allowed` / `denied`) and a permission `mode`
- A prompting template with `${variable}` substitution
- A system prompt (delivered to the CLI via `--append-system-prompt`)
- Inheritance via `extends`

Example roles file:
```yaml
version: "1.0"

# Define reusable roles
roles:
  developer:
    model: sonnet
    permissions:
      mode: default
      tools:
        allowed: [Read, Write, Edit]
        denied: [Bash]
    promptingTemplate: |
      You are an expert ${language} developer using ${framework}.

  senior-developer:
    extends: developer          # Inherit from the developer role
    model: opus
    permissions:
      mode: acceptEdits
      tools:
        allowed: [TodoWrite]    # Additional tools
    systemPrompt: |
      Prioritize performance, readability, and test coverage.
```

```javascript
// Load the roles file (async), then apply a role by name with template variables
const roleBuilder = claude();
await roleBuilder.withRolesFile('./roles.yaml');

const response = await roleBuilder
  .withRole('senior-developer', {
    language: 'TypeScript',
    framework: 'Next.js'
  })
  .query('Optimize this React component')
  .asText();
```

See [Roles Documentation](docs/NEW_FEATURES.md#rolespersonas-system) for complete details.

### Production Features

#### Token Usage & Costs
```javascript
// query() already returns the ResponseParser — just hold on to it
const parser = claude()
  .query('Complex task');

const usage = await parser.getUsage();
console.log('Tokens:', usage.totalTokens);
console.log('Cost: $', usage.totalCost);
```

#### Streaming
```javascript
await claude()
  .query('Tell me a story')
  .stream(async (message) => {
    if (message.type === 'assistant') {
      // Stream complete messages (not individual tokens)
      console.log(message.content[0].text);
    }
  });
```

#### Custom Models & Timeouts
```javascript
// withTimeout enforces a real deadline — it throws TimeoutError if the run exceeds it
const response = await claude()
  .withModel('claude-3-opus-20240229')
  .withTimeout(30000)
  .query('Complex analysis')
  .asText();
```

## 🚀 Enhanced Features (v0.4.0)

### ✨ Visual Token Streaming

Create typewriter effects and real-time response display:

```javascript
import { claude, createTokenStream } from '@instantlyeasy/claude-code-sdk-ts';

// Collect response for controlled display
const messageGenerator = claude()
  .withModel('sonnet')
  .queryRaw('Write a story about AI');

const tokenStream = createTokenStream(messageGenerator);
const allTokens = [];

for await (const chunk of tokenStream.tokens()) {
  allTokens.push(chunk.token);
}

// Display with typewriter effect
const fullText = allTokens.join('');
for (const char of fullText) {
  process.stdout.write(char);
  await new Promise(resolve => setTimeout(resolve, 30));
}
```

### 🛡️ Advanced Error Handling

Handle specific error types with smart retry logic:

```javascript
import { claude, detectErrorType, withRetry } from '@instantlyeasy/claude-code-sdk-ts';

// withRetry(fn, options) returns a WRAPPER function — it does not run fn itself.
// Call the wrapper to execute with retries.
const run = withRetry(
  () => claude().query('Complex task').asText(),
  {
    maxAttempts: 3,
    shouldRetry: (error) => {
      const errorType = detectErrorType(error.message);
      return ['network_error', 'timeout_error'].includes(errorType);
    }
  }
);

try {
  const result = await run(); // or, as one expression: await withRetry(fn, options)()
} catch (error) {
  const errorType = detectErrorType(error.message);
  console.log(`Failed with error type: ${errorType}`);
}
```

### 🎬 Interactive Streaming Session

**NEW!** Complete chat interface with visual streaming:

```bash
# Try the interactive streaming example
node examples/fluent-api/new-features/interactive-streaming.js
```

Features working character-by-character display, conversation history, speed control, and model switching!

## Examples

Comprehensive examples are available in the [examples directory](./examples):

### **Basic Examples**
- **[fluent-api-demo.js](./examples/fluent-api-demo.js)** - Complete fluent API showcase
- **[sessions.js](./examples/sessions.js)** - Session management patterns
- **[yaml-config-demo.js](./examples/yaml-config-demo.js)** - Configuration examples

### **Advanced Features** ([new-features directory](./examples/fluent-api/new-features/))
- **[interactive-streaming.js](./examples/fluent-api/new-features/interactive-streaming.js)** - 🎬 **Interactive chat with visual streaming**
- **[token-streaming.js](./examples/fluent-api/new-features/token-streaming.js)** - Working typewriter effects
- **[error-handling.js](./examples/fluent-api/new-features/error-handling.js)** - Advanced error patterns
- **[retry-strategies.js](./examples/fluent-api/new-features/retry-strategies.js)** - Multiple retry strategies

### **Core Examples**
- **File Operations** - Reading, writing, and analyzing code
- **Web Research** - Using Claude's web capabilities
- **Interactive Sessions** - Building conversational interfaces

## Migration from Classic API

The SDK maintains full backward compatibility. The classic `query()` function still works:

```javascript
import { query } from '@instantlyeasy/claude-code-sdk-ts';

for await (const message of query('Hello')) {
  // Classic async generator API
}
```

However, we recommend the fluent API for new projects. See [Migration Guide](docs/FLUENT_API.md#migration-guide).

## API Reference

### `claude(): QueryBuilder`

Creates a new query builder:

```typescript
claude()
  .withModel(model: string)
  .allowTools(...tools: ToolName[])          // no args = read-only (denies mutating tools)
  .denyTools(...tools: ToolName[])
  .skipPermissions()                          // full bypass (--permission-mode bypassPermissions)
  .acceptEdits()                              // auto-accept edits (--permission-mode acceptEdits)
  .withTimeout(ms: number)                    // throws TimeoutError on expiry
  .inDirectory(path: string)
  .withSessionId(id: string)
  .withSignal(signal: AbortSignal)
  .withLogger(logger: Logger)
  .withConfigFile(path: string): Promise<this>   // async — await before chaining
  .withRolesFile(path: string): Promise<this>    // async — await before chaining
  .withRole(roleName: string)                    // overload 1: apply a loaded role by name
  .withRole(role: RoleDefinition, vars?: Record<string, string>)  // overload 2: inline definition
  .onMessage(handler: (msg: Message) => void)
  .onAssistant(handler: (content: ContentBlock[]) => void)
  .onToolUse(handler: (tool: { name: string; input: Record<string, unknown> }) => void)
  .query(prompt: string): ResponseParser
```

### Response Parser Methods

- `asText()` - Extract plain text
- `asJSON<T>()` - Parse JSON response
- `asResult()` - Get the final result message
- `asArray()` - Get every message as an array
- `asToolExecutions()` - Get tool execution details
- `findToolResults(name)` - Find all results for a tool
- `findToolResult(name)` - Get the first result for a tool
- `getUsage()` - Get token usage stats
- `getSessionId()` - Get the session ID (resolved from the init message)
- `stream(callback)` - Stream messages
- `succeeded()` - Whether the run finished without errors
- `getErrors()` - Collect run/tool error messages
- `transform(fn)` - Apply a custom transformer to the messages

### Types

See [TypeScript definitions](./dist/index.d.ts) for complete type information.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for version history.

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## License

MIT © Daniel King & Claude

## Links

- [NPM Package](https://www.npmjs.com/package/@instantlyeasy/claude-code-sdk-ts)
- [GitHub Repository](https://github.com/instantlyeasy/claude-code-sdk-ts)
- [Claude Code CLI](https://github.com/anthropics/claude-code)
- [Official Python SDK](https://github.com/anthropics/claude-code-sdk)