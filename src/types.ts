// Permission modes for Claude Code operations. Mirrors the CLI's
// `--permission-mode` choices (plus `default`, which emits no flag).
export type PermissionMode =
  | 'default'
  | 'acceptEdits'
  | 'bypassPermissions'
  | 'plan'
  | 'auto'
  | 'dontAsk'
  | 'manual';

// Well-known built-in tool names. The CLI also accepts MCP tool names
// (`mcp__server__tool`) and scoped rule patterns (`Bash(npm run test:*)`), so the
// public `ToolName` type is intentionally open: any string is accepted, while the
// known names still autocomplete.
export type KnownToolName =
  | 'Read'
  | 'Write'
  | 'Edit'
  | 'Bash'
  | 'Grep'
  | 'Glob'
  | 'NotebookEdit'
  | 'WebFetch'
  | 'TodoWrite'
  | 'WebSearch'
  | 'Task';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type ToolName = KnownToolName | (string & {});

// Content block types
export interface TextBlock {
  type: 'text';
  text: string;
}

export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

// Extended-thinking content blocks the CLI can emit in assistant messages.
export interface ThinkingBlock {
  type: 'thinking';
  thinking: string;
  signature?: string;
}

export interface RedactedThinkingBlock {
  type: 'redacted_thinking';
  data: string;
}

export interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string | Array<TextBlock | unknown>;
  is_error?: boolean;
}

export type ContentBlock = TextBlock | ThinkingBlock | RedactedThinkingBlock | ToolUseBlock | ToolResultBlock;

// Named usage type matching the CLI's result `usage` object.
export interface Usage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

// Message types
export interface UserMessage {
  type: 'user';
  // The CLI delivers tool results inside `user` messages as content blocks.
  // A plain string is still accepted for prompts echoed back.
  content: string | ContentBlock[];
  session_id?: string;
}

export interface AssistantMessage {
  type: 'assistant';
  content: ContentBlock[];
  session_id?: string;
}

export interface SystemMessage {
  type: 'system';
  subtype?: string;
  session_id?: string;
  /** @deprecated legacy envelope that the CLI never actually emitted; real fields are top-level below */
  data?: unknown;
  // Real top-level fields carried on the CLI's `system`/`init` message.
  uuid?: string;
  model?: string;
  permissionMode?: string;
  tools?: string[];
  mcp_servers?: Array<{ name: string; status: string }>;
  slash_commands?: string[];
  apiKeySource?: string;
  cwd?: string;
}

export interface ResultMessage {
  type: 'result';
  subtype?: string;
  /**
   * Final assistant text. Populated from the CLI's `result` field.
   * (Kept named `content` for backward compatibility with pre-0.3.4 consumers.)
   */
  content: string;
  /** Alias of `content` matching the CLI's own field name. */
  result?: string;
  session_id?: string;
  is_error?: boolean;
  num_turns?: number;
  duration_ms?: number;
  duration_api_ms?: number;
  /** Top-level total cost, matching the CLI's `total_cost_usd` field. */
  total_cost_usd?: number;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
  /** Per-model usage/accounting (CLI `modelUsage`), the authoritative source incl. subagents. */
  modelUsage?: Record<string, unknown>;
  /** Tools the CLI auto-denied during the run (CLI `permission_denials`). */
  permission_denials?: Array<{ tool_name: string; tool_use_id: string; tool_input: Record<string, unknown> }>;
  cost?: {
    input_cost?: number;
    output_cost?: number;
    cache_creation_cost?: number;
    cache_read_cost?: number;
    total_cost?: number;
  };
}

export type Message = UserMessage | AssistantMessage | SystemMessage | ResultMessage;

// MCP server configuration (stdio transport).
// Note: the CLI keys MCP servers by name. Provide `name` to control the key;
// otherwise the SDK synthesizes one (`server0`, `server1`, ...).
export interface MCPServer {
  name?: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

// Import types needed for options
import type { MCPServerPermissionConfig } from './types/permissions.js';

// Main options interface
export interface ClaudeCodeOptions {
  model?: string;
  // Authentication is handled entirely by Claude Code CLI
  tools?: ToolName[];
  allowedTools?: ToolName[];
  deniedTools?: ToolName[];
  mcpServers?: MCPServer[];
  permissionMode?: PermissionMode;
  /** @deprecated Not supported by the claude CLI; ignored (warns once). Removed in a future major. */
  context?: string[];
  /** @deprecated Not supported by the claude CLI; ignored (warns once). Removed in a future major. */
  maxTokens?: number;
  /** @deprecated Not supported by the claude CLI; ignored (warns once). Removed in a future major. */
  temperature?: number;
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
  debug?: boolean;
  /** @deprecated Not supported by the claude CLI; ignored (warns once). Removed in a future major. */
  mcpServerPermissions?: MCPServerPermissionConfig;
  /** @deprecated Not supported by the claude CLI; ignored (warns once). Removed in a future major. */
  configFile?: string;
  /** @deprecated Not supported by the claude CLI; ignored (warns once). Removed in a future major. */
  role?: string;
  // System prompt (sent to the CLI via --append-system-prompt).
  systemPrompt?: string;
  // AbortSignal for cancellation
  signal?: AbortSignal;
  // Session ID for conversation continuity
  sessionId?: string;
  // Additional directories to include in context
  addDirectories?: string[];
  // Explicit path to the `claude` CLI binary. When set, the SDK skips its
  // discovery heuristics and uses this path directly (also used for testing).
  pathToClaudeCodeExecutable?: string;
}

// Additional types for internal use - based on actual Claude Code CLI output
export interface CLIMessage {
  type: 'message';
  data: Message;
}

export interface CLIError {
  type: 'error';
  error: {
    message: string;
    code?: string;
    stack?: string;
  };
}

export interface CLIEnd {
  type: 'end';
}

// Actual CLI output types (what the CLI actually returns on stream-json)
export interface CLIAssistantOutput {
  type: 'assistant';
  message: {
    content: ContentBlock[];
  };
  session_id?: string;
}

// Tool results and other user-role turns arrive as `user` messages.
export interface CLIUserOutput {
  type: 'user';
  message: {
    content: string | ContentBlock[];
  };
  session_id?: string;
}

export interface CLISystemOutput {
  type: 'system';
  subtype?: string;
  session_id?: string;
  uuid?: string;
  model?: string;
  permissionMode?: string;
  tools?: string[];
  mcp_servers?: Array<{ name: string; status: string }>;
  slash_commands?: string[];
  apiKeySource?: string;
  cwd?: string;
}

export interface CLIResultOutput {
  type: 'result';
  subtype?: string;
  // The final text lives in `result` (not `content`).
  result?: string;
  is_error?: boolean;
  num_turns?: number;
  duration_ms?: number;
  duration_api_ms?: number;
  session_id?: string;
  // Cost is a top-level field named `total_cost_usd`.
  total_cost_usd?: number;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
  modelUsage?: Record<string, unknown>;
  permission_denials?: Array<{ tool_name: string; tool_use_id: string; tool_input: Record<string, unknown> }>;
}

export interface CLIErrorOutput {
  type: 'error';
  error: {
    message: string;
    code?: string;
    stack?: string;
  };
}

export type CLIOutput =
  | CLIAssistantOutput
  | CLIUserOutput
  | CLISystemOutput
  | CLIResultOutput
  | CLIErrorOutput
  | CLIMessage
  | CLIError
  | CLIEnd;

// Re-export new permission and configuration types
export * from './types/permissions.js';
export * from './types/config.js';
export * from './types/roles.js';

// Re-export enhanced error types
export * from './types/enhanced-errors.js';

// Re-export streaming types
export * from './types/streaming.js';

// Re-export per-call permission types (excluding ToolPermission which is already
// exported, and ToolPermissionManager which is exported as a class from index.ts
// — re-exporting the like-named interface here shadowed it and confused consumers).
export type {
  ToolOverrides,
  PermissionContext,
  QueryContext,
  DynamicPermissionFunction,
  PermissionResolution,
  PermissionSource,
  PermissionSourceDetails,
  ResolvedPermissions,
  PermissionResolverConfig,
  ConflictResolution,
  AdvancedPermissionOptions,
  PermissionDecision
} from './types/per-call-permissions.js';

// Re-export retry types
export * from './types/retry.js';