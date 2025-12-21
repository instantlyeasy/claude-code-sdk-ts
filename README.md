# Claude Code SDK for TypeScript

[![npm version](https://badge.fury.io/js/@instantlyeasy%2Fclaude-code-sdk-ts.svg)](https://www.npmjs.com/package/@instantlyeasy/claude-code-sdk-ts)
[![npm downloads](https://img.shields.io/npm/dm/@instantlyeasy/claude-code-sdk-ts.svg)](https://www.npmjs.com/package/@instantlyeasy/claude-code-sdk-ts)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js Version](https://img.shields.io/node/v/@instantlyeasy/claude-code-sdk-ts.svg)](https://nodejs.org/)

Unofficial TypeScript SDK for [Claude Code](https://github.com/anthropics/claude-code) - the powerful CLI tool for interacting with Claude.

**✨ What's New in v0.3.3:**
- 🎬 **Interactive streaming session** with working visual typewriter effects
- 🛡️ **Advanced error handling** with retry strategies and typed errors
- 📊 **Token streaming analysis** with honest documentation about current behavior
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

**Latest Version:** `v0.3.3` with enhanced features and working visual streaming!

**Prerequisites:**
- Node.js 18 or later
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

### Option 1: Claude CLI Authentication (Recommended)

This SDK delegates all authentication to the Claude CLI:

```bash
# One-time setup - login with your Claude account
claude login
```

### Option 2: Programmatic Authentication (New!)

For programmatic authentication without the CLI, use the built-in OAuth flow:

```javascript
import { startAuth, isAuthenticated, getAccessToken } from '@instantlyeasy/claude-code-sdk-ts';

// Check if already authenticated
if (await isAuthenticated()) {
  console.log('Already authenticated!');
  const token = await getAccessToken();
} else {
  // Start OAuth flow
  const { url, waitForCode } = startAuth();
  
  console.log('Open this URL in your browser:');
  console.log(url);
  
  // User opens URL, authorizes, and copies the code
  const code = '...'; // Get from user input
  await waitForCode(code);
  
  console.log('Authentication successful!');
}
```

Run the complete example:

```bash
node examples/auth-example.js
```

The programmatic auth flow:
1. Generates a secure OAuth URL with PKCE
2. Stores credentials in `~/.claude/credentials.json`
3. Automatically handles token refresh
4. Provides convenient helper functions

### Authentication Classes

For advanced use cases, use the authentication classes directly:

```javascript
import { ClaudeAuth, AnthropicAuth } from '@instantlyeasy/claude-code-sdk-ts';

const auth = new ClaudeAuth();

// Start auth flow
const { url, waitForCode } = auth.startAuthFlow();

// Check authentication status
const isAuth = await auth.isAuthenticated();

// Get access token (refreshes if needed)
const token = await auth.getAccessToken();

// Logout
await auth.logout();
```

## Core Features

### 🎯 Fluent API

Chain methods for clean, readable code:

```javascript
const result = await claude()
  .withModel('sonnet')              // Choose model
  .allowTools('Read', 'Write')      // Configure permissions
  .skipPermissions()                // Auto-accept edits
  .inDirectory('/path/to/project')  // Set working directory
  .query('Refactor this code')     // Your prompt
  .asText();                       // Get response as text
```

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

// Read-only mode (no tools)
await claude()
  .allowTools() // Empty = deny all
  .query('Explain this architecture')
  .asText();
```

### 💬 Session Management

Maintain conversation context across queries:

```javascript
const session = claude()
  .withModel('sonnet')
  .skipPermissions();

// First query
const response1 = await session
  .query('Pick a random number between 1 and 100')
  .asText();

// Continue with context
const sessionId = await session.query('').getSessionId();
const response2 = await session
  .withSessionId(sessionId)
  .query('What number did you pick?')
  .asText();
// Claude remembers the number!
```

### 🚦 Cancellation Support

Cancel long-running operations:

```javascript
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
  .onAssistant(msg => console.log('Claude:', msg))
  .onToolUse(tool => console.log(`Using ${tool.name}...`))
  .query('Perform analysis')
  .stream(async (message) => {
    // Handle streaming messages
  });
```

## Environment Variables

The SDK automatically loads safe configuration from environment:

- `DEBUG` - Enable debug mode (values: `true`, `1`, `yes`, `on`)
- `VERBOSE` - Enable verbose output
- `LOG_LEVEL` - Set log level (0-4)
- `NODE_ENV` - Node environment

**⚠️ Important**: API keys are NOT automatically loaded from `ANTHROPIC_API_KEY` for safety. This prevents accidental billing charges. See [Environment Variables Documentation](docs/ENVIRONMENT_VARIABLES.md).

## Error Handling

Enhanced error handling with categories and resolution hints:

```javascript
import { isEnhancedError, hasResolution } from '@instantlyeasy/claude-code-sdk-ts';

try {
  await claude().query('Task').asText();
} catch (error) {
  if (isEnhancedError(error)) {
    console.error(`${error.category} error: ${error.message}`);
    if (hasResolution(error)) {
      console.error('Try:', error.resolution);
    }
  }
}
```

Error categories include:
- `network` - Connection issues
- `authentication` - Auth problems
- `permission` - Access denied
- `timeout` - Operation timeouts
- `validation` - Invalid input
- `cli` - Claude CLI issues
- `configuration` - Config problems

## Advanced Usage

### Configuration Files & Roles

Load settings and define reusable roles from YAML or JSON:

```javascript
// Load configuration with roles
await claude()
  .withConfigFile('./config/claude.yaml')
  .withRole('developer', {
    language: 'TypeScript',
    framework: 'React'
  })
  .query('Generate component')
  .asText();
```

#### Role System

Roles provide reusable configurations with:
- Model preferences
- Tool permissions
- Custom prompts with template variables
- Context settings (temperature, max tokens)
- Inheritance support

Example YAML config with roles:
```yaml
version: "1.0"

globalSettings:
  model: opus
  timeout: 60000

# Define reusable roles
roles:
  developer:
    model: sonnet
    tools:
      allowed: [Read, Write, Edit]
      denied: [Delete]
    prompts:
      prefix: "You are an expert ${language} developer using ${framework}."
    
  senior-developer:
    extends: developer  # Inherit from developer role
    model: opus
    permissions:
      mode: acceptEdits
    tools:
      allowed: [TodoRead, TodoWrite]  # Additional tools
```

```javascript
// Using roles with template variables
const response = await claude()
  .withRolesFile('./roles.yaml')
  .withRole('senior-developer', {
    language: 'TypeScript',
    framework: 'Next.js',
    specialty: 'performance optimization'
  })
  .query('Optimize this React component')
  .asText();
```

See [Roles Documentation](docs/NEW_FEATURES.md#rolespersonas-system) for complete details.

### Production Features

#### Token Usage & Costs
```javascript
const parser = await claude()
  .query('Complex task')
  .getParser();

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

#### Custom Models & Endpoints
```javascript
const response = await claude()
  .withModel('claude-3-opus-20240229')
  .withTimeout(30000)
  .query('Complex analysis')
  .asText();
```

## 🚀 Enhanced Features (v0.3.3)

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

try {
  const result = await withRetry(
    async () => claude().query('Complex task').asText(),
    {
      maxAttempts: 3,
      strategy: 'exponential',
      shouldRetry: (error) => {
        const errorType = detectErrorType(error.message);
        return ['network_error', 'timeout_error'].includes(errorType);
      }
    }
  );
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
- **[auth-example.js](./examples/auth-example.js)** - 🔐 **Authentication flow example**

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
  .allowTools(...tools: ToolName[])
  .denyTools(...tools: ToolName[])
  .skipPermissions()
  .withTimeout(ms: number)
  .inDirectory(path: string)
  .withSessionId(id: string)
  .withSignal(signal: AbortSignal)
  .withLogger(logger: Logger)
  .withConfigFile(path: string)
  .withRole(name: string, vars?: Record<string, string>)
  .onMessage(handler: (msg: Message) => void)
  .onAssistant(handler: (msg: AssistantMessage) => void)
  .onToolUse(handler: (tool: ToolUseBlock) => void)
  .query(prompt: string): ResponseParser
```

### Response Parser Methods

- `asText()` - Extract plain text
- `asJSON<T>()` - Parse JSON response
- `asResult()` - Get final result message
- `asToolExecutions()` - Get tool execution details
- `findToolResults(name)` - Find specific tool results
- `getUsage()` - Get token usage stats
- `getSessionId()` - Get session ID
- `stream(callback)` - Stream messages

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