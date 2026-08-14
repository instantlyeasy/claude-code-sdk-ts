/**
 * v1 fluent builder — the same ergonomic `claude()` surface as the classic API,
 * but every query runs through the official `@anthropic-ai/claude-agent-sdk`
 * instead of this package's own subprocess transport.
 *
 * The returned `ResponseParser` is the exact same class the classic API uses, so
 * `.asText()`, `.asResult()`, `.getUsage()`, `.asToolExecutions()`, etc. all work
 * unchanged — but now backed by the official SDK's correct wire parsing.
 *
 * Status: this is the initial vertical slice (see V1_STATUS.md). The core query
 * path is functional; richer passthroughs (hooks, canUseTool, in-process MCP,
 * sessions, structured outputs, partial streaming) are stubbed on `V1Options`
 * and will get first-class builder methods next.
 */
import type { ToolName, PermissionMode, Message } from '../types.js';
import { ResponseParser } from '../parser.js';
import type { Logger } from '../logger.js';
import type { V1Options } from './types.js';
import { runV1Query, streamTextDeltas } from './query-runner.js';
import { V1Session } from './session.js';
import type {
  CanUseTool,
  HookEvent,
  HookCallback,
  McpServerConfig,
  McpSdkServerConfigWithInstance,
  OutputFormat
} from '@anthropic-ai/claude-agent-sdk';

export class V1QueryBuilder {
  private options: V1Options = {};
  private messageHandlers: Array<(message: Message) => void> = [];
  private logger?: Logger;

  withModel(model: string): this {
    this.options.model = model;
    return this;
  }

  withFallbackModel(model: string): this {
    this.options.fallbackModel = model;
    return this;
  }

  allowTools(...tools: ToolName[]): this {
    if (tools.length === 0) {
      // Read-only: deny only the mutating tools.
      this.options.deniedTools = ['Write', 'Edit', 'MultiEdit', 'Bash', 'NotebookEdit', 'TodoWrite'];
      this.options.allowedTools = undefined;
    } else {
      this.options.allowedTools = tools;
    }
    return this;
  }

  denyTools(...tools: ToolName[]): this {
    this.options.deniedTools = tools;
    return this;
  }

  withPermissions(mode: PermissionMode): this {
    this.options.permissionMode = mode;
    return this;
  }

  skipPermissions(): this {
    this.options.permissionMode = 'bypassPermissions';
    return this;
  }

  acceptEdits(): this {
    this.options.permissionMode = 'acceptEdits';
    return this;
  }

  inDirectory(cwd: string): this {
    this.options.cwd = cwd;
    return this;
  }

  withEnv(env: Record<string, string>): this {
    this.options.env = { ...this.options.env, ...env };
    return this;
  }

  withSignal(signal: AbortSignal): this {
    // The official SDK takes an AbortController; adapt a bare signal by wiring
    // it to a controller we abort when the signal fires.
    const controller = new AbortController();
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', () => controller.abort(), { once: true });
    this.options.abortController = controller;
    return this;
  }

  withSessionId(sessionId: string): this {
    this.options.sessionId = sessionId;
    return this;
  }

  forkSession(fork = true): this {
    this.options.forkSession = fork;
    return this;
  }

  withMaxTurns(maxTurns: number): this {
    this.options.maxTurns = maxTurns;
    return this;
  }

  withSystemPrompt(systemPrompt: string): this {
    this.options.systemPrompt = systemPrompt;
    return this;
  }

  addDirectory(directories: string | string[]): this {
    const list = Array.isArray(directories) ? directories : [directories];
    this.options.addDirectories = [...(this.options.addDirectories ?? []), ...list];
    return this;
  }

  /** Point at a specific `claude` binary (else the official SDK's bundled one). */
  withExecutable(path: string): this {
    this.options.pathToClaudeCodeExecutable = path;
    return this;
  }

  /** Pass an official-SDK MCP server map straight through (name → config). */
  withMCP(servers: Record<string, McpServerConfig>): this {
    this.options.mcpServers = { ...this.options.mcpServers, ...servers };
    return this;
  }

  /**
   * Register a single MCP server, keyed by its `name`. Accepts an in-process
   * server from `createSdkMcpServer(...)` (the official SDK's custom-tool
   * mechanism) or any stdio/SSE/HTTP config that carries a `name`.
   *
   * @example
   * ```typescript
   * import { claude, createSdkMcpServer, tool } from '@instantlyeasy/claude-code-sdk-ts/v1';
   * import { z } from 'zod';
   *
   * const server = createSdkMcpServer({
   *   name: 'math',
   *   tools: [tool('add', 'Add two numbers', { a: z.number(), b: z.number() },
   *     async ({ a, b }) => ({ content: [{ type: 'text', text: String(a + b) }] }))]
   * });
   * claude().withMCPServer(server).allowTools('mcp__math__add').query('what is 2+2?');
   * ```
   */
  withMCPServer(server: McpSdkServerConfigWithInstance | (McpServerConfig & { name: string })): this {
    this.options.mcpServers = { ...this.options.mcpServers, [server.name]: server };
    return this;
  }

  /** Request structured output matching a JSON schema (result on `asStructured()`). */
  withOutputFormat(schema: Record<string, unknown>): this {
    this.options.outputFormat = { type: 'json_schema', schema } as OutputFormat;
    return this;
  }

  /** Resume a prior session by id (alias for withSessionId). */
  resume(sessionId: string): this {
    this.options.sessionId = sessionId;
    return this;
  }

  /**
   * Register a permission callback, invoked whenever a tool call would otherwise
   * prompt. Return `{ behavior: 'allow', updatedInput? }` to permit (optionally
   * rewriting the input) or `{ behavior: 'deny', message }` to block it.
   *
   * @example
   * ```typescript
   * claude().canUseTool(async (tool, input) =>
   *   tool === 'Bash' && String(input.command).startsWith('rm')
   *     ? { behavior: 'deny', message: 'no rm' }
   *     : { behavior: 'allow' }
   * );
   * ```
   */
  canUseTool(handler: CanUseTool): this {
    this.options.canUseTool = handler;
    return this;
  }

  /**
   * Register a lifecycle hook for any of the official SDK's hook events. Multiple
   * hooks for the same event are appended (each as its own matcher).
   *
   * @param event   the hook event (e.g. 'PreToolUse', 'PostToolUse', 'Stop')
   * @param callback the hook callback
   * @param opts    optional `matcher` (tool-name pattern) and `timeout` (seconds)
   */
  addHook(event: HookEvent, callback: HookCallback, opts: { matcher?: string; timeout?: number } = {}): this {
    const hooks = (this.options.hooks ??= {});
    const matchers = (hooks[event] ??= []);
    matchers.push({ matcher: opts.matcher, hooks: [callback], timeout: opts.timeout });
    return this;
  }

  /** Convenience: run `callback` before each matching tool call. */
  onPreToolUse(callback: HookCallback, opts?: { matcher?: string; timeout?: number }): this {
    return this.addHook('PreToolUse', callback, opts);
  }

  /** Convenience: run `callback` after each matching tool call completes. */
  onPostToolUse(callback: HookCallback, opts?: { matcher?: string; timeout?: number }): this {
    return this.addHook('PostToolUse', callback, opts);
  }

  /** Convenience: run `callback` when the user prompt is submitted. */
  onUserPromptSubmit(callback: HookCallback, opts?: { timeout?: number }): this {
    return this.addHook('UserPromptSubmit', callback, opts);
  }

  /** Convenience: run `callback` when the agent stops. */
  onStop(callback: HookCallback, opts?: { timeout?: number }): this {
    return this.addHook('Stop', callback, opts);
  }

  withLogger(logger: Logger): this {
    this.logger = logger;
    return this;
  }

  onMessage(handler: (message: Message) => void): this {
    this.messageHandlers.push(handler);
    return this;
  }

  /** Execute the query through the official SDK and return a ResponseParser. */
  query(prompt: string): ResponseParser {
    return new ResponseParser(
      runV1Query(prompt, this.options),
      this.messageHandlers,
      this.logger
    );
  }

  /** Raw message stream (official SDK messages adapted to classic `Message`s). */
  queryRaw(prompt: string): AsyncGenerator<Message> {
    return runV1Query(prompt, this.options);
  }

  /**
   * Stream real incremental text tokens as the model generates them (backed by
   * the official SDK's `stream_event` deltas — not the classic word-splitting).
   *
   * @example
   * ```typescript
   * for await (const token of claude().streamText('Write a haiku')) {
   *   process.stdout.write(token);
   * }
   * ```
   */
  streamText(prompt: string): AsyncGenerator<string> {
    return streamTextDeltas(prompt, this.options);
  }

  /**
   * Open a persistent bidirectional session: send multiple messages, iterate the
   * live message stream, and use mid-run controls (interrupt / setModel /
   * setPermissionMode). Close it with `await session.close()`.
   *
   * @param initialPrompt optional first message to send immediately
   */
  session(initialPrompt?: string): V1Session {
    return new V1Session(this.options, initialPrompt);
  }

  static create(): V1QueryBuilder {
    return new V1QueryBuilder();
  }
}

/**
 * Create a v1 query builder backed by the official Agent SDK.
 *
 * @example
 * ```typescript
 * import { claude } from '@instantlyeasy/claude-code-sdk-ts/v1';
 *
 * const text = await claude()
 *   .withModel('sonnet')
 *   .allowTools('Read', 'Grep')
 *   .query('Summarize the README')
 *   .asText();
 * ```
 */
export function claude(): V1QueryBuilder {
  return new V1QueryBuilder();
}
