/**
 * v1 entry point — the fluent wrapper over the official Agent SDK.
 *
 * Import via the subpath so it stays clearly separate from the classic
 * subprocess-based API until v1.0 promotes it to the default:
 *
 *   import { claude } from '@instantlyeasy/claude-code-sdk-ts/v1';
 */
export { claude, V1QueryBuilder } from './builder.js';
export { runV1Query } from './query-runner.js';
export { toOfficialOptions } from './options.js';
export { adaptOfficialMessage } from './adapter.js';
export type { V1Options } from './types.js';

// In-process MCP servers + custom tools, and session utilities — re-exported
// from the official SDK so v1 consumers get them from this single entry point.
export {
  createSdkMcpServer,
  tool,
  listSessions,
  getSessionInfo,
  getSessionMessages,
  forkSession,
  renameSession,
  deleteSession
} from '@anthropic-ai/claude-agent-sdk';

// Re-export the shared response surface so v1 consumers need only one import.
export { ResponseParser, type ToolExecution, type UsageStats } from '../parser.js';
export type {
  Message,
  AssistantMessage,
  UserMessage,
  SystemMessage,
  ResultMessage,
  ContentBlock,
  ToolName,
  PermissionMode
} from '../types.js';

// Re-export the official permission + hook types so consumers can type their
// canUseTool / hook callbacks from this single entry point.
export type {
  CanUseTool,
  PermissionResult,
  PermissionUpdate,
  HookEvent,
  HookCallback,
  HookCallbackMatcher,
  HookInput,
  HookJSONOutput,
  McpServerConfig,
  McpSdkServerConfigWithInstance,
  SdkMcpToolDefinition,
  OutputFormat,
  SDKSessionInfo,
  SessionMessage
} from '@anthropic-ai/claude-agent-sdk';
