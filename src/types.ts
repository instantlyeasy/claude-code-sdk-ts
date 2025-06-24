// Permission modes for Claude Code operations
export type PermissionMode = 'default' | 'acceptEdits' | 'bypassPermissions';

// Tool names that can be allowed or denied
export type ToolName =
  | 'Read'
  | 'Write'
  | 'Edit'
  | 'Bash'
  | 'Grep'
  | 'Glob'
  | 'LS'
  | 'MultiEdit'
  | 'NotebookRead'
  | 'NotebookEdit'
  | 'WebFetch'
  | 'TodoRead'
  | 'TodoWrite'
  | 'WebSearch'
  | 'Task'
  | 'MCPTool';

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

export interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string | Array<TextBlock | unknown>;
  is_error?: boolean;
}

export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;

// Message types
export interface UserMessage {
  type: 'user';
  content: string;
}

export interface AssistantMessage {
  type: 'assistant';
  content: ContentBlock[];
}

export interface SystemMessage {
  type: 'system';
  subtype?: string;
  data?: any;
}

export interface ResultMessage {
  type: 'result';
  subtype?: string;
  content: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
  cost?: {
    input_cost?: number;
    output_cost?: number;
    cache_creation_cost?: number;
    cache_read_cost?: number;
    total_cost?: number;
  };
}

export type Message = UserMessage | AssistantMessage | SystemMessage | ResultMessage;

// MCP server configuration
export interface MCPServer {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

// Main options interface
export interface ClaudeCodeOptions {
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  tools?: ToolName[];
  allowedTools?: ToolName[];
  deniedTools?: ToolName[];
  mcpServers?: MCPServer[];
  permissionMode?: PermissionMode;
  context?: string[];
  maxTokens?: number;
  temperature?: number;
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
  debug?: boolean;
  addDirectories?: string[];
}

// Additional types for internal use
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

export type CLIOutput = CLIMessage | CLIError | CLIEnd;
