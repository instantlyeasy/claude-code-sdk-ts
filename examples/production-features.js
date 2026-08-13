import { claude, ConsoleLogger, JSONLogger, LogLevel } from '@instantlyeasy/claude-code-sdk-ts';

// Example 1: Cancellation with AbortSignal
async function cancellableQueryExample() {
  console.log('=== Cancellable Query Example ===\n');
  
  const controller = new AbortController();
  
  // Cancel after 3 seconds
  setTimeout(() => {
    console.log('Cancelling query...');
    controller.abort();
  }, 3000);
  
  try {
    const response = await claude()
      .withModel('sonnet')
      .skipPermissions()
      .withSignal(controller.signal)
      .query('Write a very long essay about the history of computing')
      .asText();
      
    console.log('Response:', response);
  } catch (error) {
    if (controller.signal.aborted) {
      console.log('✅ Query was successfully cancelled');
    } else {
      console.error('Error:', error);
    }
  }
}

// Example 2: Read-Only Mode
async function readOnlyModeExample() {
  console.log('\n=== Read-Only Mode Example ===\n');
  
  console.log('Attempting to use tools in read-only mode...');
  
  const response = await claude()
    .withModel('sonnet')
    .skipPermissions()
    .allowTools() // No tools = read-only mode
    .query('Please analyze the package.json file and tell me what dependencies are used')
    .asText();
    
  console.log('Response (no file access):', response);
}

// Example 3: Structured Logging with Nested Objects
async function advancedLoggingExample() {
  console.log('\n=== Advanced Logging Example ===\n');
  
  // JSON logger for structured logging
  const jsonLogger = new JSONLogger(LogLevel.INFO, (json) => {
    console.log('[JSON LOG]', json);
  });
  
  // Console logger with nested object support
  const consoleLogger = new ConsoleLogger(LogLevel.DEBUG, '[MyApp]');
  
  // Log complex nested data
  consoleLogger.info('Processing user request', {
    user: {
      id: 123,
      email: 'user@example.com',
      preferences: {
        theme: 'dark',
        notifications: {
          email: true,
          push: false,
          frequency: 'daily'
        }
      }
    },
    request: {
      endpoint: '/api/analyze',
      timestamp: new Date().toISOString()
    }
  });
  
  // Use logger with Claude query
  const response = await claude()
    .withLogger(jsonLogger)
    .withModel('sonnet')
    .skipPermissions()
    .query('What is 2 + 2?')
    .asText();
    
  console.log('\nResponse:', response);
}

// Example 4: Message Streaming (Not Token Streaming)
async function messageStreamingExample() {
  console.log('\n=== Message Streaming Clarification ===\n');
  console.log('Note: This SDK streams complete messages, not individual tokens\n');
  
  let messageCount = 0;
  
  await claude()
    .withModel('sonnet')
    .skipPermissions()
    .query('Tell me three interesting facts about space')
    .stream(async (message) => {
      if (message.type === 'assistant') {
        messageCount++;
        console.log(`Message ${messageCount} (complete):`, message.content[0].text);
        console.log('---');
      }
    });
    
  console.log(`\nTotal messages received: ${messageCount}`);
  console.log('Each message was complete, not token-by-token');
}

// Example 5: Production Integration Pattern
async function productionIntegrationExample() {
  console.log('\n=== Production Integration Pattern ===\n');
  
  // Simulate OTEL-compatible logger
  class OTELLogger {
    constructor() {
      this.spans = [];
    }
    
    log(entry) {
      // Send to OTEL exporter
      this.spans.push({
        name: 'claude.query',
        attributes: {
          level: LogLevel[entry.level],
          message: entry.message,
          ...entry.context // This now properly includes nested objects
        },
        timestamp: entry.timestamp
      });
    }
    
    // The SDK's Logger interface requires error/warn/info/debug/trace.
    // The ResponseParser calls warn() and debug() while consuming messages,
    // so every method must exist or the query will throw at runtime.
    error(message, context) {
      this.log({ level: LogLevel.ERROR, message, timestamp: new Date(), context });
    }

    warn(message, context) {
      this.log({ level: LogLevel.WARN, message, timestamp: new Date(), context });
    }

    info(message, context) {
      this.log({ level: LogLevel.INFO, message, timestamp: new Date(), context });
    }

    debug(message, context) {
      this.log({ level: LogLevel.DEBUG, message, timestamp: new Date(), context });
    }

    trace(message, context) {
      this.log({ level: LogLevel.TRACE, message, timestamp: new Date(), context });
    }
  }
  
  const otelLogger = new OTELLogger();
  
  // Production query with timeout, cancellation, and logging
  const controller = new AbortController();
  
  try {
    const result = await claude()
      .withModel('sonnet')
      .skipPermissions()
      .allowTools('Read', 'LS') // Only safe read operations
      .withTimeout(30000) // 30 second timeout
      .withSignal(controller.signal)
      .withLogger(otelLogger)
      .query('List the files in the current directory')
      .asText();
      
    console.log('Production query result:', result);
    console.log('\nOTEL spans collected:', otelLogger.spans.length);
  } catch (error) {
    console.error('Production error:', error);
  }
}

// Run all examples
async function main() {
  try {
    await cancellableQueryExample();
    await readOnlyModeExample();
    await advancedLoggingExample();
    await messageStreamingExample();
    await productionIntegrationExample();
  } catch (error) {
    console.error('Error:', error);
  }
}

main();