import { InternalClient } from './_internal/client.js';
import { AuthAnthropic } from './auth/anthropic.js';
import type { ClaudeCodeOptions, Message } from './types.js';

/**
 * Query Claude Code with a prompt and options.
 * 
 * @param prompt - The prompt to send to Claude Code
 * @param options - Configuration options for the query
 * @returns An async iterator that yields messages from Claude Code
 * 
 * @example
 * ```typescript
 * import { query } from '@instantlyeasy/claude-code-sdk-ts';
 * 
 * for await (const message of query('Create a hello.txt file')) {
 *   console.log(message);
 * }
 * ```
 * 
 * @example
 * ```typescript
 * import { query, ClaudeCodeOptions } from '@instantlyeasy/claude-code-sdk-ts';
 * 
 * const options: ClaudeCodeOptions = {
 *   allowedTools: ['Read', 'Write'],
 *   permissionMode: 'acceptEdits',
 *   cwd: '/Users/me/projects'
 * };
 * 
 * for await (const message of query('Analyze this codebase', options)) {
 *   if (message.type === 'assistant') {
 *     // Handle assistant messages
 *   } else if (message.type === 'result') {
 *     // Handle final result
 *   }
 * }
 * ```
 */
export async function* query(
  prompt: string,
  options?: ClaudeCodeOptions
): AsyncGenerator<Message> {
  const client = new InternalClient(prompt, options);
  yield* client.processQuery();
}

// Re-export all types
export * from './types.js';
export * from './errors.js';
export { AbortError } from './errors.js';

// Export enhanced error utilities
export { 
  isEnhancedError, 
  hasResolution 
} from './types/environment.js';
export { API_KEY_SAFETY_WARNING } from './environment.js';

// Export new fluent API (backward compatible - original query function still available)
export { claude, QueryBuilder } from './fluent.js';
export { ResponseParser, type ToolExecution, type UsageStats } from './parser.js';
export { 
  Logger, 
  LogLevel, 
  ConsoleLogger, 
  JSONLogger, 
  MultiLogger, 
  NullLogger,
  type LogEntry 
} from './logger.js';

// Export enhanced features (functions and classes only, types come from types.js)
export {
  // Error handling
  detectErrorType,
  createTypedError,
  // Token streaming
  createTokenStream,
  TokenStreamImpl,
  // Per-call permissions
  createPermissionManager,
  ToolPermissionManager,
  // Telemetry
  createTelemetryProvider,
  ClaudeTelemetryProvider,
  TelemetryUtils,
  // Retry and backoff
  createRetryExecutor,
  createExponentialRetryExecutor,
  createLinearRetryExecutor,
  createFibonacciRetryExecutor,
  withRetry,
  ClaudeRetryExecutor
} from './enhanced/index.js';


export { AuthAnthropic };
export { OAuthCredentials, validateCredentials, isValidCredentials } from './auth/validation.js';
