/**
 * Example: Claudeware Integration with Claude Code SDK
 * 
 * This example demonstrates how Claudeware middleware can integrate with
 * the Claude Code SDK using the new interceptor system.
 */

import { claude } from '@instantlyeasy/claude-code-sdk-ts';

/**
 * Example Claudeware integration interceptor
 * This is what Claudeware would implement to provide its functionality
 */
const claudewareInterceptor = async (request, context, next) => {
  // 1. Pre-processing: Set correlation ID and session tracking
  context.correlationId = context.correlationId || `cw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  context.sessionId = context.sessionId || 'demo-session';
  
  console.log(`[Claudeware] Starting request ${context.correlationId}`);
  console.log(`[Claudeware] Original prompt: "${request.prompt.slice(0, 50)}..."`);
  
  // 2. Query classification (simple example)
  const prompt = request.prompt.toLowerCase();
  if (prompt.includes('debug') || prompt.includes('error')) {
    context.category = 'debug';
    context.complexity = 'medium';
    context.suggestedModel = 'sonnet'; // Route to appropriate model
  } else if (prompt.includes('create') || prompt.includes('build')) {
    context.category = 'code';
    context.complexity = 'high';
    context.suggestedModel = 'opus';
  } else {
    context.category = 'query';
    context.complexity = 'low';
    context.suggestedModel = 'haiku'; // Route simple queries to faster model
  }
  
  // 3. PII detection and stripping (example)
  if (request.prompt.includes('@') && request.prompt.includes('.com')) {
    console.log('[Claudeware] Warning: Possible email detected, consider PII protection');
    // In real implementation, would strip or mask PII
  }
  
  // 4. Analytics tracking - start timer
  const startTime = Date.now();
  context.metrics = { startTime };
  
  try {
    // 5. Call next in chain (or final handler)
    const response = await next(request, context);
    
    // 6. Post-processing: Add response analytics
    const endTime = Date.now();
    const latency = endTime - startTime;
    
    console.log(`[Claudeware] Request completed in ${latency}ms`);
    console.log(`[Claudeware] Category: ${context.category}, Complexity: ${context.complexity}`);
    
    // 7. Store query analytics (would go to SQLite in real Claudeware)
    const analyticsData = {
      requestId: context.requestId,
      correlationId: context.correlationId,
      sessionId: context.sessionId,
      category: context.category,
      complexity: context.complexity,
      suggestedModel: context.suggestedModel,
      latency,
      timestamp: startTime,
      promptLength: request.prompt.length
    };
    
    console.log('[Claudeware] Analytics:', JSON.stringify(analyticsData, null, 2));
    
    // 8. Response transformation (example: add metadata)
    if (response.metadata) {
      response.metadata.claudewareProcessed = true;
      response.metadata.optimizationSuggestion = context.suggestedModel !== request.options.model 
        ? `Consider using ${context.suggestedModel} for better performance`
        : null;
    }
    
    return response;
    
  } catch (error) {
    // 9. Error handling and enrichment
    const latency = Date.now() - startTime;
    console.error(`[Claudeware] Request failed after ${latency}ms:`, error.message);
    
    // Add Claudeware context to error
    error.claudewareContext = {
      correlationId: context.correlationId,
      category: context.category,
      latency
    };
    
    throw error;
  }
};

/**
 * Example: Stream processing interceptor
 * Shows how to analyze streaming responses in real-time
 */
const streamAnalyticsInterceptor = async (request, context, next) => {
  const response = await next(request, context);
  
  // Wrap the message generator to analyze streaming content
  const wrappedMessages = async function* () {
    let messageCount = 0;
    let totalChars = 0;
    
    for await (const message of response.messages) {
      messageCount++;
      
      if (message.type === 'assistant' && Array.isArray(message.content)) {
        for (const block of message.content) {
          if (block.type === 'text') {
            totalChars += block.text.length;
            
            // Real-time analysis example
            if (block.text.includes('ERROR:') || block.text.includes('FAILED:')) {
              console.log('[Stream Analytics] Error pattern detected in response');
            }
          }
        }
      }
      
      yield message;
    }
    
    console.log(`[Stream Analytics] Processed ${messageCount} messages, ${totalChars} characters`);
  };
  
  return {
    ...response,
    messages: wrappedMessages()
  };
};

/**
 * Example: Caching interceptor
 * Shows how to implement response caching
 */
const cachingInterceptor = (() => {
  const cache = new Map();
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  
  return async (request, context, next) => {
    // Create cache key from prompt and options
    const cacheKey = JSON.stringify({
      prompt: request.prompt,
      model: request.options.model,
      tools: request.options.allowedTools
    });
    
    // Check cache
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('[Cache] Cache hit!');
      
      // Return cached response as async generator
      const cachedMessages = async function* () {
        for (const message of cached.messages) {
          yield message;
        }
      };
      
      return {
        messages: cachedMessages(),
        metadata: {
          ...cached.metadata,
          cached: true,
          cacheAge: Date.now() - cached.timestamp
        }
      };
    }
    
    console.log('[Cache] Cache miss, executing query');
    const response = await next(request, context);
    
    // Store response in cache (convert generator to array for storage)
    const messages = [];
    const cachedMessages = async function* () {
      for await (const message of response.messages) {
        messages.push(message);
        yield message;
      }
      
      // Store in cache after completion
      cache.set(cacheKey, {
        messages: [...messages],
        metadata: response.metadata,
        timestamp: Date.now()
      });
    };
    
    return {
      ...response,
      messages: cachedMessages()
    };
  };
})();

// Example usage demonstrating the complete integration
async function demonstrateClaudewareIntegration() {
  console.log('🚀 Demonstrating Claudeware Integration with Claude Code SDK\n');
  
  try {
    // Option 1: Using fluent API with interceptors
    const result = await claude()
      .withModel('sonnet')
      .allowTools('Read', 'Write') 
      .withInterceptor(claudewareInterceptor)
      .withInterceptor(streamAnalyticsInterceptor)
      .withInterceptor(cachingInterceptor)
      .withInterceptorDebug(true)
      .withTimeout(30000)
      .query('Create a simple hello.txt file with a greeting message')
      .asText();
    
    console.log('\n✅ Query completed successfully!');
    console.log('Result:', result.slice(0, 200) + '...');
    
  } catch (error) {
    console.error('❌ Query failed:', error.message);
    
    // Show Claudeware enriched error context
    if (error.claudewareContext) {
      console.log('Claudeware Context:', error.claudewareContext);
    }
  }
}

// Example: Creating a Claudeware-wrapped SDK factory
function createClaudewareSDK(claudewareConfig = {}) {
  return {
    query: (prompt, options = {}) => {
      return claude()
        .withInterceptor(claudewareInterceptor)
        .withInterceptor(streamAnalyticsInterceptor)
        .withInterceptor(cachingInterceptor)
        .withInterceptorConfig({
          timeout: claudewareConfig.timeout || 30000,
          debug: claudewareConfig.debug || false
        })
        // Apply any provided options
        .allowTools(...(options.allowedTools || []))
        .withModel(options.model || 'sonnet')
        .query(prompt);
    },
    
    // Convenience method for Claudeware users
    withPlugins: (plugins) => {
      // Would integrate with Claudeware's plugin system
      console.log('Loading Claudeware plugins:', plugins);
      return this;
    }
  };
}

// Example usage of wrapped SDK
async function demonstrateWrappedSDK() {
  console.log('\n🔧 Demonstrating Claudeware-wrapped SDK\n');
  
  const claudewareSDK = createClaudewareSDK({
    timeout: 45000,
    debug: true
  });
  
  try {
    const result = await claudewareSDK
      .query('List files in the current directory')
      .asText();
    
    console.log('Wrapped SDK result:', result.slice(0, 100) + '...');
    
  } catch (error) {
    console.error('Wrapped SDK error:', error.message);
  }
}

// Run the examples
if (import.meta.url === new URL(process.argv[1], 'file://').href) {
  console.log('Claude Code SDK + Claudeware Integration Example');
  console.log('================================================\n');
  
  await demonstrateClaudewareIntegration();
  await demonstrateWrappedSDK();
  
  console.log('\n✨ Integration examples completed!');
  console.log('\nKey Benefits:');
  console.log('- Zero-latency passthrough maintained');
  console.log('- Rich middleware capabilities');
  console.log('- Plugin ecosystem support'); 
  console.log('- Advanced analytics and optimization');
  console.log('- Enterprise-grade features');
}