import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { 
  MCPConfigSchema, 
  ConfigLoadOptions,
  ToolPermission,
  MCPServerConfig,
  ConfigFormat
} from '../types/config.js';
import type { ClaudeCodeOptions } from '../types.js';
import type { MCPServerPermission } from '../types/permissions.js';
import { ConfigValidationError } from '../errors.js';

/**
 * Loads and validates configuration files
 */
export class ConfigLoader {
  private loadedConfigs: Map<string, MCPConfigSchema> = new Map();

  /**
   * Detect file format based on extension
   */
  private detectFormat(filePath: string): ConfigFormat {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.yaml' || ext === '.yml') return 'yaml';
    return 'json';
  }

  /**
   * Load configuration from file
   */
  async loadFromFile(filePath: string, options?: ConfigLoadOptions): Promise<MCPConfigSchema> {
    const absolutePath = path.resolve(filePath);
    
    try {
      await fs.access(absolutePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`Failed to read configuration file: ${filePath}`);
      }
      throw error;
    }

    // Check for circular inheritance
    if (this.loadedConfigs.has(absolutePath)) {
      const cached = this.loadedConfigs.get(absolutePath)!;
      // If it's a placeholder (empty object), we have circular inheritance
      if (Object.keys(cached).length === 0) {
        throw new Error('Circular inheritance detected');
      }
      return cached;
    }

    // Add placeholder to detect circular references
    this.loadedConfigs.set(absolutePath, {} as MCPConfigSchema);

    try {
      const content = await fs.readFile(absolutePath, 'utf-8');
      const format = options?.format || this.detectFormat(filePath);
      
      const parsed: unknown = format === 'yaml'
        ? await this.parseYAML(content, options)
        : this.parseJSON(content, filePath);
      const cfg = (parsed ?? {}) as Record<string, unknown> & { extends?: string };

      // Handle inheritance if an `extends` field is present.
      if (cfg.extends) {
        const baseConfigPath = path.resolve(path.dirname(absolutePath), cfg.extends);
        const baseConfig = await this.loadFromFile(baseConfigPath, options);
        delete cfg.extends; // Remove extends field after processing
        const merged = this.mergeConfigs(baseConfig, cfg as unknown as MCPConfigSchema);
        // Validate the MERGED result (previously the extends path skipped this,
        // letting invalid permission values through). Then expand env vars.
        const validated = this.validateConfig(merged);
        const expanded = this.expandEnvironmentVariables(validated);
        this.loadedConfigs.set(absolutePath, expanded);
        return expanded;
      }

      const validated = this.validateConfig(cfg);
      const expanded = this.expandEnvironmentVariables(validated);
      this.loadedConfigs.set(absolutePath, expanded);
      return expanded;
    } catch (error) {
      // Clean up on error
      this.loadedConfigs.delete(absolutePath);
      
      throw error;
    }
  }

  /**
   * Parse JSON content
   */
  private parseJSON(content: string, filePath: string): unknown {
    try {
      return JSON.parse(content);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in configuration file: ${filePath}`);
      }
      throw error;
    }
  }

  /**
   * Parse YAML content
   */
  private async parseYAML(content: string, _options?: ConfigLoadOptions): Promise<unknown> {
    try {
      // Dynamically import js-yaml to avoid loading it when not needed
      const yaml = await import('js-yaml');
      // Note: js-yaml has no `strict` option; JSON_SCHEMA already rejects the
      // unsafe/implicit YAML types that "strict" was intended to guard against.
      return yaml.load(content, { schema: yaml.JSON_SCHEMA });
    } catch (error) {
      throw new ConfigValidationError(`Invalid YAML: ${(error as Error).message}`);
    }
  }

  /**
   * Validate configuration against schema
   */
  validateConfig(config: unknown): MCPConfigSchema {
    if (!config || typeof config !== 'object') {
      throw new Error('Configuration must be an object');
    }
    const cfg = config as Record<string, unknown>;
    if (!cfg.version) {
      throw new Error('Configuration must have a version field');
    }

    if (cfg.version !== '1.0') {
      throw new Error(`Unsupported configuration version: ${cfg.version}`);
    }

    // Validate MCP servers
    if (cfg.mcpServers) {
      Object.entries(cfg.mcpServers as Record<string, unknown>).forEach(([serverName, serverConfig]) => {
        this.validateMCPServerConfig(serverName, serverConfig as MCPServerConfig);
      });
    }

    // Validate global settings
    if (cfg.globalSettings) {
      this.validateGlobalSettings(cfg.globalSettings);
    }

    // Validate tools
    if (cfg.tools) {
      this.validateTools(cfg.tools);
    }

    return cfg as unknown as MCPConfigSchema;
  }

  /**
   * Validate MCP server configuration
   */
  private validateMCPServerConfig(serverName: string, config: MCPServerConfig): void {
    const validPermissions: ToolPermission[] = ['allow', 'deny', 'ask'];
    
    if (!validPermissions.includes(config.defaultPermission)) {
      throw new Error(
        `Invalid permission value '${config.defaultPermission}' at mcpServers.${serverName}.defaultPermission`
      );
    }

    if (config.tools) {
      Object.entries(config.tools).forEach(([toolName, permission]) => {
        // Handle complex tool configs that might have nested structure
        const permValue = typeof permission === 'object' && permission !== null
          ? (permission as { permission?: ToolPermission }).permission
          : permission;
        if (permValue && !validPermissions.includes(permValue)) {
          throw new Error(
            `Invalid permission value '${permValue}' at mcpServers.${serverName}.tools.${toolName}`
          );
        }
      });
    }
  }

  /**
   * Validate global settings
   */
  private validateGlobalSettings(settings: unknown): void {
    if (!settings || typeof settings !== 'object') {
      throw new Error('Global settings must be an object');
    }
    const gs = settings as Record<string, unknown>;
    if (gs.defaultToolPermission) {
      const validPermissions: ToolPermission[] = ['allow', 'deny', 'ask'];
      if (!validPermissions.includes(gs.defaultToolPermission as ToolPermission)) {
        throw new Error(`Invalid defaultToolPermission: ${gs.defaultToolPermission}`);
      }
    }

    if (gs.permissionMode) {
      const validModes = ['default', 'acceptEdits', 'bypassPermissions', 'ask'];
      if (!validModes.includes(gs.permissionMode as string)) {
        throw new Error(`Invalid permissionMode: ${gs.permissionMode}`);
      }
    }

    if (gs.timeout && (typeof gs.timeout !== 'number' || gs.timeout <= 0)) {
      throw new Error('Timeout must be a positive number');
    }

    if (gs.temperature !== undefined) {
      if (typeof gs.temperature !== 'number' || gs.temperature < 0 || gs.temperature > 1) {
        throw new Error('Temperature must be between 0 and 1');
      }
    }

    if (gs.maxTokens !== undefined) {
      // Handle string numbers that YAML might produce
      const maxTokens = typeof gs.maxTokens === 'string' ? parseInt(gs.maxTokens as string, 10) : gs.maxTokens;
      if (typeof maxTokens !== 'number' || isNaN(maxTokens) || maxTokens <= 0) {
        throw new Error('maxTokens must be a positive number');
      }
    }
  }

  /**
   * Validate tools configuration
   */
  private validateTools(tools: unknown): void {
    if (!tools || typeof tools !== 'object') {
      throw new Error('Tools configuration must be an object');
    }
    const toolsConfig = tools as Record<string, unknown>;
    if (toolsConfig.allowed && !Array.isArray(toolsConfig.allowed)) {
      throw new Error('tools.allowed must be an array');
    }

    if (toolsConfig.denied && !Array.isArray(toolsConfig.denied)) {
      throw new Error('tools.denied must be an array');
    }
  }

  /**
   * Merge configuration with options
   */
  mergeWithOptions(
    config: MCPConfigSchema, 
    options: ClaudeCodeOptions,
    mergeOptions?: { configPrecedence?: boolean }
  ): ClaudeCodeOptions {
    const merged = { ...options };
    const configPrecedence = mergeOptions?.configPrecedence ?? true;

    // Apply global settings
    if (config.globalSettings) {
      const gs = config.globalSettings;
      
      if (configPrecedence) {
        // Config takes precedence
        if (gs.model !== undefined) merged.model = gs.model;
        if (gs.timeout !== undefined) merged.timeout = gs.timeout;
        if (gs.cwd !== undefined) merged.cwd = gs.cwd;
        if (gs.permissionMode !== undefined) merged.permissionMode = gs.permissionMode;
        if (gs.env !== undefined) merged.env = { ...merged.env, ...gs.env };
        if (gs.temperature !== undefined) merged.temperature = gs.temperature;
        if (gs.maxTokens !== undefined) merged.maxTokens = gs.maxTokens;
      } else {
        // Options take precedence
        merged.model = merged.model ?? gs.model;
        merged.timeout = merged.timeout ?? gs.timeout;
        merged.cwd = merged.cwd ?? gs.cwd;
        merged.permissionMode = merged.permissionMode ?? gs.permissionMode;
        merged.env = { ...gs.env, ...merged.env };
        merged.temperature = merged.temperature ?? gs.temperature;
        merged.maxTokens = merged.maxTokens ?? gs.maxTokens;
      }
    }

    // Apply MCP server permissions
    if (config.mcpServers) {
      const mcpServerPermissions: Record<string, MCPServerPermission> = {};
      
      Object.entries(config.mcpServers).forEach(([serverName, serverConfig]) => {
        // Map tool permissions to MCP server permissions
        const permissionMap: Record<ToolPermission, MCPServerPermission> = {
          'allow': 'whitelist',
          'deny': 'blacklist',
          'ask': 'ask'
        };
        
        mcpServerPermissions[serverName] = permissionMap[serverConfig.defaultPermission];
      });
      
      merged.mcpServerPermissions = {
        ...merged.mcpServerPermissions,
        ...mcpServerPermissions
      };
    }

    // Apply tool permissions
    if (config.tools) {
      if (config.tools.allowed) {
        merged.allowedTools = [
          ...config.tools.allowed,
          ...(merged.allowedTools || [])
        ];
      }
      
      if (config.tools.denied) {
        merged.deniedTools = [
          ...config.tools.denied,
          ...(merged.deniedTools || [])
        ];
      }
    }

    return merged;
  }

  /**
   * Expand environment variables in configuration
   */
  expandEnvironmentVariables(config: MCPConfigSchema): MCPConfigSchema {
    const expanded = JSON.parse(JSON.stringify(config)); // Deep clone
    
    const expandValue = (value: unknown): unknown => {
      if (typeof value === 'string') {
        return value.replace(/\$\{([^}]+)\}/g, (_match, varName) => {
          const envValue = process.env[varName];
          if (envValue === undefined) {
            throw new Error(`Environment variable ${varName} not found`);
          }
          return envValue;
        });
      } else if (typeof value === 'object' && value !== null) {
        const record = value as Record<string, unknown>;
        Object.keys(record).forEach(key => {
          record[key] = expandValue(record[key]);
        });
      }
      return value;
    };

    return expandValue(expanded) as MCPConfigSchema;
  }

  /**
   * Merge two configurations
   */
  private mergeConfigs(base: MCPConfigSchema, override: MCPConfigSchema): MCPConfigSchema {
    const merged: MCPConfigSchema = {
      version: override.version || base.version
    };

    // Merge global settings
    if (base.globalSettings || override.globalSettings) {
      merged.globalSettings = {
        ...base.globalSettings,
        ...override.globalSettings
      };
    }

    // Merge MCP servers
    if (base.mcpServers || override.mcpServers) {
      merged.mcpServers = {
        ...base.mcpServers,
        ...override.mcpServers
      };
    }

    // Merge tools
    if (base.tools || override.tools) {
      merged.tools = {
        allowed: [
          ...(base.tools?.allowed || []),
          ...(override.tools?.allowed || [])
        ],
        denied: [
          ...(base.tools?.denied || []),
          ...(override.tools?.denied || [])
        ]
      };
    }

    return merged;
  }

  /**
   * Clear loaded configurations cache
   */
  clearCache(): void {
    this.loadedConfigs.clear();
  }

  /**
   * Get a cached configuration
   */
  getCached(filePath: string): MCPConfigSchema | undefined {
    return this.loadedConfigs.get(filePath);
  }
}