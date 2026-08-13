/**
 * Enhanced features for Claude Code SDK
 * 
 * This module exports all the enhanced features implemented based on
 * early adopter feedback:
 * 
 * 1. Typed error handling
 * 2. Message-level streaming
 * 3. Per-call tool permissions
 * 4. Exponential backoff and retry
 */

// Error handling
export {
  detectErrorType,
  createTypedError
} from '../errors.js';

// Token streaming
export {
  createTokenStream,
  TokenStreamImpl
} from '../streaming/token-stream.js';

// Per-call permissions
export {
  createPermissionManager,
  ToolPermissionManager
} from '../permissions/tool-permissions.js';

// Retry and backoff
export {
  createRetryExecutor,
  createExponentialRetryExecutor,
  createLinearRetryExecutor,
  createFibonacciRetryExecutor,
  withRetry,
  ClaudeRetryExecutor
} from '../retry/executor.js';

// Note: Types are re-exported from types.js to avoid conflicts

// Re-export types
export type {
  // Enhanced errors
  ErrorType,
  APIError,
  RateLimitError,
  AuthenticationError,
  ToolPermissionError,
  NetworkError,
  TimeoutError,
  ValidationError,
  StreamAbortedError,
  StreamingError,
  PermissionError,
  
  // Token streaming
  TokenStream,
  TokenChunk,
  StreamController,
  StreamMetrics,
  StreamState,
  
  // Per-call permissions
  ToolOverrides,
  ToolPermission,
  PermissionContext,
  DynamicPermissionFunction,
  PermissionResolution,
  PermissionSource,

  // Retry
  RetryOptions,
  RetryResult,
  RetryStrategy,
  RetryExecutor,
  RetryExecutorStats,
  BackoffStrategy,
  AdvancedRetryOptions,
  RateLimitOptions,
  CircuitBreakerOptions,
  CircuitState,
  CircuitBreaker,
  CircuitBreakerStats
} from '../types.js';