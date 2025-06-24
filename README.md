# Claude Code SDK for TypeScript

[![npm version](https://badge.fury.io/js/@instantlyeasy%2Fclaude-code-sdk-ts.svg)](https://www.npmjs.com/package/@instantlyeasy/claude-code-sdk-ts)
[![npm downloads](https://img.shields.io/npm/dm/@instantlyeasy/claude-code-sdk-ts.svg)](https://www.npmjs.com/package/@instantlyeasy/claude-code-sdk-ts)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js Version](https://img.shields.io/node/v/@instantlyeasy/claude-code-sdk-ts.svg)](https://nodejs.org/)

Unofficial TypeScript port of the official Python Claude Code SDK for [Claude Code](https://github.com/anthropics/claude-code), the CLI tool for interacting with Claude.

> **Note**: This is a community-maintained TypeScript port. For the official Python SDK, see [claude-code-sdk](https://github.com/anthropics/claude-code-sdk).

## Installation

```bash
npm install @instantlyeasy/claude-code-sdk-ts
# or
yarn add @instantlyeasy/claude-code-sdk-ts
# or
pnpm add @instantlyeasy/claude-code-sdk-ts
```

**Prerequisites:**

- Node.js 18 or later
- Claude Code CLI installed (`npm install -g @anthropic-ai/claude-code`)

## Quick Start

### New Fluent API (Recommended)

The SDK now includes a powerful fluent API that makes common tasks easier:

```javascript
import { claude } from '@instantlyeasy/claude-code-sdk-ts';

// Simple Hello World
const response = await claude().withModel('sonnet').skipPermissions().query('Say "Hello World!"').asText();

console.log(response); // Outputs: Hello World!
```

### File Operations with Fluent API

```javascript
import { claude } from '@instantlyeasy/claude-code-sdk-ts';

// Create a file with automatic result extraction
const result = await claude()
  .allowTools('Write')
  .skipPermissions()
  .query('Create a hello.txt file with "Hello from Claude!"')
  .asResult();

console.log('Task completed:', result);

// Read and parse JSON data
const config = await claude().allowTools('Read').query('Read package.json and return its content').asJSON();

console.log('Version:', config.version);
```

### Session Management

Maintain conversation context across multiple queries with built-in session handling:

```javascript
import { claude } from '@instantlyeasy/claude-code-sdk-ts';

// Session management with explicit session ID
const builder = claude().withModel('sonnet').skipPermissions();
const parser = builder.query('Pick a random number from 1-100');
const sessionId = await parser.getSessionId();
const firstResponse = await parser.asText();
const secondResponse = await builder.withSessionId(sessionId).query('What number did you pick?').asText();
// Claude remembers the number from the first query

// Manual session management
const builder = claude().withModel('sonnet').skipPermissions();
const parser = builder.query('Tell me a fun fact');
const sessionId = await parser.getSessionId();
const fact = await parser.asText();

// Continue conversation with session ID
const follow = await builder.withSessionId(sessionId).query('Tell me more about that topic').asText();
```

### Advanced Features

```javascript
import { claude, ConsoleLogger, LogLevel } from '@instantlyeasy/claude-code-sdk-ts';

// Full example with logging, event handlers, and response parsing
const logger = new ConsoleLogger(LogLevel.DEBUG);

const analysis = await claude()
  .withModel('opus')
  .allowTools('Read', 'Grep', 'Glob')
  .inDirectory(process.cwd())
  .withLogger(logger)
  .onToolUse(tool => console.log(`Using ${tool.name}...`))
  .query('Find all TODO comments in the codebase')
  .asToolExecutions();

// Get detailed tool execution results
for (const execution of analysis) {
  console.log(`${execution.tool}: ${execution.isError ? 'Failed' : 'Success'}`);
}
```

### Classic API (Original Syntax)

The original async generator API is still fully supported:

```javascript
import { query } from '@instantlyeasy/claude-code-sdk-ts';

// Simple Hello World
for await (const message of query('Say "Hello World!"')) {
  if (message.type === 'assistant') {
    for (const block of message.content) {
      if (block.type === 'text') {
        console.log(block.text); // Outputs: Hello World!
      }
    }
  }
}
```

## Authentication

This SDK delegates all authentication to the Claude CLI. There are two ways to authenticate:

### 1. Claude Pro/Max Account (Recommended)

```bash
# One-time setup - login with your Claude account
claude login
```

### 2. API Key (If supported by your Claude CLI version)

The Claude CLI may support API key authentication in some configurations. Check your Claude CLI documentation.

**Important**: The SDK does not handle authentication directly. If you see authentication errors, you need to authenticate using the Claude CLI first.

## API Reference

### Fluent API

#### `claude(): QueryBuilder`

Creates a new query builder for the fluent API.

```typescript
const builder = claude()
  .withModel('sonnet') // Set model
  .allowTools('Read', 'Write') // Configure tools
  .skipPermissions() // Skip permission prompts
  .withTimeout(30000) // Set timeout
  .inDirectory('/path') // Set working directory
  .withLogger(logger) // Add logging
  .onMessage(handler) // Add event handlers
  .withSessionId('session-id') // Continue existing session
  .query('Your prompt'); // Execute query
```

#### Response Parsing Methods

- `.asText()` - Extract plain text from assistant messages
- `.asJSON<T>()` - Parse JSON from the response
- `.asResult()` - Get the final result message
- `.asToolExecutions()` - Get all tool executions with results
- `.findToolResults(toolName)` - Find results from specific tool
- `.getUsage()` - Get token usage and cost statistics
- `.stream(callback)` - Stream messages with a callback

### Classic API

#### `query(prompt: string, options?: ClaudeCodeOptions): AsyncGenerator<Message>`

Query Claude Code with a prompt and options.

##### Parameters

- `prompt` (string): The prompt to send to Claude Code
- `options` (ClaudeCodeOptions, optional): Configuration options

##### Returns

An async generator that yields `Message` objects.

### Types

#### `ClaudeCodeOptions`

```typescript
interface ClaudeCodeOptions {
  // Model selection
  model?: string; // Claude model to use (e.g., 'opus', 'sonnet')

  // Tool configuration
  allowedTools?: ToolName[]; // Explicitly allowed tools
  deniedTools?: ToolName[]; // Explicitly denied tools

  // Permission handling
  permissionMode?: PermissionMode; // 'default' | 'acceptEdits' | 'bypassPermissions'

  // Session management
  sessionId?: string; // Existing session ID to continue conversation

  // Execution environment
  cwd?: string; // Working directory
  env?: Record<string, string>; // Environment variables

  // MCP (Model Context Protocol) servers
  mcpServers?: MCPServer[]; // MCP servers to connect

  // SDK options
  timeout?: number; // Timeout in milliseconds
  debug?: boolean; // Enable debug logging (Note: may interfere with JSON parsing)

  // Deprecated options (not used by CLI transport)
  apiKey?: string; // Use `claude login` instead
  baseUrl?: string; // Not applicable for CLI
  maxTokens?: number; // Not configurable via CLI
  temperature?: number; // Not configurable via CLI
  tools?: ToolName[]; // Use allowedTools/deniedTools instead
  context?: string[]; // Not implemented
}
```

#### `Message`

```typescript
type Message = UserMessage | AssistantMessage | SystemMessage | ResultMessage;

interface UserMessage {
  type: 'user';
  content: string;
}

interface AssistantMessage {
  type: 'assistant';
  content: ContentBlock[];
}

interface SystemMessage {
  type: 'system';
  content: string;
}

interface ResultMessage {
  type: 'result';
  content: string;
  usage?: UsageInfo;
  cost?: CostInfo;
}
```

#### `ContentBlock`

```typescript
type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;

interface TextBlock {
  type: 'text';
  text: string;
}

interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string | Array<TextBlock | unknown>;
  is_error?: boolean;
}
```

## New Features in v0.2.0

### 🎯 Fluent API

A chainable API that reduces boilerplate and improves readability:

- Method chaining for configuration
- Automatic response parsing
- Built-in event handlers
- Type-safe throughout

### 📊 Response Parsers

Extract exactly what you need from Claude's responses:

- Text extraction with `.asText()`
- JSON parsing with `.asJSON<T>()`
- Tool execution analysis
- Usage statistics and costs

### 📝 Logging Framework

Pluggable logging system for better debugging:

- Multiple log levels (ERROR, WARN, INFO, DEBUG, TRACE)
- Console and JSON loggers included
- Custom logger support
- Multi-logger for sending to multiple destinations

## Examples

Check out the [examples directory](./examples) for complete, runnable examples including:

- **[fluent-api-demo.js](./examples/fluent-api-demo.js)** - Comprehensive showcase of the new fluent API
- **[response-parsing-demo.js](./examples/response-parsing-demo.js)** - Advanced response parsing techniques
- **[sessions.js](./examples/sessions.js)** - Session management and conversation context
- Hello World (both classic and fluent syntax)
- File operations
- Code analysis
- Interactive sessions
- Web research
- Project scaffolding
- Error handling

For detailed documentation on the fluent API, see [docs/FLUENT_API.md](./docs/FLUENT_API.md).

## Migrating to Fluent API

The fluent API dramatically reduces boilerplate code. Here are some common migration patterns:

### Before (Classic API):

```javascript
let fullText = '';
for await (const message of query('Generate a story')) {
  if (message.type === 'assistant') {
    for (const block of message.content) {
      if (block.type === 'text') {
        fullText += block.text;
      }
    }
  }
}
console.log(fullText);
```

### After (Fluent API):

```javascript
const fullText = await claude().query('Generate a story').asText();
console.log(fullText);
```

More migration examples in [docs/FLUENT_API.md#migration-guide](./docs/FLUENT_API.md#migration-guide).

## Error Handling

```typescript
import { query, ClaudeSDKError, CLINotFoundError } from '@instantlyeasy/claude-code-sdk-ts';

try {
  for await (const message of query('Hello')) {
    console.log(message);
  }
} catch (error) {
  if (error instanceof CLINotFoundError) {
    console.error('Please install Claude Code CLI first:');
    console.error('npm install -g @anthropic-ai/claude-code');
  } else if (error instanceof ClaudeSDKError) {
    console.error('SDK error:', error.message);
  } else if (error.message?.includes('Invalid API key')) {
    console.error('Authentication required. Please run: claude login');
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Development

```bash
# Install dependencies
npm install

# Build the SDK
npm run build

# Run tests
npm test

# Type checking
npm run typecheck

# Linting
npm run lint
```

## Changelog

### v0.2.0 (Latest) 🚀

**New Features:**

- ✨ **Fluent API**: New chainable API with `claude()` for improved developer experience
- 📊 **Response Parsers**: Built-in methods for extracting text, JSON, and tool results
- 📝 **Logging Framework**: Pluggable logging system with multiple implementations
- 🔧 **Event Handlers**: `onMessage()`, `onAssistant()`, and `onToolUse()` callbacks
- 📈 **Usage Statistics**: Get token counts and cost information with `.getUsage()`

**Improvements:**

- 100% backward compatible - existing code continues to work
- Comprehensive TypeScript support throughout
- Extensive test coverage for all new features
- New examples demonstrating fluent API patterns

### v0.1.4

- Include examples in npm package

### v0.1.2

- Fixed CLI command search to properly find `claude` command
- Removed unsupported authentication flags (CLI handles auth internally)
- Improved error messages for authentication failures
- Updated documentation to clarify authentication flow

### v0.1.1

- Added `--print` flag for non-interactive mode
- Fixed CLI path resolution
- Initial TypeScript error fixes

### v0.1.0

- Initial release
- TypeScript port of official Python SDK
- Full support for Claude Code CLI features

## License

MIT
