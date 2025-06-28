/**
 * Interceptor system for Claude Code SDK
 * 
 * Provides hook points for middleware systems like Claudeware to inject
 * functionality at key points in the query lifecycle while maintaining
 * zero latency and SDK simplicity.
 */

import type { ClaudeCodeOptions, Message } from './types.js';

/**
 * Context object passed through the interceptor chain.
 * Allows middleware to track session data, correlation IDs, and custom metadata.
 * 
 * Must be a strict superset of Claudeware's context to ensure compatibility.
 */
export interface InterceptorContext {
  /** Unique identifier for this specific request */
  requestId?: string;
  
  /** Session identifier for grouping related requests */
  sessionId?: string;
  
  /** Correlation ID for distributed tracing */
  correlationId?: string;
  
  /** Timestamp when the request started */
  timestamp?: number;
  
  /** Custom metadata that can be set by interceptors */
  metadata?: Record<string, unknown>;
  
  /** Request type classification (query, code, debug, etc.) */
  category?: string;
  
  /** Estimated complexity level */
  complexity?: 'low' | 'medium' | 'high';
  
  /** Model selection hints */
  suggestedModel?: string;
  
  /** Performance metrics */
  metrics?: {
    startTime?: number;
    endTime?: number;
    tokenCount?: number;
    latency?: number;
  };
  
  /** Extensible for future Claudeware features */
  [key: string]: unknown;
}

/**
 * Request parameters that can be modified by interceptors
 */
export interface InterceptorRequest {
  /** The user's query/prompt */
  prompt: string;
  
  /** Claude Code options */
  options: ClaudeCodeOptions;
  
  /** Original prompt before any transformations */
  originalPrompt?: string;
}

/**
 * Response object that can be modified by interceptors
 */
export interface InterceptorResponse {
  /** The message generator from Claude */
  messages: AsyncGenerator<Message>;
  
  /** Response metadata */
  metadata?: {
    model?: string;
    tokenCount?: number;
    latency?: number;
    cached?: boolean;
  };
}

/**
 * The next function in the interceptor chain
 */
export type Next = (
  request: InterceptorRequest,
  context: InterceptorContext
) => Promise<InterceptorResponse>;

/**
 * Interceptor function that can hook into the request/response lifecycle
 * 
 * @param request - The request being processed (can be modified)
 * @param context - Shared context object (can be modified)
 * @param next - Function to call the next interceptor or final handler
 * @returns Promise resolving to the response (can be modified)
 */
export type Interceptor = (
  request: InterceptorRequest,
  context: InterceptorContext,
  next: Next
) => Promise<InterceptorResponse>;

/**
 * Configuration for the interceptor system
 */
export interface InterceptorConfig {
  /** Array of interceptors to apply in order */
  interceptors?: Interceptor[];
  
  /** Enable debug logging for interceptor chain */
  debug?: boolean;
  
  /** Timeout for the entire interceptor chain (ms) */
  timeout?: number;
  
  /** Maximum context size to prevent memory leaks */
  maxContextSize?: number;
}

/**
 * Pre-built interceptor for request logging
 */
export const loggingInterceptor: Interceptor = async (request, context, next) => {
  const startTime = Date.now();
  context.metrics = { ...context.metrics, startTime };
  
  if (context.debug) {
    // eslint-disable-next-line no-console
    console.log(`[Interceptor] Request: ${request.prompt.slice(0, 100)}...`);
  }
  
  try {
    const response = await next(request, context);
    
    context.metrics.endTime = Date.now();
    context.metrics.latency = context.metrics.endTime - startTime;
    
    if (context.debug) {
      // eslint-disable-next-line no-console
      console.log(`[Interceptor] Response completed in ${context.metrics.latency}ms`);
    }
    
    return response;
  } catch (error) {
    if (context.debug) {
      // eslint-disable-next-line no-console
      console.error(`[Interceptor] Error after ${Date.now() - startTime}ms:`, error);
    }
    throw error;
  }
};

/**
 * Pre-built interceptor for adding correlation IDs
 */
export const correlationInterceptor: Interceptor = async (request, context, next) => {
  if (!context.correlationId) {
    context.correlationId = `claude-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
  
  if (!context.requestId) {
    context.requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
  
  context.timestamp = Date.now();
  
  return next(request, context);
};

/**
 * Pre-built interceptor for basic query classification
 */
export const classificationInterceptor: Interceptor = async (request, context, next) => {
  const prompt = request.prompt.toLowerCase();
  
  // Simple heuristic classification
  if (prompt.includes('debug') || prompt.includes('error') || prompt.includes('fix')) {
    context.category = 'debug';
    context.complexity = 'medium';
  } else if (prompt.includes('explain') || prompt.includes('what') || prompt.includes('how')) {
    context.category = 'explain';
    context.complexity = 'low';
  } else if (prompt.includes('create') || prompt.includes('build') || prompt.includes('implement')) {
    context.category = 'code';
    context.complexity = 'high';
  } else if (prompt.includes('test') || prompt.includes('spec')) {
    context.category = 'test';
    context.complexity = 'medium';
  } else {
    context.category = 'query';
    context.complexity = 'low';
  }
  
  return next(request, context);
};

/**
 * Error thrown when interceptor chain times out
 */
export class InterceptorTimeoutError extends Error {
  constructor(timeout: number) {
    super(`Interceptor chain timed out after ${timeout}ms`);
    this.name = 'InterceptorTimeoutError';
  }
}

/**
 * Error thrown when interceptor chain is malformed
 */
export class InterceptorChainError extends Error {
  constructor(message: string) {
    super(`Interceptor chain error: ${message}`);
    this.name = 'InterceptorChainError';
  }
}