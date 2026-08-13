/**
 * v1 builder state. A superset of the classic options that this fluent wrapper
 * can express, mapped to the official Agent SDK by `toOfficialOptions`.
 */
import type { ToolName, PermissionMode, MCPServer } from '../types.js';

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
  /** Official SDK permission callback. Passed through untouched. */
  canUseTool?: unknown;
  /** Official SDK hooks map. Passed through untouched. */
  hooks?: unknown;
  includePartialMessages?: boolean;
}
