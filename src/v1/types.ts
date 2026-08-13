/**
 * v1 builder state. A superset of the classic options that this fluent wrapper
 * can express, mapped to the official Agent SDK by `toOfficialOptions`.
 */
import type { ToolName, PermissionMode, MCPServer } from '../types.js';
import type { CanUseTool, HookEvent, HookCallbackMatcher } from '@anthropic-ai/claude-agent-sdk';

export interface V1Options {
  model?: string;
  fallbackModel?: string;
  allowedTools?: ToolName[];
  deniedTools?: ToolName[];
  permissionMode?: PermissionMode;
  cwd?: string;
  env?: Record<string, string>;
  addDirectories?: string[];
  sessionId?: string;
  forkSession?: boolean;
  maxTurns?: number;
  abortController?: AbortController;
  pathToClaudeCodeExecutable?: string;
  systemPrompt?: string;
  /** Official SDK MCP server map (name → config). Passed through untouched. */
  mcpServers?: Record<string, MCPServer & { type?: string; url?: string }>;
  /** Official SDK permission callback — invoked when a tool would prompt. */
  canUseTool?: CanUseTool;
  /** Official SDK hooks: event → matchers. Built up by the builder's hook methods. */
  hooks?: Partial<Record<HookEvent, HookCallbackMatcher[]>>;
  includePartialMessages?: boolean;
}
