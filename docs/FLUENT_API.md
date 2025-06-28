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
const response = await claude()
  .withModel('sonnet')
  .skipPermissions()
  .query('Hello, Claude!')
  .asText();
```

## Query Builder

The `QueryBuilder` class provides chainable methods for configuring your query:

### Model Configuration

```typescript
claude()
  .withModel('opus')        // or 'sonnet'
  .withTimeout(60000)       // 60 seconds
  .debug(true)              // Enable debug mode
```

### Tool Management

```typescript
claude()
  .allowTools('Read', 'Write', 'Edit')    // Explicitly allow tools
  .denyTools('Bash', 'WebSearch')         // Explicitly deny tools
  .allowTools([])                         // Empty array = read-only mode (denies all tools)
```

### Permissions

```typescript
claude()
  .skipPermissions()        // Bypass all permission prompts
  .acceptEdits()           // Auto-accept file edits
  .withPermissions('default')  // Use default permission handling
```

### Environment Configuration

```typescript
claude()
  .inDirectory('/path/to/project')
  .withEnv({ NODE_ENV: 'production' })
```

### Directory Context

```typescript
claude()
  .addDirectory('/path/to/dir')          // Add single directory
  .addDirectory(['../apps', '../lib'])   // Add multiple directories
  .addDirectory('/another/dir')          // Accumulate with multiple calls
```

The `addDirectory` method allows you to add additional working directories for Claude to access:

- **Single directory**: Pass a string path
- **Multiple directories**: Pass an array of string paths
- **Accumulative**: Multiple calls to `addDirectory` will accumulate all directories
- **CLI mapping**: Generates `--add-dir` flag with space-separated paths

### MCP Servers

```typescript
claude()
  .withMCP(
    { command: 'mcp-server-filesystem', args: ['--readonly'] },
    { command: 'mcp-server-git' }
  )
```

### Event Handlers

```typescript
claude()
  .onMessage(msg => console.log('Message:', msg.type))
  .onAssistant(content => console.log('Assistant says...'))
  .onToolUse(tool => console.log(`Using ${tool.name}`))
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

**Important Note**: This SDK streams **complete messages**, not individual tokens. Each assistant message contains the full text block, not incremental updates.

```typescript
await parser.stream(async (message) => {
  if (message.type === 'assistant') {
    // Each message contains complete text, not token-by-token updates
    console.log(message.content[0].text); // Full text block
  }
});
```

### Cancellation with AbortSignal

```typescript
import { claude, AbortError } from '@instantlyeasy/claude-code-sdk-ts';

const controller = new AbortController();

const parser = claude()
  .withSignal(controller.signal)
  .query('Long running query');

// Cancel after 5 seconds
setTimeout(() => controller.abort(), 5000);

try {
  await parser.stream(async (message) => {
    // Process messages
  });
} catch (error) {
  if (error instanceof AbortError) {
    console.log('Query was cancelled');
  } else {
    throw error;
  }
}
```

**Note**: Due to how Node.js handles child process aborts, you may see "AbortError" warnings in the console. These can be safely ignored. The SDK properly throws `AbortError` instances that you can catch.

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

The SDK provides built-in support for maintaining conversation context across multiple queries using session IDs:

### Basic Session Usage

```typescript
// First query - start a new session
const parser = claude()
  .withModel('sonnet')
  .query('Remember this number: 42');

// Get the session ID for later use
const sessionId = await parser.getSessionId();
const firstResponse = await parser.asText();

// Continue the conversation in the same session
const followUp = await claude()
  .withModel('sonnet')
  .withSessionId(sessionId)
  .query('What number did I ask you to remember?')
  .asText();

console.log(followUp); // Claude will remember "42"
```

### Session Pattern for Complex Workflows

```typescript
async function interactiveSession() {
  const builder = claude()
    .withModel('opus')
    .skipPermissions();
  
  // Initial context setup
  const parser = builder.query('You are helping me refactor a codebase. Start by analyzing the current structure.');
  const sessionId = await parser.getSessionId();
  await parser.asText();
  
  // Continue with multiple related tasks
  const analysis = await builder
    .withSessionId(sessionId)
    .query('What are the main issues you found?')
    .asText();
  
  const plan = await builder
    .withSessionId(sessionId)
    .query('Create a refactoring plan to address these issues')
    .asText();
  
  const implementation = await builder
    .withSessionId(sessionId)
    .allowTools('Read', 'Write', 'Edit')
    .query('Implement the first step of the refactoring plan')
    .asResult();
  
  return { sessionId, analysis, plan, implementation };
}
```

### Session Best Practices

1. **Store session IDs**: Save session IDs if you need to resume conversations later
2. **Context preservation**: Sessions maintain full conversation history
3. **Tool state**: File changes and tool usage are preserved within a session
4. **Session expiration**: Sessions may expire after a period of inactivity

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
claude()
  .withLogger(logger)
  .query('...');
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
      return await claude()
        .withTimeout(30000)
        .query(prompt)
        .asText();
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
  const cacheKey = `${prompt}:${Date.now() / 60000 | 0}`; // 1-minute cache
  
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }
  
  const result = await claude()
    .query(prompt)
    .asText();
  
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
  .stream(async (message) => {
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
const text = await claude()
  .query('Generate text')
  .asText();
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
const results = await claude()
  .allowTools('Read')
  .query('Read files')
  .findToolResults('Read');
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