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
import { runV1Query } from './query-runner.js';

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
  withMCP(servers: NonNullable<V1Options['mcpServers']>): this {
    this.options.mcpServers = { ...this.options.mcpServers, ...servers };
    return this;
  }

  /** Register an official-SDK `canUseTool` permission callback. */
  withPermissionHandler(handler: unknown): this {
    this.options.canUseTool = handler;
    return this;
  }

  /** Register official-SDK hooks. */
  withHooks(hooks: unknown): this {
    this.options.hooks = hooks;
    return this;
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
