# Fluent API Documentation

The Claude Code SDK now includes a powerful fluent API that makes it easier to build and execute queries with a chainable interface.

## Table of Contents

- [Getting Started](#getting-started)
- [Query Builder](#query-builder)
- [Response Parser](#response-parser)
- [Session Management](#session-management)
- [Logging Framework](#logging-framework)
- [Advanced Patterns](#advanced-patterns)
- [Migration Guide](#migration-guide)

## Getting Started

The fluent API provides a more intuitive way to interact with Claude Code:

```typescript
import { claude } from '@instantlyeasy/claude-code-sdk-ts';

// Simple example
const response = await claude().withModel('sonnet').skipPermissions().query('Hello, Claude!').asText();
```

## Query Builder

The `QueryBuilder` class provides chainable methods for configuring your query:

### Model Configuration

```typescript
claude()
  .withModel('opus') // or 'sonnet', 'haiku'
  .withTimeout(60000) // 60 seconds
  .debug(true); // Enable debug mode
```

### Tool Management

```typescript
claude()
  .allowTools('Read', 'Write', 'Edit') // Explicitly allow tools
  .denyTools('Bash', 'WebSearch'); // Explicitly deny tools
```

### Permissions

```typescript
claude()
  .skipPermissions() // Bypass all permission prompts
  .acceptEdits() // Auto-accept file edits
  .withPermissions('default'); // Use default permission handling
```

### Environment Configuration

```typescript
claude().inDirectory('/path/to/project').withEnv({ NODE_ENV: 'production' });
```

### MCP Servers

```typescript
claude().withMCP({ command: 'mcp-server-filesystem', args: ['--readonly'] }, { command: 'mcp-server-git' });
```

### Event Handlers

```typescript
claude()
  .onMessage(msg => console.log('Message:', msg.type))
  .onAssistant(content => console.log('Assistant says...'))
  .onToolUse(tool => console.log(`Using ${tool.name}`));
```

## Response Parser

The `ResponseParser` provides multiple ways to extract data from Claude's responses:

### Basic Parsing Methods

```typescript
const parser = claude().query('Your prompt');

// Get raw text
const text = await parser.asText();

// Get final result
const result = await parser.asResult();

// Get all messages
const messages = await parser.asArray();
```

### Structured Data Extraction

```typescript
// Extract JSON from response
const data = await parser.asJSON<MyInterface>();

// Get tool execution details
const executions = await parser.asToolExecutions();

// Find specific tool results
const fileContents = await parser.findToolResults('Read');
const firstFile = await parser.findToolResult('Read');
```

### Usage Statistics

```typescript
const usage = await parser.getUsage();
console.log(`Tokens: ${usage.totalTokens}`);
console.log(`Cost: $${usage.totalCost}`);
```

### Streaming

```typescript
await parser.stream(async message => {
  if (message.type === 'assistant') {
    // Handle streaming content
  }
});
```

### Error Handling

```typescript
const success = await parser.succeeded();
const errors = await parser.getErrors();
```

### Custom Transformations

```typescript
const customData = await parser.transform(messages => {
  // Your custom logic
  return processMessages(messages);
});
```

## Session Management

Sessions allow you to maintain conversation context across multiple queries. Claude remembers previous parts of the conversation, enabling more coherent multi-turn interactions.

### Basic Session Pattern

```typescript
// Start a conversation and get the session ID
const builder = claude().withModel('sonnet').skipPermissions();
const parser = builder.query('Tell me a random number between 1 and 100');

const sessionId = await parser.getSessionId();
const firstResponse = await parser.asText();

// Continue the conversation using the session ID
const secondResponse = await builder.withSessionId(sessionId).query('What number did you pick?').asText();

console.log('First:', firstResponse); // "I picked 42"
console.log('Second:', secondResponse); // "I picked 42" (remembers the context)
```

### Session ID Extraction

Get the session ID from any completed query:

```typescript
const parser = claude().query('Hello, I am working on a project about renewable energy');

// Extract session ID for later use
const sessionId = await parser.getSessionId();
const greeting = await parser.asText();

// Store the session ID for later conversations
localStorage.setItem('claude-session', sessionId);
```

### Continuing Sessions

Use stored session IDs to resume conversations:

```typescript
// Retrieve stored session ID
const sessionId = localStorage.getItem('claude-session');

if (sessionId) {
  const response = await claude().withSessionId(sessionId).query('Can you remind me what we were discussing?').asText();

  console.log(response); // "We were discussing renewable energy projects..."
}
```

### Session Branching

Create multiple conversation branches from the same starting point:

```typescript
const builder = claude().withModel('sonnet').skipPermissions();

// Establish initial context
const initialParser = builder.query('I need help with a JavaScript project');
const sessionId = await initialParser.getSessionId();
await initialParser.asText();

// Branch 1: Focus on architecture
const architectureResponse = await builder
  .withSessionId(sessionId)
  .query('What architecture patterns should I consider?')
  .asText();

// Branch 2: Focus on testing (same starting context)
const testingResponse = await builder
  .withSessionId(sessionId)
  .query('What testing frameworks would you recommend?')
  .asText();
```

### Classic API with Sessions

You can also use sessions with the original query function:

```typescript
import { query } from '@instantlyeasy/claude-code-sdk-ts';

// Use sessionId in options
const options = {
  sessionId: 'your-session-id',
  model: 'sonnet',
  permissionMode: 'bypassPermissions'
};

for await (const message of query('Continue our conversation', options)) {
  if (message.type === 'assistant') {
    // Handle response with maintained context
  }
}
```

## Logging Framework

The SDK includes a pluggable logging system:

### Built-in Loggers

```typescript
import { ConsoleLogger, JSONLogger, LogLevel } from '@instantlyeasy/claude-code-sdk-ts';

// Console logger with custom prefix
const logger = new ConsoleLogger(LogLevel.DEBUG, '[MyApp]');

// JSON logger for structured logging
const jsonLogger = new JSONLogger(LogLevel.INFO);

// Use with QueryBuilder
claude().withLogger(logger).query('...');
```

### Custom Logger Implementation

```typescript
import { Logger, LogEntry } from '@instantlyeasy/claude-code-sdk-ts';

class CustomLogger implements Logger {
  log(entry: LogEntry): void {
    // Send to your logging service
    myLoggingService.send({
      level: LogLevel[entry.level],
      message: entry.message,
      timestamp: entry.timestamp,
      ...entry.context
    });
  }

  // Implement convenience methods
  error(message: string, context?: Record<string, any>): void {
    this.log({ level: LogLevel.ERROR, message, timestamp: new Date(), context });
  }

  // ... implement warn, info, debug, trace
}
```

### Multi-Logger

```typescript
import { MultiLogger, ConsoleLogger, JSONLogger } from '@instantlyeasy/claude-code-sdk-ts';

const multiLogger = new MultiLogger([
  new ConsoleLogger(LogLevel.INFO),
  new JSONLogger(LogLevel.DEBUG, line => fs.appendFileSync('app.log', line + '\n'))
]);
```

## Advanced Patterns

### Retry Logic

```typescript
async function queryWithRetry(prompt: string, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await claude().withTimeout(30000).query(prompt).asText();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
    }
  }
}
```

### Conditional Tool Selection

```typescript
function createQuery(options: { readonly?: boolean }) {
  const builder = claude();

  if (options.readonly) {
    builder.allowTools('Read', 'Grep', 'Glob').denyTools('Write', 'Edit');
  } else {
    builder.allowTools('Read', 'Write', 'Edit');
  }

  return builder;
}
```

### Response Caching

```typescript
const cache = new Map();

async function cachedQuery(prompt: string) {
  const cacheKey = `${prompt}:${(Date.now() / 60000) | 0}`; // 1-minute cache

  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const result = await claude().query(prompt).asText();

  cache.set(cacheKey, result);
  return result;
}
```

## Migration Guide

### From Original API to Fluent API

The original API still works and is fully supported:

```typescript
// Original API
import { query } from '@instantlyeasy/claude-code-sdk-ts';

for await (const message of query('Hello', { model: 'sonnet' })) {
  // Process messages
}

// Fluent API equivalent
import { claude } from '@instantlyeasy/claude-code-sdk-ts';

await claude()
  .withModel('sonnet')
  .query('Hello')
  .stream(async message => {
    // Process messages
  });
```

### Common Migration Patterns

1. **Simple text extraction**:

```typescript
// Before
let text = '';
for await (const message of query('Generate text')) {
  if (message.type === 'assistant') {
    for (const block of message.content) {
      if (block.type === 'text') {
        text += block.text;
      }
    }
  }
}

// After
const text = await claude().query('Generate text').asText();
```

2. **Tool result extraction**:

```typescript
// Before
const results = [];
for await (const message of query('Read files', { allowedTools: ['Read'] })) {
  if (message.type === 'assistant') {
    for (const block of message.content) {
      if (block.type === 'tool_result' && !block.is_error) {
        results.push(block.content);
      }
    }
  }
}

// After
const results = await claude().allowTools('Read').query('Read files').findToolResults('Read');
```

3. **Error handling**:

```typescript
// Before
try {
  for await (const message of query('Do something')) {
    // Process and check for errors manually
  }
} catch (error) {
  console.error('Failed:', error);
}

// After
const parser = claude().query('Do something');
const success = await parser.succeeded();
if (!success) {
  const errors = await parser.getErrors();
  console.error('Failed:', errors);
}
```

The fluent API is designed to reduce boilerplate while maintaining the full power of the original API. You can mix and match approaches as needed for your use case.
