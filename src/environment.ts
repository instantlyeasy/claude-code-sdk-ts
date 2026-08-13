/**
 * Safe environment variable loading for Claude Code SDK
 * 
 * IMPORTANT: This module intentionally does NOT load API keys from environment
 * variables to prevent accidental billing charges. API keys must be explicitly
 * provided by the user.
 */

import type { SafeEnvironmentOptions } from './types/environment.js';

/**
 * Parse boolean environment variable values
 */
function parseBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  
  const normalized = value.toLowerCase().trim();
  
  // Handle common boolean representations
  if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') {
    return true;
  }
  
  if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') {
    return false;
  }
  
  // Invalid boolean value
  return undefined;
}

/**
 * Parse and validate log level
 */
function parseLogLevel(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  
  const level = parseInt(value, 10);
  
  // Validate range (0-4)
  if (isNaN(level) || level < 0 || level > 4) {
    return undefined;
  }
  
  return level;
}

/**
 * Load safe environment variables
 * 
 * This function loads only non-sensitive environment variables that are safe
 * to use for configuration. It explicitly does NOT load API keys.
 * 
 * Supported environment variables:
 * - CLAUDE_SDK_DEBUG: Enable debug mode (boolean)
 * - CLAUDE_SDK_VERBOSE: Enable verbose output (boolean)
 * - CLAUDE_SDK_LOG_LEVEL: Set log level 0-4 (number)
 * - NODE_ENV: Node environment (string)
 *
 * Note: the generic `DEBUG` / `VERBOSE` / `LOG_LEVEL` variables are intentionally
 * NOT read — they are set ubiquitously by unrelated tooling (CI, the `debug`
 * npm package), and treating them as ours silently enabled dumping of the
 * command line and full stream traffic. Use the `CLAUDE_SDK_` variants.
 *
 * @returns Options loaded from environment variables
 */
export function loadSafeEnvironmentOptions(): SafeEnvironmentOptions {
  const options: SafeEnvironmentOptions = {};

  // Load CLAUDE_SDK_DEBUG (namespaced; generic DEBUG is deliberately ignored).
  const debug = parseBoolean(process.env.CLAUDE_SDK_DEBUG);
  if (debug !== undefined) {
    options.debug = debug;
  }

  // Load CLAUDE_SDK_VERBOSE
  const verbose = parseBoolean(process.env.CLAUDE_SDK_VERBOSE);
  if (verbose !== undefined) {
    options.verbose = verbose;
  }

  // Load CLAUDE_SDK_LOG_LEVEL
  const logLevel = parseLogLevel(process.env.CLAUDE_SDK_LOG_LEVEL);
  if (logLevel !== undefined) {
    options.logLevel = logLevel;
  }
  
  // Load NODE_ENV
  if (process.env.NODE_ENV) {
    options.nodeEnv = process.env.NODE_ENV;
  }
  
  // IMPORTANT: We do NOT load ANTHROPIC_API_KEY here
  // This is a deliberate safety measure to prevent accidental billing
  
  return options;
}

/**
 * Note on authentication.
 *
 * This SDK does not handle API keys at all — it shells out to the `claude` CLI,
 * which owns authentication. There is deliberately no `apiKey` option.
 */
export const API_KEY_SAFETY_WARNING = `
Authentication is handled entirely by the Claude Code CLI, not by this SDK.

Set up auth once with the CLI:
  - Interactive login:            claude login
  - Or an API key for the CLI:    export ANTHROPIC_API_KEY=sk-ant-...
  - Or a provider:                CLAUDE_CODE_USE_BEDROCK / CLAUDE_CODE_USE_VERTEX

This SDK has no 'apiKey' option; any credentials live in the CLI's own config
or the process environment that the CLI reads.
`.trim();