import { query as baseQuery } from './index.js';
import type { 
  ClaudeCodeOptions, 
  Message, 
  ToolName, 
  PermissionMode,
  MCPServerPermission,
  MCPServerPermissionConfig,
  MCPConfigSchema,
  RoleDefinition,
  ContentBlock
} from './types.js';
import { ResponseParser } from './parser.js';
import { Logger } from './logger.js';
import { PermissionManager } from './permissions/manager.js';
import { ConfigLoader } from './config/loader.js';
import { RoleManager } from './roles/manager.js';

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
  private permissionManager: PermissionManager;
  private configLoader: ConfigLoader;
  private roleManager: RoleManager;
  private rolePromptingTemplate?: string;
  private roleTemplateVariables?: Record<string, string>;

  constructor() {
    this.permissionManager = new PermissionManager();
    this.configLoader = new ConfigLoader();
    this.roleManager = new RoleManager();
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
      // Enforce read-only mode by denying only the mutating tools, leaving
      // read-only tools (Read, Grep, Glob, ...) available.
      const mutatingTools: ToolName[] = [
        'Write', 'Edit', 'MultiEdit', 'Bash', 'NotebookEdit', 'TodoWrite'
      ];
      this.options.deniedTools = mutatingTools;
      this.options.allowedTools = undefined;
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
   * Point at a specific `claude` binary instead of the SDK's discovery.
   */
  withExecutable(path: string): this {
    this.options.pathToClaudeCodeExecutable = path;
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
   * Set MCP server permission
   */
  withMCPServerPermission(serverName: string, permission: MCPServerPermission): this {
    this.permissionManager.setMCPServerPermission(serverName, permission);
    return this;
  }

  /**
   * Set multiple MCP server permissions
   */
  withMCPServerPermissions(permissions: MCPServerPermissionConfig): this {
    this.permissionManager.setMCPServerPermissions(permissions);
    return this;
  }

  /**
   * Load configuration from file
   */
  async withConfigFile(filePath: string): Promise<this> {
    const config = await this.configLoader.loadFromFile(filePath);
    this.applyConfig(config);
    return this;
  }

  /**
   * Apply configuration object
   */
  withConfig(config: MCPConfigSchema): this {
    this.configLoader.validateConfig(config);
    this.applyConfig(config);
    return this;
  }

  /**
   * Load roles from file
   */
  async withRolesFile(filePath: string): Promise<this> {
    await this.roleManager.loadFromFile(filePath);
    return this;
  }

  /**
   * Apply a role by name
   */
  withRole(roleName: string, templateVariables?: Record<string, string>): this;
  /**
   * Apply a role definition directly with template variables
   */
  withRole(role: RoleDefinition, templateVariables?: Record<string, string>): this;
  withRole(
    roleOrName: string | RoleDefinition,
    templateVariables?: Record<string, string>
  ): this {
    if (typeof roleOrName === 'string') {
      const options = this.roleManager.applyRole(roleOrName, this.options);
      this.options = options;

      // Store role template info if available
      const role = this.roleManager.getRole(roleOrName);
      if (role?.promptingTemplate) {
        this.rolePromptingTemplate = role.promptingTemplate;
        // Store the variables so the template is actually interpolated
        // (previously dropped for the string-name overload).
        this.roleTemplateVariables = templateVariables;
      }
      if (role?.systemPrompt) {
        this.options.systemPrompt = role.systemPrompt;
      }
    } else {
      // Add role to manager and apply
      this.roleManager.addRole(roleOrName);
      const options = this.roleManager.applyRole(roleOrName.name, this.options);
      this.options = options;
      
      if (roleOrName.promptingTemplate) {
        this.rolePromptingTemplate = roleOrName.promptingTemplate;
        this.roleTemplateVariables = templateVariables;
      }
      if (roleOrName.systemPrompt) {
        this.options.systemPrompt = roleOrName.systemPrompt;
      }
    }
    
    return this;
  }

  /**
   * Apply configuration to options
   */
  private applyConfig(config: MCPConfigSchema): void {
    this.options = this.configLoader.mergeWithOptions(config, this.options);
  }

  /**
   * Execute query and return response parser
   */
  query(prompt: string): ResponseParser {
    const { finalPrompt, finalOptions } = this.buildQuery(prompt);
    return new ResponseParser(
      baseQuery(finalPrompt, finalOptions),
      this.messageHandlers,
      this.logger
    );
  }

  /**
   * Resolve the final prompt and options for a query.
   *
   * The role prompting template (a *prompt* template) is still woven into the
   * prompt here. The system prompt, however, is now delivered as a real CLI
   * flag (`--append-system-prompt`) rather than being prepended to the user
   * prompt, so it is left on the options untouched.
   */
  private buildQuery(prompt: string): { finalPrompt: string; finalOptions: ClaudeCodeOptions } {
    const finalOptions = this.permissionManager.applyToOptions(this.options);

    let finalPrompt = prompt;
    if (this.rolePromptingTemplate) {
      const vars = this.roleTemplateVariables ?? {};
      const templatedPrompt = this.rolePromptingTemplate.replace(
        /\$\{([^}]+)\}/g,
        (match, varName) => vars[varName] ?? match
      );
      finalPrompt = `${templatedPrompt}\n\n${prompt}`;
    }

    return { finalPrompt, finalOptions };
  }

  /**
   * Execute query and return raw async generator (for backward compatibility)
   */
  async *queryRaw(prompt: string): AsyncGenerator<Message> {
    const { finalPrompt, finalOptions } = this.buildQuery(prompt);

    // Log only non-sensitive metadata. The full prompt frequently contains user
    // PII / proprietary code, and options.env commonly holds credentials, so
    // neither is logged. (Set debug for the CLI-level stream trace instead.)
    this.logger?.info('Starting query', {
      model: finalOptions.model,
      promptLength: finalPrompt.length,
      allowedTools: finalOptions.allowedTools?.length ?? 0,
      deniedTools: finalOptions.deniedTools?.length ?? 0,
      permissionMode: finalOptions.permissionMode
    });

    for await (const message of baseQuery(finalPrompt, finalOptions)) {
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