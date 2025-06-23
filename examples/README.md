# Claude Code SDK Examples

This directory contains practical examples demonstrating various use cases for the Claude Code SDK TypeScript implementation.

## 📚 Examples Overview

### 1. [hello-world.js](./hello-world.js)
The simplest possible example - asking Claude to say "Hello World!"

```bash
node examples/hello-world.js
```

### 2. [file-operations.js](./file-operations.js)
Demonstrates file creation, reading, and editing operations.

```bash
node examples/file-operations.js
```

### 3. [code-analysis.js](./code-analysis.js)
Shows how to analyze code, find patterns, and identify areas for improvement.

```bash
node examples/code-analysis.js
```

### 4. [interactive-session.js](./interactive-session.js)
Creates an interactive CLI session where you can chat with Claude and execute various commands.

```bash
node examples/interactive-session.js
```

### 5. [web-research.js](./web-research.js)
Demonstrates using Claude's web search and fetch capabilities for research tasks.

```bash
node examples/web-research.js
```

### 6. [project-scaffolding.js](./project-scaffolding.js)
Shows how to use Claude to create complete project structures with best practices.

```bash
node examples/project-scaffolding.js
```

### 7. [error-handling.js](./error-handling.js)
Comprehensive error handling examples and patterns for robust applications.

```bash
node examples/error-handling.js
```

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

### Session Management

Sessions allow you to maintain conversation context across multiple queries:

#### Using getSessionId() and withSessionId()

```javascript
import { claude } from '@instantlyeasy/claude-code-sdk-ts';

const builder = claude().withModel('sonnet').skipPermissions();

// First query establishes the session
const parser = builder.query('Tell me a number between 1 and 100');
const sessionId = await parser.getSessionId();
const firstResponse = await parser.asText();

// Continue the conversation with session context
const secondResponse = await builder.withSessionId(sessionId).query('Which number did you pick?').asText();
```

#### Using withSession()

```javascript
import { claude } from '@instantlyeasy/claude-code-sdk-ts';

const session = claude().withModel('sonnet').skipPermissions().withSession();

// All queries automatically maintain session context
const firstCard = await session.query('Pick a random card').asText();
const secondCard = await session.query('Which card did you pick?').asText();
```

#### Classic API with sessionId option

```javascript
const options = {
  sessionId: 'existing-session-id',
  permissionMode: 'bypassPermissions'
};

for await (const message of query('Continue our conversation', options)) {
  // Handle messages with maintained context
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

See [sessions.js](./sessions.js) for:

- Session management with `getSessionId()` and `withSessionId()`
- Using the `withSession()` method for automatic session handling
- Maintaining conversation context across multiple queries

## 📖 Additional Resources

- [Claude Code CLI Documentation](https://github.com/anthropics/claude-code)
- [SDK TypeScript Types](../src/types.ts)
- [Main README](../README.md)
