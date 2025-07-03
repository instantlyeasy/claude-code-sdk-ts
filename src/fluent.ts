import { query as baseQuery } from './index.js';
import type { 
  ClaudeCodeOptions, 
  Message, 
  ToolName, 
  PermissionMode,
  MCPServerPermissionConfig,
  ContentBlock
} from './types.js';
import { ResponseParser } from './parser.js';
import { Logger } from './logger.js';
import { applyRole, getRoleDefaultPrompt, roleRegistry, type RoleConfig } from './roles.js';

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
  private options: ClaudeCodeOptions = {};
  private messageHandlers: Array<(message: Message) => void> = [];
  private logger?: Logger;
  private currentRole?: string;

  constructor() {
  }

  /**
   * Set the model to use
   */
  withModel(model: string): this {
    this.options.model = model;
    return this;
  }

  /**
   * Set allowed tools
   * Use allowTools() with no arguments to enforce read-only mode (denies all tools)
   */
  allowTools(...tools: ToolName[]): this {
    if (tools.length === 0) {
      // Enforce read-only mode by denying all tools
      const allTools: ToolName[] = [
        'Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob', 'LS',
        'MultiEdit', 'NotebookRead', 'NotebookEdit', 'WebFetch',
        'TodoRead', 'TodoWrite', 'WebSearch', 'Task', 'MCPTool'
      ];
      this.options.deniedTools = allTools;
      this.options.allowedTools = [];
    } else {
      this.options.allowedTools = tools;
    }
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
   * Set AbortSignal for cancellation
   */
  withSignal(signal: AbortSignal): this {
    this.options.signal = signal;
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
   * Add directory(-ies) to include in the context
   */
  addDirectory(directories: string | string[]): this {
    if (!this.options.addDirectories) {
      this.options.addDirectories = [];
    }
    const dirsToAdd = Array.isArray(directories) ? directories : [directories];
    this.options.addDirectories.push(...dirsToAdd);
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
  onAssistant(handler: (content: ContentBlock[]) => void): this {
    this.messageHandlers.push((msg) => {
      if (msg.type === 'assistant') {
        handler(msg.content);
      }
    });
    return this;
  }

  /**
   * Add handler for tool usage
   */
  onToolUse(handler: (tool: { name: string; input: Record<string, unknown> }) => void): this {
    this.messageHandlers.push((msg) => {
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
   * Set MCP server permissions
   */
  withMCPServerPermissions(permissions: MCPServerPermissionConfig): this {
    this.options.mcpServerPermissions = { ...this.options.mcpServerPermissions, ...permissions };
    return this;
  }

  /**
   * Apply a role by name
   */
  withRole(roleName: string): this {
    this.currentRole = roleName;
    this.options = applyRole(roleName, this.options);
    return this;
  }

  /**
   * Register a new role and optionally apply it
   */
  defineRole(role: RoleConfig, apply = false): this {
    roleRegistry.register(role);
    if (apply) {
      return this.withRole(role.name);
    }
    return this;
  }

  /**
   * List available roles
   */
  getAvailableRoles(): RoleConfig[] {
    return roleRegistry.list();
  }

  /**
   * Execute query and return response parser
   */
  query(prompt?: string): ResponseParser {
    // Use role's default prompt if no prompt provided
    const finalPrompt = prompt || (this.currentRole ? getRoleDefaultPrompt(this.currentRole) : undefined);
    
    if (!finalPrompt) {
      throw new Error('No prompt provided and no default prompt available from role');
    }
    
    const parser = new ResponseParser(
      baseQuery(finalPrompt, this.options),
      this.messageHandlers,
      this.logger
    );
    return parser;
  }

  /**
   * Execute query and return raw async generator (for backward compatibility)
   */
  async *queryRaw(prompt?: string): AsyncGenerator<Message> {
    // Use role's default prompt if no prompt provided
    const finalPrompt = prompt || (this.currentRole ? getRoleDefaultPrompt(this.currentRole) : undefined);
    
    if (!finalPrompt) {
      throw new Error('No prompt provided and no default prompt available from role');
    }
    
    this.logger?.info('Starting query', { prompt: finalPrompt, options: this.options });
    
    for await (const message of baseQuery(finalPrompt, this.options)) {
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