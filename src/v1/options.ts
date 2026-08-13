/**
 * Map this package's builder state onto the official Agent SDK `Options`.
 *
 * Typed loosely (`Record<string, unknown>`) so the mapping has no compile-time
 * coupling to the exact official Options type (which changes almost daily); the
 * field NAMES are what matter and are asserted by tests.
 */
import type { V1Options } from './types.js';

export function toOfficialOptions(o: V1Options): Record<string, unknown> {
  const opts: Record<string, unknown> = {};

  if (o.model) opts.model = o.model;
  if (o.fallbackModel) opts.fallbackModel = o.fallbackModel;
  if (o.allowedTools && o.allowedTools.length) opts.allowedTools = o.allowedTools;
  if (o.deniedTools && o.deniedTools.length) opts.disallowedTools = o.deniedTools;
  if (o.permissionMode) opts.permissionMode = o.permissionMode;
  if (o.cwd) opts.cwd = o.cwd;
  // The official SDK REPLACES the subprocess env when `env` is set, so spread
  // process.env to preserve the caller's environment (a common footgun).
  if (o.env) opts.env = { ...process.env, ...o.env };
  if (o.addDirectories && o.addDirectories.length) opts.additionalDirectories = o.addDirectories;
  if (o.sessionId) opts.resume = o.sessionId;
  if (o.forkSession) opts.forkSession = true;
  if (o.maxTurns != null) opts.maxTurns = o.maxTurns;
  if (o.abortController) opts.abortController = o.abortController;
  if (o.pathToClaudeCodeExecutable) opts.pathToClaudeCodeExecutable = o.pathToClaudeCodeExecutable;
  if (o.mcpServers) opts.mcpServers = o.mcpServers;
  if (o.canUseTool) opts.canUseTool = o.canUseTool;
  if (o.hooks) opts.hooks = o.hooks;
  if (o.includePartialMessages) opts.includePartialMessages = true;

  // System prompt: append to Claude Code's preset (the SDK defaults to a minimal
  // prompt otherwise, which surprises users porting from the CLI).
  if (o.systemPrompt) {
    opts.systemPrompt = { type: 'preset', preset: 'claude_code', append: o.systemPrompt };
  }

  return opts;
}
