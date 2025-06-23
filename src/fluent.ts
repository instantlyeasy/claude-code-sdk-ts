import { query as baseQuery } from './index.js';
import type { ClaudeCodeOptions, Message, ToolName, PermissionMode } from './types.js';
import { ResponseParser } from './parser.js';
import { Logger } from './logger.js';

/**
 * Fluent API for building Claude Code queries with chainable methods
 *
 * @example
 * ```typescript
 * const result = await claude()
 *   .withModel('opus')
 *   .allowTools('Read', 'Write')
 *   .skipPermissions()
 *   .withTimeout(30000)
 *   .onMessage(msg => console.log('Got:', msg.type))
 *   .query('Create a README file')
 *   .asText();
 * ```
 */
export class QueryBuilder {
  protected options: ClaudeCodeOptions = {};
  protected messageHandlers: Array<(message: Message) => void> = [];
  protected logger?: Logger;

  /**
   * Set the model to use
   */
  withModel(model: string): this {
    this.options.model = model;
    return this;
  }

  /**
   * Set allowed tools
   */
  allowTools(...tools: ToolName[]): this {
    this.options.allowedTools = tools;
    return this;
  }

  /**
   * Set denied tools
   */
  denyTools(...tools: ToolName[]): this {
    this.options.deniedTools = tools;
    return this;
  }

  /**
   * Set permission mode
   */
  withPermissions(mode: PermissionMode): this {
    this.options.permissionMode = mode;
    return this;
  }

  /**
   * Skip all permissions (shorthand for bypassPermissions)
   */
  skipPermissions(): this {
    this.options.permissionMode = 'bypassPermissions';
    return this;
  }

  /**
   * Accept all edits automatically
   */
  acceptEdits(): this {
    this.options.permissionMode = 'acceptEdits';
    return this;
  }

  /**
   * Set working directory
   */
  inDirectory(cwd: string): this {
    this.options.cwd = cwd;
    return this;
  }

  /**
   * Set environment variables
   */
  withEnv(env: Record<string, string>): this {
    this.options.env = { ...this.options.env, ...env };
    return this;
  }

  /**
   * Set timeout in milliseconds
   */
  withTimeout(ms: number): this {
    this.options.timeout = ms;
    return this;
  }

  /**
   * Set session ID for continuing an existing conversation
   */
  withSessionId(sessionId: string): this {
    this.options.sessionId = sessionId;
    return this;
  }

  /**
   * Enable debug mode
   */
  debug(enabled = true): this {
    this.options.debug = enabled;
    return this;
  }

  /**
   * Add MCP servers
   */
  withMCP(...servers: NonNullable<ClaudeCodeOptions['mcpServers']>): this {
    this.options.mcpServers = [...(this.options.mcpServers || []), ...servers];
    return this;
  }

  /**
   * Set logger
   */
  withLogger(logger: Logger): this {
    this.logger = logger;
    return this;
  }

  /**
   * Add message handler
   */
  onMessage(handler: (message: Message) => void): this {
    this.messageHandlers.push(handler);
    return this;
  }

  /**
   * Add handler for specific message type
   */
  onAssistant(handler: (content: any) => void): this {
    this.messageHandlers.push(msg => {
      if (msg.type === 'assistant') {
        handler((msg as any).content);
      }
    });
    return this;
  }

  /**
   * Add handler for tool usage
   */
  onToolUse(handler: (tool: { name: string; input: any }) => void): this {
    this.messageHandlers.push(msg => {
      if (msg.type === 'assistant') {
        for (const block of msg.content) {
          if (block.type === 'tool_use') {
            handler({ name: block.name, input: block.input });
          }
        }
      }
    });
    return this;
  }

  /**
   * Execute query and return response parser
   */
  query(prompt: string): ResponseParser {
    const parser = new ResponseParser(baseQuery(prompt, this.options), this.messageHandlers, this.logger);
    return parser;
  }

  /**
   * Create a session builder that maintains session context across queries
   *
   * @example
   * ```typescript
   * const session = claude().withModel('sonnet').withSession();
   * const first = await session.query('Tell me a number').asText();
   * const second = await session.query('What number did you pick?').asText();
   * ```
   */
  withSession(): Session {
    return new Session(this.options, this.messageHandlers, this.logger);
  }

  /**
   * Execute query and return raw async generator (for backward compatibility)
   */
  async *queryRaw(prompt: string): AsyncGenerator<Message> {
    this.logger?.info('Starting query', { prompt, options: this.options });

    for await (const message of baseQuery(prompt, this.options)) {
      this.logger?.debug('Received message', { type: message.type });

      // Run handlers
      for (const handler of this.messageHandlers) {
        try {
          handler(message);
        } catch (error) {
          this.logger?.error('Message handler error', { error });
        }
      }

      yield message;
    }

    this.logger?.info('Query completed');
  }

  /**
   * Static factory method for cleaner syntax
   */
  static create(): QueryBuilder {
    return new QueryBuilder();
  }
}

/**
 * Session-aware parser that extracts and stores session ID after consumption
 */
class SessionAwareParser extends ResponseParser {
  constructor(
    generator: AsyncGenerator<Message>,
    handlers: Array<(message: Message) => void>,
    logger: Logger | undefined,
    private onSessionId: (sessionId: string | null) => void
  ) {
    super(generator, handlers, logger);
  }

  // Override consume to extract session ID - all other methods call this internally
  protected async consume(): Promise<void> {
    await super.consume();

    // Extract session ID directly from messages to avoid calling getSessionId()
    // which would call consume() again
    let sessionId: string | null = null;

    for (const msg of this.messages) {
      if (msg.session_id) {
        sessionId = msg.session_id;
        break;
      }

      // Also check system messages with session data
      if (msg.type === 'system' && msg.data?.session_id) {
        sessionId = msg.data.session_id;
        break;
      }
    }

    this.onSessionId(sessionId);
  }
}

/**
 * Session builder that maintains session context across multiple queries
 */
export class Session extends QueryBuilder {
  private sessionId: string | null = null;

  constructor(
    parentOptions: ClaudeCodeOptions,
    parentHandlers: Array<(message: Message) => void>,
    parentLogger?: Logger
  ) {
    super();
    this.options = { ...parentOptions };
    this.messageHandlers = [...parentHandlers];
    this.logger = parentLogger;
  }

  /**
   * Execute query with automatic session management
   * First query establishes session, subsequent queries use stored session ID
   */
  query(prompt: string): ResponseParser {
    if (this.sessionId) {
      // Use existing session for subsequent queries
      this.options.sessionId = this.sessionId;
      return super.query(prompt);
    } else {
      // First query - establish session and capture session ID
      const generator = baseQuery(prompt, this.options);
      return new SessionAwareParser(generator, this.messageHandlers, this.logger, sessionId => {
        if (sessionId) {
          this.sessionId = sessionId;
        }
      });
    }
  }
}

/**
 * Factory function for creating a new query builder
 *
 * @example
 * ```typescript
 * const response = await claude()
 *   .withModel('sonnet')
 *   .query('Hello')
 *   .asText();
 * ```
 */
export function claude(): QueryBuilder {
  return new QueryBuilder();
}

// Re-export for convenience
export { ResponseParser } from './parser.js';
export { Logger, LogLevel, ConsoleLogger } from './logger.js';
