# Claude Code SDK Interceptors

The Claude Code SDK provides a powerful interceptor system that enables middleware integration at key points in the query lifecycle. This system is specifically designed to support **Claudeware** integration while maintaining zero-latency performance and SDK simplicity.

## Overview

Interceptors allow you to:
- **Pre-process queries** (input transformation, PII stripping, optimization)
- **Stream processing** (real-time analysis during streaming responses)
- **Post-process responses** (output transformation, caching, analytics)
- **Error handling** (error enrichment, retry policies, context injection)
- **Context management** (session tracking, correlation IDs, metadata)

## Key Design Principles

1. **Zero overhead when unused** - No interceptors = original performance
2. **Claudeware compatibility** - Context is strict superset of Claudeware's context
3. **Stream-aware** - Full support for streaming responses without blocking
4. **Error isolation** - Interceptor failures don't crash the SDK
5. **Developer friendly** - Simple functional pattern with TypeScript support

## Basic Usage

### Using the Fluent API

```typescript
import { claude, loggingInterceptor, correlationInterceptor } from '@instantlyeasy/claude-code-sdk-ts';

const result = await claude()
  .withInterceptor(loggingInterceptor)
  .withInterceptor(correlationInterceptor)
  .withInterceptorDebug(true)
  .query('Create a hello.txt file')
  .asText();
```

### Using Built-in Interceptors

```typescript
const result = await claude()
  .withBuiltinInterceptors(['logging', 'correlation', 'classification'])
  .query('Analyze this codebase')
  .asText();
```

### Using the Base Query Function

```typescript
import { query, loggingInterceptor } from '@instantlyeasy/claude-code-sdk-ts';

const interceptorConfig = {
  interceptors: [loggingInterceptor],
  debug: true,
  timeout: 30000
};

for await (const message of query('Hello Claude', {}, interceptorConfig)) {
  console.log(message);
}
```

## Interceptor Interface

### Core Types

```typescript
interface InterceptorContext {
  requestId?: string;
  sessionId?: string;
  correlationId?: string;
  timestamp?: number;
  metadata?: Record<string, unknown>;
  category?: string;
  complexity?: 'low' | 'medium' | 'high';
  suggestedModel?: string;
  metrics?: {
    startTime?: number;
    endTime?: number;
    tokenCount?: number;
    latency?: number;
  };
  [key: string]: unknown; // Extensible for Claudeware
}

interface InterceptorRequest {
  prompt: string;
  options: ClaudeCodeOptions;
  originalPrompt?: string;
}

interface InterceptorResponse {
  messages: AsyncGenerator<Message>;
  metadata?: {
    model?: string;
    tokenCount?: number;
    latency?: number;
    cached?: boolean;
  };
}

type Interceptor = (
  request: InterceptorRequest,
  context: InterceptorContext,
  next: Next
) => Promise<InterceptorResponse>;
```

## Creating Custom Interceptors

### Simple Interceptor Example

```typescript
const timingInterceptor: Interceptor = async (request, context, next) => {
  const startTime = Date.now();
  
  try {
    const response = await next(request, context);
    const latency = Date.now() - startTime;
    
    console.log(`Query completed in ${latency}ms`);
    
    return {
      ...response,
      metadata: {
        ...response.metadata,
        latency
      }
    };
  } catch (error) {
    console.error(`Query failed after ${Date.now() - startTime}ms`);
    throw error;
  }
};
```

### Pre-processing Interceptor

```typescript
const piiStripperInterceptor: Interceptor = async (request, context, next) => {
  // Detect and mask PII in the prompt
  const maskedPrompt = request.prompt
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]');
  
  if (maskedPrompt !== request.prompt) {
    context.metadata!.piiDetected = true;
    console.log('PII detected and masked');
  }
  
  return next({
    ...request,
    prompt: maskedPrompt
  }, context);
};
```

### Stream Processing Interceptor

```typescript
const streamAnalyticsInterceptor: Interceptor = async (request, context, next) => {
  const response = await next(request, context);
  
  // Wrap the stream to analyze content as it flows
  const analyticsGenerator = async function* () {
    let tokenCount = 0;
    let errorPatterns = 0;
    
    for await (const message of response.messages) {
      if (message.type === 'assistant') {
        for (const block of message.content) {
          if (block.type === 'text') {
            tokenCount += block.text.split(' ').length;
            if (block.text.includes('ERROR:')) {
              errorPatterns++;
            }
          }
        }
      }
      
      yield message;
    }
    
    // Store analytics after stream completion
    console.log(`Stream completed: ${tokenCount} tokens, ${errorPatterns} errors`);
  };
  
  return {
    ...response,
    messages: analyticsGenerator()
  };
};
```

### Caching Interceptor

```typescript
const cachingInterceptor = (() => {
  const cache = new Map();
  
  return async (request, context, next) => {
    const cacheKey = JSON.stringify({
      prompt: request.prompt,
      model: request.options.model
    });
    
    // Check cache
    if (cache.has(cacheKey)) {
      const cached = cache.get(cacheKey);
      
      const cachedGenerator = async function* () {
        for (const message of cached.messages) {
          yield message;
        }
      };
      
      return {
        messages: cachedGenerator(),
        metadata: { cached: true }
      };
    }
    
    // Execute and cache
    const response = await next(request, context);
    const messages = [];
    
    const cachingGenerator = async function* () {
      for await (const message of response.messages) {
        messages.push(message);
        yield message;
      }
      
      // Store in cache after completion
      cache.set(cacheKey, { messages: [...messages] });
    };
    
    return {
      ...response,
      messages: cachingGenerator()
    };
  };
})();
```

## Built-in Interceptors

### Logging Interceptor

Provides request/response logging with timing information:

```typescript
import { loggingInterceptor } from '@instantlyeasy/claude-code-sdk-ts';

const result = await claude()
  .withInterceptor(loggingInterceptor)
  .withInterceptorDebug(true) // Enable debug output
  .query('Hello Claude')
  .asText();
```

### Correlation Interceptor

Adds correlation IDs and request tracking:

```typescript
import { correlationInterceptor } from '@instantlyeasy/claude-code-sdk-ts';

const result = await claude()
  .withInterceptor(correlationInterceptor)
  .query('Hello Claude')
  .asText();
```

### Classification Interceptor

Provides basic query classification:

```typescript
import { classificationInterceptor } from '@instantlyeasy/claude-code-sdk-ts';

const result = await claude()
  .withInterceptor(classificationInterceptor)
  .query('Debug this error message')
  .asText();
// Sets context.category = 'debug', context.complexity = 'medium'
```

## Claudeware Integration

The interceptor system is specifically designed for **Claudeware** integration. Here's how Claudeware can implement its middleware:

### Claudeware Interceptor Example

```typescript
const claudewareInterceptor: Interceptor = async (request, context, next) => {
  // 1. Set up Claudeware context
  context.correlationId = generateClaudewareId();
  context.sessionId = getCurrentSession();
  
  // 2. Query optimization and routing
  const classification = await classifyQuery(request.prompt);
  context.category = classification.category;
  context.suggestedModel = classification.optimalModel;
  
  // 3. PII detection and protection
  const sanitizedRequest = await sanitizeRequest(request);
  
  // 4. Plugin system integration
  await executeClaudewarePlugins('pre-query', context);
  
  // 5. Execute query
  const response = await next(sanitizedRequest, context);
  
  // 6. Post-processing and analytics
  await storeQueryAnalytics(context);
  await executeClaudewarePlugins('post-query', context);
  
  return response;
};
```

### Wrapped SDK Factory for Claudeware

```typescript
function createClaudewareSDK(config) {
  return {
    query: (prompt, options = {}) => {
      return claude()
        .withInterceptor(claudewareInterceptor)
        .withInterceptor(queryOptimizerInterceptor)
        .withInterceptor(analyticsInterceptor)
        .withInterceptorConfig({
          timeout: config.timeout || 30000,
          debug: config.debug
        })
        .query(prompt);
    }
  };
}
```

## Configuration

### Interceptor Configuration

```typescript
interface InterceptorConfig {
  interceptors?: Interceptor[];
  debug?: boolean;
  timeout?: number; // Chain timeout in ms
  maxContextSize?: number; // Max context object size
}
```

### Using Configuration

```typescript
const config = {
  interceptors: [loggingInterceptor, correlationInterceptor],
  debug: true,
  timeout: 45000,
  maxContextSize: 1024 * 1024 // 1MB
};

const result = await claude()
  .withInterceptorConfig(config)
  .query('Complex analysis task')
  .asText();
```

## Error Handling

### Interceptor Error Isolation

```typescript
// Individual interceptor errors don't crash the chain
const flakyInterceptor: Interceptor = async (request, context, next) => {
  throw new Error('Interceptor failed!');
  // Error is caught and wrapped with context
};

// The query will still execute, but you'll see:
// "Interceptor 'flakyInterceptor' failed: Interceptor failed!"
```

### Timeout Handling

```typescript
const result = await claude()
  .withInterceptorConfig({ timeout: 5000 }) // 5 second timeout
  .withInterceptor(slowInterceptor)
  .query('Quick task')
  .asText();
// Throws InterceptorTimeoutError if chain takes > 5 seconds
```

### Error Context Enrichment

```typescript
const errorInterceptor: Interceptor = async (request, context, next) => {
  try {
    return await next(request, context);
  } catch (error) {
    // Enrich error with interceptor context
    error.interceptorContext = {
      correlationId: context.correlationId,
      category: context.category,
      timestamp: context.timestamp
    };
    throw error;
  }
};
```

## Performance Considerations

### Zero Overhead When Unused

```typescript
// No interceptors = zero overhead, original performance
const result = await claude()
  .query('Hello Claude')
  .asText();
```

### Minimal Overhead When Used

```typescript
// Interceptors add ~2μs overhead per interceptor
const result = await claude()
  .withInterceptor(loggingInterceptor)     // +2μs
  .withInterceptor(correlationInterceptor) // +2μs
  .query('Hello Claude')
  .asText();
// Total overhead: ~4μs (negligible)
```

### Stream Processing Performance

- Interceptors process streams **in parallel** with output
- No blocking or buffering of streaming responses
- Memory usage controlled by `maxContextSize` setting
- Built-in backpressure handling

## Best Practices

### 1. Keep Interceptors Lightweight

```typescript
// ✅ Good: Lightweight and focused
const simpleLogger: Interceptor = async (request, context, next) => {
  console.log(`Query: ${request.prompt.slice(0, 50)}...`);
  return next(request, context);
};

// ❌ Avoid: Heavy computation in interceptors
const heavyProcessor: Interceptor = async (request, context, next) => {
  // Don't do heavy ML processing here - use background tasks
  await runExpensiveAnalysis(request.prompt); // Too slow!
  return next(request, context);
};
```

### 2. Handle Async Operations Properly

```typescript
// ✅ Good: Proper async handling
const asyncInterceptor: Interceptor = async (request, context, next) => {
  const metadata = await fetchMetadata(request.prompt);
  context.metadata!.external = metadata;
  return next(request, context);
};
```

### 3. Use Context Effectively

```typescript
// ✅ Good: Leverage shared context
const contextInterceptor: Interceptor = async (request, context, next) => {
  // Set data for later interceptors
  context.metadata!.processingStage = 'pre-processing';
  
  const response = await next(request, context);
  
  // Read data set by earlier interceptors
  const correlationId = context.correlationId;
  console.log(`Completed request ${correlationId}`);
  
  return response;
};
```

### 4. Error Handling

```typescript
// ✅ Good: Graceful error handling
const resilientInterceptor: Interceptor = async (request, context, next) => {
  try {
    await performOptionalTask();
  } catch (error) {
    // Log but don't fail the query
    console.warn('Optional task failed:', error.message);
  }
  
  return next(request, context);
};
```

## Integration Examples

### Complete Claudeware Integration

```typescript
import { claude } from '@instantlyeasy/claude-code-sdk-ts';

// Simulated Claudeware middleware
const claudewareMiddleware = [
  // 1. Correlation tracking
  async (request, context, next) => {
    context.correlationId = `cw-${Date.now()}`;
    return next(request, context);
  },
  
  // 2. Query optimization
  async (request, context, next) => {
    if (request.prompt.length < 50) {
      context.suggestedModel = 'haiku'; // Route simple queries to faster model
    }
    return next(request, context);
  },
  
  // 3. Analytics collection
  async (request, context, next) => {
    const response = await next(request, context);
    
    // Store analytics in Claudeware database
    await storeAnalytics({
      correlationId: context.correlationId,
      category: context.category,
      latency: context.metrics?.latency
    });
    
    return response;
  }
];

// Use with SDK
const result = await claude()
  .withInterceptors(claudewareMiddleware)
  .query('Create a simple test file')
  .asText();
```

### Plugin System Integration

```typescript
// Example: Claudeware plugin compatibility
class ClaudewareSDK {
  private interceptors: Interceptor[] = [];
  
  addPlugin(plugin) {
    // Convert Claudeware plugin to interceptor
    const interceptor: Interceptor = async (request, context, next) => {
      await plugin.onPreQuery?.(request, context);
      const response = await next(request, context);
      await plugin.onPostQuery?.(response, context);
      return response;
    };
    
    this.interceptors.push(interceptor);
    return this;
  }
  
  query(prompt, options = {}) {
    return claude()
      .withInterceptors(this.interceptors)
      .query(prompt);
  }
}
```

## Migration from Direct Integration

If you're migrating from direct Claude Code CLI integration to the SDK with interceptors:

### Before (Direct CLI)

```bash
# Direct CLI usage with wrapper script
claude-code "Create a file" | tee analytics.log
```

### After (SDK with Interceptors)

```typescript
import { claude, loggingInterceptor } from '@instantlyeasy/claude-code-sdk-ts';

const result = await claude()
  .withInterceptor(loggingInterceptor)
  .withInterceptor(analyticsInterceptor)
  .query('Create a file')
  .asText();
```

### Benefits of Migration

1. **Type Safety** - Full TypeScript support
2. **Better Error Handling** - Structured error types
3. **Stream Processing** - Real-time analysis capabilities
4. **Plugin Ecosystem** - Access to interceptor ecosystem
5. **Performance** - Optimized overhead and memory usage

## Troubleshooting

### Debug Mode

```typescript
const result = await claude()
  .withInterceptorDebug(true) // Enable debug logging
  .withInterceptor(yourInterceptor)
  .query('Test query')
  .asText();
```

### Common Issues

1. **Timeout Errors**: Increase timeout or optimize interceptor performance
2. **Memory Leaks**: Check `maxContextSize` and avoid storing large objects in context
3. **Stream Blocking**: Ensure interceptors don't buffer entire streams
4. **Error Propagation**: Use try/catch in interceptors for non-critical operations

### Performance Monitoring

```typescript
const performanceInterceptor: Interceptor = async (request, context, next) => {
  const start = performance.now();
  const response = await next(request, context);
  const duration = performance.now() - start;
  
  if (duration > 1000) { // Log slow requests
    console.warn(`Slow request: ${duration}ms`);
  }
  
  return response;
};
```

## Future Enhancements

The interceptor system is designed for future expansion:

1. **Plugin Marketplace** - Shared interceptor registry
2. **Visual Debugging** - DevTools integration
3. **Metrics Export** - OpenTelemetry integration
4. **Async Interceptors** - Background processing support
5. **Hot Reloading** - Dynamic interceptor updates

---

For more examples and advanced patterns, see the [Claudeware Integration Example](../examples/claudeware-integration.js).