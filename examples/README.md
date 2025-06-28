# Claude Code SDK Examples

This directory contains practical examples demonstrating various use cases for the Claude Code SDK TypeScript implementation.

## 📁 Directory Structure

- **`fluent-api/`** - Modern examples using the fluent API with method chaining
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
10. **[new-features-demo.js](./new-features-demo.js)** - MCP permissions, roles, and config files
11. **[enhanced-features-demo.js](./enhanced-features-demo.js)** - New enhanced features (v0.3.0)
12. **[production-features.js](./production-features.js)** - Production-ready features (AbortSignal, read-only mode, logging)
13. **[sessions.js](./sessions.js)** - Session management and conversation context

## 🚀 Getting Started

1. **Install the SDK:**
   ```bash
   npm install @instantlyeasy/claude-code-sdk-ts
   ```

2. **Install Claude CLI:**
   ```bash
   npm install -g @anthropic-ai/claude-code
   ```

3. **Authenticate:**
   ```bash
   claude login
   ```

4. **Run examples:**
   ```bash
   cd examples
   node hello-world.js
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

## 🆕 Enhanced Features (v0.3.0)

The SDK now includes several enhanced features based on early adopter feedback:

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

### 4. **OpenTelemetry Integration**
```javascript
const telemetryProvider = createTelemetryProvider();
const logger = telemetryProvider.getLogger('my-app');
const span = logger.startSpan('claude-query');
// ... your query
span.end();
```

### 5. **Exponential Backoff & Retry**
```javascript
const retryExecutor = createRetryExecutor({
  maxAttempts: 3,
  initialDelay: 1000,
  multiplier: 2
});

const result = await retryExecutor.execute(async () => {
  return await query('Your prompt');
});
```

See [enhanced-features-demo.js](./enhanced-features-demo.js) for a complete demonstration.

### 6. **Production Features**

See [production-features.js](./production-features.js) for:
- Cancellable queries with AbortSignal
- Read-only mode enforcement with `allowTools([])`
- Advanced logging with nested object support
- Message vs token streaming clarification

### 7. **Session Management**

See [sessions.js](./sessions.js) for:
- Session management with `getSessionId()` and `withSessionId()`
- Maintaining conversation context across multiple queries

## 📖 Additional Resources

- [Claude Code CLI Documentation](https://github.com/anthropics/claude-code)
- [SDK TypeScript Types](../src/types.ts)
- [Main README](../README.md)