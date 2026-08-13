# Classic API Reference

This document covers the original async generator API syntax. For the recommended fluent API, see the main [README](../README.md).

## Basic Usage

```javascript
import { query } from '@instantlyeasy/claude-code-sdk-ts';

// Simple query
for await (const message of query('Say "Hello World!"')) {
  if (message.type === 'assistant') {
    for (const block of message.content) {
      if (block.type === 'text') {
        console.log(block.text);
      }
    }
  }
}
```

## With Options

```javascript
import { query, ClaudeCodeOptions } from '@instantlyeasy/claude-code-sdk-ts';

const options: ClaudeCodeOptions = {
  model: 'sonnet',
  allowedTools: ['Read', 'Write'],
  permissionMode: 'acceptEdits', // honored — maps to the CLI's --permission-mode
  cwd: '/Users/me/projects'
};

for await (const message of query('Analyze this codebase', options)) {
  switch (message.type) {
    case 'assistant':
      // Handle assistant messages
      for (const block of message.content) {
        if (block.type === 'text') {
          console.log('Assistant:', block.text);
        } else if (block.type === 'tool_use') {
          console.log('Tool:', block.name, block.input);
        }
      }
      break;
    
    case 'result':
      // Handle final result
      console.log('Result:', message.content);
      if (message.usage) {
        console.log('Tokens used:', message.usage);
      }
      break;
  }
}
```

## Error Handling

```javascript
try {
  for await (const message of query('Hello')) {
    // Process messages
  }
} catch (error) {
  if (error instanceof CLINotFoundError) {
    console.error('Please install Claude Code CLI first');
  } else if (error instanceof ClaudeSDKError) {
    console.error('SDK error:', error.message);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Tool Permissions

```javascript
// Allow specific tools
const options = {
  allowedTools: ['Read', 'Grep', 'LS']
};

// Deny specific tools
const options = {
  deniedTools: ['Bash', 'Write']
};

// Read-only mode (no tools)
const options = {
  allowedTools: []
};
```

## Session Management

The SDK now yields the `system`/init message, so you can read the session id from
its top-level `session_id` field (the id is also present on every other message,
so any message would do — `system` just arrives first):

```javascript
// First query
let sessionId;
for await (const message of query('Hello', { model: 'sonnet' })) {
  // session_id is a TOP-LEVEL field on the message (not message.data.session_id)
  if (message.type === 'system' && message.session_id) {
    sessionId = message.session_id;
  }
  // Process messages
}

// Continue conversation — pass the captured id back in via `sessionId`
// (mapped to the CLI's --resume flag).
for await (const message of query('What did I just say?', { 
  sessionId,
  model: 'sonnet' 
})) {
  // Claude remembers the previous context
}
```

## Message Types

### Assistant Message
```javascript
{
  type: 'assistant',
  content: [
    { type: 'text', text: 'Hello!' },
    { 
      type: 'tool_use', 
      id: 'tool-123',
      name: 'Read',
      input: { file_path: '/path/to/file' }
    }
  ]
}
```

### Tool Result

The CLI delivers `tool_result` blocks inside `user` messages (not `assistant`
messages), so check `message.type === 'user'` when scanning for them:

```javascript
{
  type: 'user',
  content: [
    {
      type: 'tool_result',
      tool_use_id: 'tool-123',
      content: 'File contents...',
      is_error: false
    }
  ]
}
```

### Result Message
```javascript
{
  type: 'result',
  content: 'Task completed successfully',
  usage: {
    input_tokens: 100,
    output_tokens: 50,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0
  },
  cost: {
    input_cost: 0.0003,
    output_cost: 0.0015,
    total_cost: 0.0018
  }
}
```

## Complete Example

```javascript
import { query } from '@instantlyeasy/claude-code-sdk-ts';

async function analyzeCode() {
  const options = {
    model: 'opus',
    allowedTools: ['Read', 'Grep', 'LS'],
    permissionMode: 'acceptEdits',
    cwd: process.cwd()
  };

  try {
    let fullResponse = '';
    let toolExecutions = [];

    for await (const message of query('Find all TODO comments', options)) {
      if (message.type === 'assistant') {
        // Assistant messages carry text and tool_use blocks.
        for (const block of message.content) {
          if (block.type === 'text') {
            fullResponse += block.text;
          } else if (block.type === 'tool_use') {
            toolExecutions.push({
              tool: block.name,
              input: block.input
            });
          }
        }
      } else if (message.type === 'user') {
        // tool_result blocks arrive inside user messages, not assistant ones.
        for (const block of message.content) {
          if (block.type === 'tool_result') {
            console.log(`Tool result:`, block.content);
          }
        }
      } else if (message.type === 'result') {
        console.log('Final result:', message.content);
        if (message.usage) {
          console.log('Token usage:', message.usage);
        }
      }
    }

    console.log('Full response:', fullResponse);
    console.log('Tools used:', toolExecutions);

  } catch (error) {
    console.error('Error:', error);
  }
}

analyzeCode();
```

## Migration to Fluent API

While the classic API continues to work, we recommend migrating to the fluent API for a better developer experience:

### Before (Classic):
```javascript
let text = '';
for await (const message of query('Generate a story')) {
  if (message.type === 'assistant') {
    for (const block of message.content) {
      if (block.type === 'text') {
        text += block.text;
      }
    }
  }
}
console.log(text);
```

### After (Fluent):
```javascript
const text = await claude()
  .query('Generate a story')
  .asText();
console.log(text);
```

See the main [README](../README.md) for the full fluent API documentation.