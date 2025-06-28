import { SubprocessCLITransport } from './transport/subprocess-cli.js';
import type { ClaudeCodeOptions, Message, CLIOutput, AssistantMessage, CLIAssistantOutput, CLIErrorOutput } from '../types.js';
import { detectErrorType, createTypedError } from '../errors.js';
import { loadSafeEnvironmentOptions } from '../environment.js';
import { applyEnvironmentOptions } from './options-merger.js';
import type { 
  Interceptor, 
  InterceptorContext, 
  InterceptorRequest, 
  InterceptorResponse, 
  InterceptorConfig, 
  Next,
  InterceptorTimeoutError,
  InterceptorChainError 
} from '../interceptors.js';

export class InternalClient {
  private options: ClaudeCodeOptions;
  private prompt: string;
  private interceptors: Interceptor[];
  private interceptorConfig: InterceptorConfig;

  constructor(prompt: string, options: ClaudeCodeOptions = {}, interceptorConfig: InterceptorConfig = {}) {
    this.prompt = prompt;
    
    // Load safe environment variables and merge with user options
    const envOptions = loadSafeEnvironmentOptions();
    this.options = applyEnvironmentOptions(options, envOptions);
    
    // Initialize interceptor system
    this.interceptors = interceptorConfig.interceptors || [];
    this.interceptorConfig = {
      debug: false,
      timeout: 30000, // 30 second default timeout
      maxContextSize: 1024 * 1024, // 1MB max context
      ...interceptorConfig
    };
  }

  async *processQuery(): AsyncGenerator<Message> {
    // If no interceptors, use the original flow for zero overhead
    if (this.interceptors.length === 0) {
      yield* this.executeOriginalFlow();
      return;
    }
    
    // Execute through interceptor chain
    const request: InterceptorRequest = {
      prompt: this.prompt,
      options: this.options,
      originalPrompt: this.prompt
    };
    
    const context: InterceptorContext = {
      requestId: `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      sessionId: this.options.sessionId,
      timestamp: Date.now(),
      metadata: {}
    };
    
    try {
      const chain = this.buildInterceptorChain();
      const response = await this.executeWithTimeout(chain(request, context));
      
      // Yield all messages from the intercepted response
      for await (const message of response.messages) {
        yield message;
      }
    } catch (error) {
      if (error instanceof InterceptorTimeoutError || error instanceof InterceptorChainError) {
        throw error;
      }
      
      // For other errors, augment with context if available
      if (context.correlationId) {
        const augmentedError = new Error(`[${context.correlationId}] ${error.message}`);
        augmentedError.stack = error.stack;
        throw augmentedError;
      }
      throw error;
    }
  }

  private async *executeOriginalFlow(): AsyncGenerator<Message> {
    const transport = new SubprocessCLITransport(this.prompt, this.options);

    try {
      await transport.connect();

      for await (const output of transport.receiveMessages()) {
        const message = this.parseMessage(output);
        if (message) {
          yield message;
        }
      }
    } finally {
      await transport.disconnect();
    }
  }

  private parseMessage(output: CLIOutput): Message | null {
    // Handle CLIOutput types based on actual CLI output
    switch (output.type) {
      case 'assistant': {
        // Extract the actual assistant message from the wrapper
        const assistantMsg = output as CLIAssistantOutput;
        if (assistantMsg.message) {
          // Return a simplified assistant message with just the content
          return {
            type: 'assistant',
            content: assistantMsg.message.content,
            session_id: assistantMsg.session_id
          } as AssistantMessage;
        }
        return {
          type: 'assistant',
          content: [],
          session_id: assistantMsg.session_id
        } as AssistantMessage;
      }
        
      case 'system':
        // System messages (like init) - skip these
        return null;
        
      case 'result': {
        // Result message with usage stats - return it
        const resultMsg = output as CLIOutput & { 
          subtype?: string; 
          content?: string; 
          session_id?: string; 
          usage?: unknown; 
          cost?: { total_cost_usd?: number }; 
        };
        return {
          type: 'result',
          subtype: resultMsg.subtype,
          content: resultMsg.content || '',
          session_id: resultMsg.session_id,
          usage: resultMsg.usage,
          cost: {
            total_cost: resultMsg.cost?.total_cost_usd
          }
        } as Message;
      }
        
      case 'error': {
        const errorOutput = output as CLIErrorOutput;
        const errorMessage = errorOutput.error?.message || 'Unknown error';
        const errorType = detectErrorType(errorMessage);
        throw createTypedError(errorType, errorMessage, errorOutput.error);
      }
      
      default:
        // Skip unknown message types
        return null;
    }
  }

  /**
   * Builds the interceptor chain with the final handler
   */
  private buildInterceptorChain(): Next {
    // The final handler executes the original Claude Code flow
    const finalHandler: Next = async (request: InterceptorRequest, context: InterceptorContext): Promise<InterceptorResponse> => {
      // Update the client with the potentially modified request
      const originalPrompt = this.prompt;
      this.prompt = request.prompt;
      this.options = { ...this.options, ...request.options };
      
      try {
        const messages = this.executeOriginalFlow();
        
        return {
          messages,
          metadata: {
            latency: context.metrics?.latency,
            tokenCount: context.metrics?.tokenCount
          }
        };
      } finally {
        // Restore original prompt for safety
        this.prompt = originalPrompt;
      }
    };

    // If no interceptors, return the final handler directly
    if (this.interceptors.length === 0) {
      return finalHandler;
    }

    // Build the chain by reducing from right to left
    // This ensures the first interceptor in the array is called first
    return this.interceptors.reduceRight(
      (next: Next, interceptor: Interceptor) => {
        return async (request: InterceptorRequest, context: InterceptorContext): Promise<InterceptorResponse> => {
          try {
            return await interceptor(request, context, next);
          } catch (error) {
            // Add interceptor context to errors
            const interceptorName = interceptor.name || 'anonymous';
            const contextualError = new Error(`Interceptor '${interceptorName}' failed: ${error.message}`);
            contextualError.stack = error.stack;
            throw contextualError;
          }
        };
      },
      finalHandler
    );
  }

  /**
   * Executes the interceptor chain with timeout support
   */
  private async executeWithTimeout<T>(promise: Promise<T>): Promise<T> {
    if (!this.interceptorConfig.timeout) {
      return promise;
    }

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new InterceptorTimeoutError(this.interceptorConfig.timeout!));
      }, this.interceptorConfig.timeout);
    });

    return Promise.race([promise, timeoutPromise]);
  }
}