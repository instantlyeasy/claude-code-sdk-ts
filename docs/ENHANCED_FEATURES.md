# Enhanced Features

This document provides comprehensive documentation for all the enhanced features available in the Claude Code SDK TypeScript library.

## Table of Contents

1. [Typed Error Handling](#typed-error-handling)
2. [Token-Level Streaming](#token-level-streaming)
3. [Retry Strategies](#retry-strategies)
4. [Per-Call Tool Permissions](#per-call-tool-permissions)
5. [MCP Server-Level Permissions](#mcp-server-level-permissions)
6. [Configuration File Support](#configuration-file-support)
7. [Roles and Personas System](#roles-and-personas-system)
8. [Response Parser Utilities](#response-parser-utilities)
9. [Advanced Logging Framework](#advanced-logging-framework)

## Typed Error Handling

The SDK provides a comprehensive typed error system that makes it easy to handle specific error scenarios gracefully.

### Error Types

- `RateLimitError` - API rate limit exceeded
- `ToolPermissionError` - Tool usage denied
- `AuthenticationError` - Authentication failed
- `NetworkError` - Network connectivity issues
- `TimeoutError` - Operation timeout
- `ValidationError` - Invalid input or parameters
- `APIError` - General API errors

### Basic Usage

```typescript
import { 
  claude,
  detectErrorType,
  isRateLimitError,
  isToolPermissionError,
  isAuthenticationError,
  isNetworkError,
  isTimeoutError,
  isValidationError
} from '@instantlyeasy/claude-code-sdk-ts';

try {
  const result = await claude()
    .query('Complex operation')
    .asText();
} catch (error) {
  // Automatic error type detection
  const errorType = detectErrorType(error.message);
  console.log('Error type:', errorType);
  
  // Type-specific handling
  if (isRateLimitError(error)) {
    console.log(`Rate limited. Retry after ${error.retryAfter} seconds`);
    await wait(error.retryAfter * 1000);
  } else if (isToolPermissionError(error)) {
    console.log(`Tool ${error.tool} is not allowed`);
  } else if (isNetworkError(error)) {
    console.log('Network issue. Check connection.');
  }
}
```

### Creating Typed Errors

```typescript
import { createTypedError } from '@instantlyeasy/claude-code-sdk-ts';

// createTypedError(errorType, message, originalError?) builds a typed error.
// Structured details (retryAfter, tool name, status code, ...) are PARSED FROM
// THE MESSAGE, not passed in. The optional 3rd argument is only { code?, stack? }
// used to preserve the original error's code/stack — it never sets those details.

// retryAfter is read from the message text (defaults to 60 if not present)
const rateLimitError = createTypedError(
  'rate_limit_error',
  'Rate limit exceeded, retry after 30 seconds'
);
// rateLimitError.retryAfter === 30

// The tool name is read from the message text (defaults to 'unknown')
const toolError = createTypedError(
  'tool_permission_error',
  'Tool: Bash permission denied'
);
// toolError.tool === 'Bash'
```

### Error Recovery Patterns

```typescript
async function queryWithErrorRecovery(prompt: string) {
  const maxRetries = 3;
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await claude().query(prompt).asText();
    } catch (error) {
      lastError = error;
      
      if (isRateLimitError(error)) {
        // Wait for rate limit to reset
        await new Promise(r => setTimeout(r, error.retryAfter * 1000));
      } else if (isNetworkError(error) && attempt < maxRetries) {
        // Exponential backoff for network errors
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
      } else {
        // Non-retryable error
        throw error;
      }
    }
  }
  
  throw lastError;
}
```

## Token-Level Streaming

Stream Claude's responses token by token for real-time display and better user experience.

### Basic Token Streaming

```typescript
import { claude, createTokenStream } from '@instantlyeasy/claude-code-sdk-ts';

// Create a message generator using queryRaw
const messageGenerator = claude()
  .withModel('sonnet')
  .queryRaw('Write a story about AI');

// Create token stream
const tokenStream = createTokenStream(messageGenerator);

// Stream tokens as they arrive
for await (const chunk of tokenStream.tokens()) {
  process.stdout.write(chunk.token);
}

// Get streaming metrics
const metrics = tokenStream.getMetrics();
console.log(`Tokens: ${metrics.tokensEmitted}, Duration: ${metrics.duration}ms`);
```

### Controlled Streaming

```typescript
const tokenStream = createTokenStream(messageGenerator);
const controller = tokenStream.getController();

let tokenCount = 0;
for await (const chunk of tokenStream.tokens()) {
  process.stdout.write(chunk.token);
  tokenCount++;
  
  // Pause after 10 tokens
  if (tokenCount === 10) {
    controller.pause();
    console.log('\nPaused. Resuming in 2 seconds...');
    
    setTimeout(() => {
      controller.resume();
    }, 2000);
  }
}
```

### Stream State Management

```typescript
const controller = tokenStream.getController();

// Check current state
console.log('State:', controller.getState()); // 'active' | 'paused' | 'aborted' | 'completed' | 'error'

// Control streaming
controller.pause();
controller.resume();
controller.abort('user cancelled'); // stops the stream (optional reason)

// Inspect controller flags
console.log('Paused?', controller.isPaused);
console.log('Aborted?', controller.isAborted);
console.log('Abort reason:', controller.abortReason);

// Pause / resume / abort fire on the CONTROLLER:
controller.on('pause', () => console.log('Stream paused'));
controller.on('resume', () => console.log('Stream resumed'));
controller.on('abort', () => console.log('Stream aborted'));

// token / complete / error / metrics fire on the token STREAM:
tokenStream.on('complete', () => console.log('Stream completed'));
tokenStream.on('error', (error) => console.error('Stream error:', error));

// The 'metrics' event fires alongside token/complete/error and carries the
// latest StreamMetrics (including the current `state`).
tokenStream.on('metrics', (metrics) => {
  console.log('State:', metrics.state, '| tokens:', metrics.tokensEmitted);
});
```

## Retry Strategies

Multiple retry strategies for handling transient failures and building resilient applications.

### Exponential Backoff

```typescript
import { createExponentialRetryExecutor } from '@instantlyeasy/claude-code-sdk-ts';

const retryExecutor = createExponentialRetryExecutor({
  maxAttempts: 4,
  initialDelay: 1000,     // Start with 1 second
  multiplier: 2,          // Double each time: 1s, 2s, 4s, 8s
  maxDelay: 10000,        // Cap at 10 seconds
  jitter: true            // Add randomization to prevent thundering herd
});

const result = await retryExecutor.execute(
  async () => {
    return await claude().query('Generate report').asText();
  },
  {
    onRetry: (attempt, error, nextDelay) => {
      console.log(`Retry ${attempt} in ${nextDelay}ms after: ${error.message}`);
    }
  }
);

// Get retry statistics (RetryExecutorStats)
const stats = retryExecutor.getStats();
const successes = stats.successfulFirstAttempts + stats.successfulRetries;
console.log(`Successes: ${successes}/${stats.totalExecutions} executions`);
console.log(`First-try successes: ${stats.successfulFirstAttempts}`);
console.log(`Recovered via retry: ${stats.successfulRetries}`);
console.log(`Failures: ${stats.totalFailures}`);
console.log(`Total retry attempts: ${stats.totalRetryAttempts}`);
console.log(`Average attempts: ${stats.averageAttempts}, max: ${stats.maxAttempts}`);
```

### Linear Retry

```typescript
import { createLinearRetryExecutor } from '@instantlyeasy/claude-code-sdk-ts';

const linearRetry = createLinearRetryExecutor({
  maxAttempts: 3,
  initialDelay: 2000,   // First retry waits 2 seconds
  increment: 2000,      // Add 2 seconds each subsequent attempt
  jitter: false         // No randomization
});

await linearRetry.execute(async () => {
  return await claude().query('Process data').asText();
});
```

### Fibonacci Retry

```typescript
import { createFibonacciRetryExecutor } from '@instantlyeasy/claude-code-sdk-ts';

const fibRetry = createFibonacciRetryExecutor({
  maxAttempts: 5,
  initialDelay: 1000,   // 1s, 1s, 2s, 3s, 5s...
  maxDelay: 8000        // Cap at 8 seconds
});

await fibRetry.execute(async () => {
  return await claude().query('Analyze data').asText();
});
```

### Retry Helper Function

`withRetry(fn, options)` returns a **wrapper function** — it does not run `fn`
itself. Call the returned function to execute with retries.

```typescript
import { withRetry, detectErrorType } from '@instantlyeasy/claude-code-sdk-ts';

// withRetry returns a wrapped function; it does NOT run fn until you call it.
const run = withRetry(
  async () => {
    return await claude().query('Generate code').asText();
  },
  {
    maxAttempts: 3,
    initialDelay: 500,
    shouldRetry: (error, attempt) => {
      // Custom retry logic
      const retryableErrors = ['network_error', 'timeout_error'];
      return retryableErrors.includes(detectErrorType(error.message));
    }
  }
);

const result = await run();

// Or as a single expression — note the extra () that invokes the wrapper:
const result2 = await withRetry(
  async () => claude().query('Generate code').asText(),
  { maxAttempts: 3, initialDelay: 500 }
)();
```

> Note: `withRetry` uses the exponential-backoff executor. `RetryOptions` has no
> `strategy` field (that belongs to the advanced executors). To choose a
> different backoff curve, use `createLinearRetryExecutor` /
> `createFibonacciRetryExecutor` instead.

## Per-Call Tool Permissions

Dynamic tool permission management for fine-grained control over tool usage.

`createPermissionManager(options, rolePermissions?)` takes a `ClaudeCodeOptions`
object (it reads `allowedTools` / `deniedTools` / `tools` from it) plus an
optional map of role-level tool permissions. Permission checks are resolved in
this priority order: query overrides → dynamic permissions → role permissions →
global (options) permissions → default (`allow`).

### Basic Permission Management

```typescript
import { createPermissionManager } from '@instantlyeasy/claude-code-sdk-ts';

// The first argument is a ClaudeCodeOptions object.
const permissionManager = createPermissionManager({
  allowedTools: ['Read', 'Grep', 'LS'],
  deniedTools: ['Bash', 'Write', 'Edit']
});

// isToolAllowed(tool, context, overrides?) — context is a QueryContext.
// It returns a Promise<boolean>.
const context = {
  prompt: 'Read the project files',
  timestamp: Date.now(),
  userRole: 'developer'
};

const canRead = await permissionManager.isToolAllowed('Read', context);   // true
const canBash = await permissionManager.isToolAllowed('Bash', context);   // false

// getEffectivePermissions(context, overrides?) returns a
// Promise<Map<ToolName, PermissionResolution>> — one resolution per known tool.
const effective = await permissionManager.getEffectivePermissions(context);
for (const [tool, resolution] of effective) {
  console.log(`${tool}: ${resolution.permission} (from ${resolution.source})`);
}
```

### Dynamic Permissions

Dynamic, per-call rules are supplied through the `overrides` argument (the third
parameter), not the constructor. Each dynamic function receives the
`QueryContext` and returns `'allow' | 'deny' | 'ask'`.

```typescript
const permissionManager = createPermissionManager({
  allowedTools: ['Read', 'Grep', 'LS'],
  deniedTools: ['Bash']
});

const isAllowed = await permissionManager.isToolAllowed(
  'Write',
  {
    prompt: 'Update the config file',
    timestamp: Date.now(),
    userRole: 'admin'
  },
  {
    // Dynamic permission based on context
    dynamicPermissions: {
      Write: async (context) => {
        // Allow writes during business hours to admins only
        const hour = new Date().getHours();
        const isBusinessHours = hour >= 9 && hour < 17;
        const isAdmin = context.userRole === 'admin';

        return (isBusinessHours && isAdmin) ? 'allow' : 'deny';
      }
    }
  }
);
```

### Auditing Permission Decisions

There is no permission-check callback option. Instead, every resolution is
recorded and can be read back for auditing via `getResolutionHistory()`.

```typescript
const permissionManager = createPermissionManager({
  allowedTools: ['Read', 'Grep', 'LS'],
  deniedTools: ['Bash', 'Write', 'Edit']
});

const context = { prompt: 'Analyze the repo', timestamp: Date.now(), userRole: 'developer' };
await permissionManager.isToolAllowed('Write', context);
await permissionManager.isToolAllowed('Read', context);

// Inspect each PermissionResolution that was made
for (const resolution of permissionManager.getResolutionHistory()) {
  console.log(`${resolution.tool} -> ${resolution.permission} (source: ${resolution.source})`);
}

// Clear the log when needed
permissionManager.clearHistory();
```

## MCP Server-Level Permissions

Manage permissions at the MCP (Model Context Protocol) server level for better security control.

### Basic Server Permissions

```typescript
// Set individual server permissions
const response = await claude()
  .withMCPServerPermission('file-system-mcp', 'whitelist')
  .withMCPServerPermission('database-mcp', 'ask')
  .withMCPServerPermission('external-api-mcp', 'blacklist')
  .query('Analyze the codebase')
  .asText();
```

### Bulk Server Permissions

```typescript
// Set multiple server permissions at once
const response = await claude()
  .withMCPServerPermissions({
    'file-system-mcp': 'whitelist',    // All tools allowed
    'git-mcp': 'whitelist',            // All tools allowed
    'database-mcp': 'ask',             // Ask for each tool
    'external-api-mcp': 'blacklist',   // All tools denied
    'npm-mcp': 'ask'
  })
  .query('Update dependencies')
  .asText();
```

### Server-Specific Tool Permissions

```typescript
// Fine-grained control per server
const config = {
  mcpServers: {
    'file-system-mcp': {
      defaultPermission: 'ask',
      tools: {
        'Read': 'allow',
        'Write': 'deny',
        'Edit': 'ask'
      }
    },
    'database-mcp': {
      defaultPermission: 'deny',
      tools: {
        'Query': 'ask',
        'Update': 'deny',
        'Delete': 'deny'
      }
    }
  }
};

await claude()
  .withConfig(config)
  .query('Read user data')
  .asText();
```

## Configuration File Support

Load complex configurations from external files for better maintainability.

### JSON Configuration

Create `config.json`:

```json
{
  "version": "1.0",
  "globalSettings": {
    "model": "opus",
    "timeout": 60000,
    "permissionMode": "acceptEdits",
    "cwd": "${HOME}/projects",
    "env": {
      "NODE_ENV": "production",
      "API_ENDPOINT": "${API_URL}"
    }
  },
  "mcpServers": {
    "file-system-mcp": {
      "defaultPermission": "allow",
      "tools": {
        "Write": "ask",
        "Delete": "deny"
      }
    }
  },
  "tools": {
    "allowed": ["Read", "Grep", "LS"],
    "denied": ["Bash"]
  }
}
```

Load and use:

```typescript
await claude()
  .withConfigFile('./config.json')
  .query('Process files')
  .asText();
```

### YAML Configuration

Create `config.yaml`:

```yaml
version: "1.0"
globalSettings:
  model: opus
  timeout: 60000
  permissionMode: acceptEdits
  temperature: 0.7
  maxTokens: 4000

mcpServers:
  file-system-mcp:
    defaultPermission: allow
    tools:
      Write: ask
      Delete: deny
  
  database-mcp:
    defaultPermission: ask

tools:
  allowed:
    - Read
    - Grep
    - LS
  denied:
    - Bash
    - WebSearch

# Environment variable substitution
env:
  AUTH_TOKEN: ${SECRET_AUTH_TOKEN}
  LOG_LEVEL: ${LOG_LEVEL:-info}
```

### Environment Variable Substitution

Configuration files support environment variable expansion:

```json
{
  "globalSettings": {
    "cwd": "${PROJECT_ROOT:-/default/path}",
    "env": {
      "AUTH_TOKEN": "${AUTH_TOKEN}",
      "DATABASE_URL": "${DATABASE_URL}"
    }
  }
}
```

## Roles and Personas System

Define comprehensive roles with specific permissions, models, and behaviors.

### Basic Role Definition

```typescript
const developerRole = {
  name: 'developer',
  description: 'Software developer with code access',
  model: 'opus',
  permissions: {
    mode: 'acceptEdits',
    tools: {
      allowed: ['Read', 'Write', 'Edit', 'Grep', 'LS'],
      denied: ['Delete']
    }
  },
  context: {
    temperature: 0.3,
    maxTokens: 4000
  }
};

await claude()
  .withRole(developerRole)
  .query('Refactor this code')
  .asText();
```

### Templated Roles

```typescript
const analystRole = {
  name: 'analyst',
  model: 'opus',
  permissions: {
    mode: 'default',
    tools: {
      allowed: ['Read', 'Query', 'Analyze'],
      denied: ['Write', 'Edit', 'Delete']
    }
  },
  promptingTemplate: 'You are a ${domain} analyst specializing in ${specialty}. Focus on ${focus}.',
  systemPrompt: 'Provide data-driven insights and actionable recommendations.',
  context: {
    temperature: 0.2
  }
};

// Use with template variables
await claude()
  .withRole(analystRole, {
    domain: 'financial',
    specialty: 'risk assessment',
    focus: 'market volatility'
  })
  .query('Analyze Q4 performance')
  .asText();
```

### Role Inheritance

```typescript
// roles.json
{
  "version": "1.0",
  "roles": {
    "baseUser": {
      "model": "sonnet",
      "permissions": {
        "mode": "default",
        "tools": {
          "allowed": ["Read"],
          "denied": ["Delete"]
        }
      }
    },
    "developer": {
      "extends": "baseUser",
      "model": "opus",
      "permissions": {
        "mode": "acceptEdits",
        "tools": {
          "allowed": ["Write", "Edit", "Grep"]
        }
      }
    },
    "seniorDeveloper": {
      "extends": "developer",
      "permissions": {
        "tools": {
          "allowed": ["Bash", "TodoWrite"]
        }
      },
      "context": {
        "maxTokens": 8000
      }
    }
  }
}
```

### Using Role Files

```typescript
// Load roles from file
await claude()
  .withRolesFile('./roles.json')
  .withRole('seniorDeveloper')
  .query('Implement new feature')
  .asText();

// Dynamic role selection
const userRole = getUserRole(); // 'developer' | 'analyst' | 'reviewer'
await claude()
  .withRolesFile('./roles.json')
  .withRole(userRole)
  .query('Review this PR')
  .asText();
```

## Response Parser Utilities

Enhanced utilities for parsing and extracting data from Claude's responses.

### Text Extraction

```typescript
// Get plain text from response
const text = await claude()
  .query('Explain quantum computing')
  .asText();
```

### JSON Parsing

```typescript
// Type-safe JSON parsing
interface UserData {
  name: string;
  email: string;
  preferences: {
    theme: string;
    notifications: boolean;
  };
}

const userData = await claude()
  .query('Generate sample user data as JSON')
  .asJSON<UserData>();

console.log(userData.name); // Type-safe access
```

### Tool Results Extraction

```typescript
// Find all results from a specific tool
const files = await claude()
  .query('Read all TypeScript files')
  .findToolResults('Read');

// Get first result only
const config = await claude()
  .query('Read the config file')
  .findToolResult('Read');
```

### Tool Execution Details

```typescript
// Get complete tool execution information
const executions = await claude()
  .query('Analyze and update files')
  .asToolExecutions();

executions.forEach(exec => {
  console.log(`Tool: ${exec.tool}`);
  console.log(`Input:`, exec.input);
  console.log(`Result:`, exec.result);
  console.log(`Error:`, exec.isError);
});
```

### Usage Statistics

```typescript
const usage = await claude()
  .query('Generate comprehensive report')
  .getUsage();

console.log('Token usage:', {
  input: usage.inputTokens,
  output: usage.outputTokens,
  total: usage.totalTokens,
  cacheHits: usage.cacheReadTokens,
  cacheWrites: usage.cacheCreationTokens
});

console.log(`Total cost: $${usage.totalCost.toFixed(4)}`);
```

### Custom Transformers

```typescript
// Transform messages with custom logic
const summary = await claude()
  .query('Analyze this codebase')
  .transform(messages => {
    const tools = new Set();
    let fileCount = 0;
    
    messages.forEach(msg => {
      if (msg.type === 'assistant') {
        msg.content.forEach(block => {
          if (block.type === 'tool_use') {
            tools.add(block.name);
            if (block.name === 'Read') fileCount++;
          }
        });
      }
    });
    
    return {
      toolsUsed: Array.from(tools),
      filesRead: fileCount,
      messageCount: messages.length
    };
  });
```

## Advanced Logging Framework

Flexible logging system with multiple implementations and custom handlers.

### Console Logger

```typescript
import { ConsoleLogger, LogLevel } from '@instantlyeasy/claude-code-sdk-ts';

const logger = new ConsoleLogger(LogLevel.DEBUG, '[MyApp]');

await claude()
  .withLogger(logger)
  .debug(true)
  .query('Debug this issue')
  .asText();
```

### JSON Logger

```typescript
import { JSONLogger, LogLevel } from '@instantlyeasy/claude-code-sdk-ts';
import fs from 'fs';

// Log to file as JSON
const jsonLogger = new JSONLogger(LogLevel.INFO, (json) => {
  fs.appendFileSync('app.log', json + '\n');
});

// Or send to logging service
const remoteLogger = new JSONLogger(LogLevel.WARN, async (json) => {
  await fetch('https://logs.example.com/ingest', {
    method: 'POST',
    body: json,
    headers: { 'Content-Type': 'application/json' }
  });
});
```

### Multi-Logger

```typescript
import { MultiLogger, ConsoleLogger, JSONLogger, LogLevel } from '@instantlyeasy/claude-code-sdk-ts';

const multiLogger = new MultiLogger([
  new ConsoleLogger(LogLevel.INFO),           // Console for INFO and above
  new JSONLogger(LogLevel.DEBUG, saveToFile), // File for all logs
  new JSONLogger(LogLevel.ERROR, sendToService) // Service for errors only
]);

await claude()
  .withLogger(multiLogger)
  .query('Process data')
  .asText();
```

### Custom Logger

```typescript
const customLogger = {
  info: (message: string, context?: any) => {
    myLoggingSystem.log('info', message, context);
  },
  error: (message: string, context?: any) => {
    myLoggingSystem.log('error', message, context);
    alertingSystem.notify(message);
  },
  warn: (message: string, context?: any) => {
    myLoggingSystem.log('warn', message, context);
  },
  debug: (message: string, context?: any) => {
    if (process.env.DEBUG) {
      myLoggingSystem.log('debug', message, context);
    }
  }
};

await claude()
  .withLogger(customLogger)
  .query('Analyze logs')
  .asText();
```

### Log Context

```typescript
// Add context to all logs
const contextualLogger = new ConsoleLogger(LogLevel.DEBUG);
contextualLogger.setContext({
  requestId: 'req-123',
  userId: 'user-456',
  environment: 'production'
});

// All logs will include this context
await claude()
  .withLogger(contextualLogger)
  .query('Process request')
  .asText();
```

## Best Practices

### 1. Error Handling
Always implement proper error handling with specific error types:

```typescript
try {
  const result = await claude().query('...').asText();
} catch (error) {
  if (isRateLimitError(error)) {
    // Handle rate limits
  } else if (isNetworkError(error)) {
    // Retry with backoff
  } else {
    // Log and handle unexpected errors
  }
}
```

### 2. Use Appropriate Features
- Use retry strategies for production reliability
- Configure permissions based on security requirements
- Use roles for consistent behavior

### 3. Performance Optimization
- Stream tokens for long responses
- Use caching when possible
- Configure appropriate timeouts
- Monitor token usage

### 4. Security
- Always validate permissions
- Use configuration files for sensitive data
- Implement audit logging
- Restrict tool access based on user roles

## Examples

See the [examples/fluent-api/new-features](../examples/fluent-api/new-features) directory for complete working examples of all enhanced features.