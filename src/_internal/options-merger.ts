/**
 * Options merger for combining user options with environment options
 */

import type { ClaudeCodeOptions } from '../types.js';
import type { SafeEnvironmentOptions } from '../types/environment.js';

/**
 * Apply environment options to user options
 * 
 * User options always take precedence over environment options.
 * This ensures explicit configuration overrides environment defaults.
 * 
 * @param userOptions Options explicitly provided by the user
 * @param envOptions Options loaded from environment variables
 * @returns Merged options with user options taking precedence
 */
export function applyEnvironmentOptions(
  userOptions: ClaudeCodeOptions,
  envOptions: SafeEnvironmentOptions
): ClaudeCodeOptions {
  // Start with environment options as defaults
  const merged: ClaudeCodeOptions = { ...userOptions };
  
  // Apply environment options only if not explicitly set by user
  if (merged.debug === undefined && envOptions.debug !== undefined) {
    merged.debug = envOptions.debug;
  }
  
  // Apply verbose from env if not set
  if (!('verbose' in merged) && envOptions.verbose !== undefined) {
    (merged as ClaudeCodeOptions & { verbose?: boolean }).verbose = envOptions.verbose;
  }
  
  // Apply logLevel from env if not set
  if (!('logLevel' in merged) && envOptions.logLevel !== undefined) {
    (merged as ClaudeCodeOptions & { logLevel?: number }).logLevel = envOptions.logLevel;
  }
  
  // Note: We don't apply nodeEnv to the options as it's not part of ClaudeCodeOptions
  // It can be used internally for other purposes if needed
  
  return merged;
}