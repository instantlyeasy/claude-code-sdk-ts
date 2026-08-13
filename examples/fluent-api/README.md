# Fluent API Examples

This directory contains comprehensive examples demonstrating the Claude Code SDK's fluent API. The fluent API provides a chainable, intuitive interface for building queries with type safety and excellent developer experience.

## Getting Started

### Prerequisites

1. Install the SDK:
```bash
npm install @instantlyeasy/claude-code-sdk-ts
```

2. Ensure Claude Code CLI is installed and configured:
```bash
claude --help
```

## Examples Overview

### Basic Examples

#### 1. Hello World (`hello-world.js`)
The simplest example to get started:
```javascript
import { claude } from '@instantlyeasy/claude-code-sdk-ts';

const result = await claude()
  .query('Say hello!')
  .asText();
```
**Run:** `node hello-world.js`

#### 2. Error Handling (`error-handling.js`)
Comprehensive error handling patterns including retry logic, graceful degradation, and debugging:
```javascript
// Graceful degradation with fallback models
async function queryWithFallback(prompt) {
  const models = ['opus', 'sonnet'];
  for (const model of models) {
    try {
      return await claude().withModel(model).query(prompt).asText();
    } catch (error) {
      console.warn(`${model} failed, trying next...`);
    }
  }
}
```
**Run:** `node error-handling.js`

### File and Code Operations

#### 3. File Operations (`file-operations.js`)
Safe file manipulation with permission controls:
```javascript
await claude()
  .allowTools('Read', 'Write', 'Edit')
  .acceptEdits()
  .inDirectory('./src')
  .query('Organize imports in all TypeScript files')
  .asText();
```
**Run:** `node file-operations.js [directory]`

#### 4. Code Analysis (`code-analysis.js`)
Analyze codebases and generate insights:
```javascript
const analysis = await claude()
  .withModel('opus')
  .allowTools('Read', 'Grep', 'Glob', 'LS')
  .query('Analyze the architecture and suggest improvements')
  .asJSON();
```
**Run:** `node code-analysis.js [project-path]`

### Interactive Applications

#### 5. Interactive Session (`interactive-session.js`)
Build conversational CLI applications:
```javascript
const session = claude()
  .withModel('sonnet')
  .onToolUse(tool => console.log(`🔧 Using: ${tool.name}`))
  .onMessage(msg => trackHistory(msg));

// Maintain conversation context
while (true) {
  const input = await getUserInput();
  const response = await session.query(input).asText();
  console.log(response);
}
```
**Run:** `node interactive-session.js [role]`

#### 6. Project Scaffolding (`project-scaffolding.js`)
Generate complete project structures:
```javascript
await claude()
  .withModel('opus')
  .allowTools('Write', 'LS', 'Bash')
  .acceptEdits()
  .query(`Create a ${framework} project with TypeScript, testing, and CI/CD`)
  .stream(handleProgress);
```
**Run:** `node project-scaffolding.js <framework> <project-name>`

#### 7. Web Research (`web-research.js`)
Research and learning assistant:
```javascript
const research = await claude()
  .withModel('opus')
  .query('Compare React, Vue, and Angular for enterprise applications')
  .asText();
```
**Run:** `node web-research.js [topic]`

### Advanced Features (`new-features/`)

The `new-features` directory contains examples of advanced SDK capabilities:

- **Token Streaming** - Real-time token-by-token streaming
- **Advanced Error Handling** - Typed errors and recovery strategies
- **Retry Strategies** - Exponential backoff, circuit breakers, and more

See [new-features/README.md](new-features/README.md) for details.

## Key Fluent API Features

### 1. Method Chaining
Build complex queries with readable chains:
```javascript
claude()
  .withModel('opus')
  .allowTools('Read', 'Write')
  .withTimeout(30000)
  .debug(true)
  .onMessage(console.log)
  .query('Build a REST API')
```

### 2. Response Formats
Choose the format that fits your needs:
```javascript
// Plain text
const text = await query.asText();

// Structured JSON
const data = await query.asJSON();

// Complete result with metadata
const result = await query.asResult();

// Tool execution results
const files = await query.findToolResults('Read');

// Streaming with callback
await query.stream(async (message) => {
  // Handle each message as it arrives
});

// All messages as an array
const messages = await query.asArray();
for (const msg of messages) {
  // Process messages one by one
}
```

### 3. Permission Management
Control tool usage with precision:
```javascript
claude()
  // Allow specific tools
  .allowTools('Read', 'Grep', 'LS')
  // Deny dangerous tools
  .denyTools('Bash', 'Write')
  // Skip permission prompts
  .skipPermissions()
  // Or accept all edits
  .acceptEdits()
```

### 4. Configuration and Roles
Use configuration files and predefined roles. Note that `withConfigFile()` and
`withRolesFile()` are **async** (they read and validate from disk), so each must
be awaited before you chain anything else:
```javascript
// Await the async file loaders first...
const builder = await claude().withConfigFile('./config.json');
await builder.withRolesFile('./roles.json');

// ...then apply a role and run the query.
// The role name must match one defined in your roles file
// (e.g. the shipped examples/config roles use `seniorDeveloper`).
const result = await builder
  .withRole('seniorDeveloper', {
    language: 'TypeScript',
    framework: 'Next.js'
  })
  .query('Review this pull request')
  .asText();
```

### 5. Event Handlers
React to messages as they stream in during execution:
```javascript
claude()
  .onMessage(msg => logger.log(msg))
  .onToolUse(tool => console.log(`Tool: ${tool.name}`))
  .onAssistant(content => updateUI(content))
```

### 6. Custom Logging
Integrate with your logging system:
```javascript
import { ConsoleLogger, LogLevel } from '@instantlyeasy/claude-code-sdk-ts';

claude()
  .withLogger(new ConsoleLogger(LogLevel.DEBUG))
  // Or use a custom logger
  .withLogger({
    info: (msg, ctx) => myLogger.info(msg, ctx),
    error: (msg, ctx) => myLogger.error(msg, ctx),
    warn: (msg, ctx) => myLogger.warn(msg, ctx),
    debug: (msg, ctx) => myLogger.debug(msg, ctx)
  })
```

## Best Practices

1. **Error Handling**: Always wrap queries in try-catch blocks
   ```javascript
   try {
     const result = await claude().query('...').asText();
   } catch (error) {
     // Handle specific error types
   }
   ```

2. **Use Appropriate Models**: Choose models based on task complexity
   - `sonnet` - Balanced performance, faster responses
   - `opus` - Complex reasoning and analysis, more thorough

3. **Stream Long Responses**: Better UX for lengthy outputs
   ```javascript
   await query.stream(async (msg) => {
     // Update UI progressively
   });
   ```

4. **Be Explicit with Permissions**: Security first
   ```javascript
   .allowTools('Read')  // Only what you need
   .denyTools('Bash')   // Explicitly deny dangerous tools
   ```

5. **Use Roles for Consistency**: Maintain behavior across queries
   ```javascript
   .withRole('code-reviewer')
   ```

## Advanced Patterns

### Retry with Exponential Backoff
```javascript
async function resilientQuery(prompt, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await claude().query(prompt).asText();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
    }
  }
}
```

### Session Management
```javascript
class ClaudeSession {
  constructor(role, model = 'sonnet') {
    this.builder = claude().withModel(model).withRole(role);
    this.history = [];
  }
  
  async query(prompt) {
    const result = await this.builder.query(prompt).asText();
    this.history.push({ prompt, result });
    return result;
  }
}
```

### Tool Usage Monitoring
```javascript
const toolUsage = new Map();

await claude()
  .onToolUse(tool => {
    toolUsage.set(tool.name, (toolUsage.get(tool.name) || 0) + 1);
  })
  .query('Analyze this codebase')
  .asText();

console.log('Tool usage statistics:', toolUsage);
```

## Troubleshooting

### Common Issues

1. **CLI Not Found**: Ensure Claude Code CLI is installed:
   ```bash
   claude --version
   ```

2. **Permission Denied**: Check tool permissions:
   ```javascript
   .allowTools('Read', 'Write')
   .skipPermissions() // For testing only
   ```

3. **Timeout Errors**: Increase timeout for complex tasks:
   ```javascript
   .withTimeout(60000) // 60 seconds
   ```

4. **Model Errors**: Verify model names:
   ```javascript
   .withModel('sonnet') // or 'opus'
   ```

## Additional Resources

- [SDK Documentation](../../README.md)
- [Fluent API Reference](../../docs/FLUENT_API.md)
- [Advanced Features](new-features/README.md)
- [Configuration Guide](../config/README.md)