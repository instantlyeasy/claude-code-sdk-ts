import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { 
  RoleDefinition, 
  RolesConfig, 
  RoleValidationResult,
  RoleApplicationOptions,
  RoleInheritanceChain
} from '../types/roles.js';
import type { ClaudeCodeOptions } from '../types.js';
import type { ConfigFormat, ConfigLoadOptions } from '../types/config.js';
import { ConfigValidationError } from '../errors.js';

/**
 * Manages role definitions and applications
 */
export class RoleManager {
  private roles: Map<string, RoleDefinition> = new Map();
  private defaultRole: string | undefined;

  /**
   * Add a role definition
   */
  addRole(role: RoleDefinition): RoleManager {
    const validation = this.validateRole(role);
    if (!validation.valid) {
      throw new Error(`Invalid role definition: ${validation.errors?.join(', ')}`);
    }
    
    this.roles.set(role.name, role);
    return this;
  }

  /**
   * Get a role by name
   */
  getRole(name: string): RoleDefinition | undefined {
    return this.roles.get(name);
  }

  /**
   * Check if a role exists
   */
  hasRole(name: string): boolean {
    return this.roles.has(name);
  }

  /**
   * List all role names
   */
  listRoles(): string[] {
    return Array.from(this.roles.keys());
  }

  /**
   * Set the default role
   */
  setDefaultRole(name: string): RoleManager {
    if (!this.roles.has(name)) {
      throw new Error(`Role '${name}' not found`);
    }
    this.defaultRole = name;
    return this;
  }

  /**
   * Get the default role
   */
  getDefaultRole(): string | undefined {
    return this.defaultRole;
  }

  /**
   * Detect file format based on extension
   */
  private detectFormat(filePath: string): ConfigFormat {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.yaml' || ext === '.yml') return 'yaml';
    return 'json';
  }

  /**
   * Parse JSON content
   */
  private parseJSON(content: string, filePath: string): unknown {
    try {
      return JSON.parse(content);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in roles file: ${filePath}`);
      }
      throw error;
    }
  }

  /**
   * Parse YAML content
   */
  private async parseYAML(content: string, _options?: ConfigLoadOptions): Promise<unknown> {
    try {
      const yaml = await import('js-yaml');
      // js-yaml has no `strict` option; JSON_SCHEMA is the safe schema.
      return yaml.load(content, { schema: yaml.JSON_SCHEMA });
    } catch (error) {
      throw new ConfigValidationError(`Invalid YAML: ${(error as Error).message}`);
    }
  }

  /**
   * Load roles from a configuration file
   */
  async loadFromFile(filePath: string, options?: ConfigLoadOptions): Promise<void> {
    try {
      await fs.access(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`Failed to read roles file: ${filePath}`);
      }
      throw error;
    }

    const content = await fs.readFile(filePath, 'utf-8');
    const format = options?.format || this.detectFormat(filePath);
    
    const parsed: unknown = format === 'yaml'
      ? await this.parseYAML(content, options)
      : this.parseJSON(content, filePath);

    this.loadFromConfig(parsed as RolesConfig);
  }

  /**
   * Load roles from configuration object
   */
  loadFromConfig(config: RolesConfig): void {
    if (config.version !== '1.0') {
      throw new Error(`Unsupported roles configuration version: ${config.version}`);
    }

    // Clear existing roles
    this.roles.clear();

    // Add all roles
    Object.entries(config.roles).forEach(([name, roleConfig]) => {
      const role: RoleDefinition = {
        name,
        ...roleConfig
      };
      this.addRole(role);
    });

    // Set default role if specified
    if (config.defaultRole) {
      this.setDefaultRole(config.defaultRole);
    }
  }

  /**
   * Apply a role to options
   */
  applyRole(
    roleName: string, 
    options: ClaudeCodeOptions,
    applicationOptions?: RoleApplicationOptions
  ): ClaudeCodeOptions {
    const role = this.getRole(roleName);
    if (!role) {
      throw new Error(`Role '${roleName}' not found`);
    }

    // Resolve inheritance
    const resolvedRole = this.resolveInheritance(role);
    
    return this.applyRoleToOptions(resolvedRole, options, applicationOptions);
  }

  /**
   * Resolve role inheritance
   */
  resolveInheritance(role: RoleDefinition): RoleDefinition {
    const chain = this.getInheritanceChain(role);
    
    if (chain.hasCircularDependency) {
      throw new Error('Circular inheritance detected');
    }

    // Start with empty role
    let resolved: RoleDefinition = {
      name: role.name,
      model: role.model,
      permissions: {}
    };

    // Apply inheritance from parent to child
    for (let i = chain.chain.length - 1; i >= 0; i--) {
      const roleName = chain.chain[i];
      if (!roleName) continue;
      const currentRole = this.getRole(roleName);
      if (!currentRole) continue;
      
      resolved = this.mergeRoles(resolved, currentRole);
    }

    return resolved;
  }

  /**
   * Get inheritance chain for a role
   */
  private getInheritanceChain(role: RoleDefinition, visited: Set<string> = new Set()): RoleInheritanceChain {
    const chain: string[] = [role.name];
    
    if (visited.has(role.name)) {
      return { chain, hasCircularDependency: true };
    }
    
    visited.add(role.name);
    
    if (role.extends) {
      const parent = this.getRole(role.extends);
      if (!parent) {
        throw new Error(`Parent role '${role.extends}' not found`);
      }
      
      const parentChain = this.getInheritanceChain(parent, visited);
      chain.push(...parentChain.chain);
      
      if (parentChain.hasCircularDependency) {
        return { chain, hasCircularDependency: true };
      }
    }
    
    return { chain, hasCircularDependency: false };
  }

  /**
   * Merge two roles (child overrides parent)
   */
  private mergeRoles(parent: RoleDefinition, child: RoleDefinition): RoleDefinition {
    const merged: RoleDefinition = {
      name: child.name,
      model: child.model || parent.model,
      permissions: {
        ...(parent.permissions || {}),
        mode: child.permissions?.mode || parent.permissions?.mode,
        mcpServers: {
          ...(parent.permissions?.mcpServers || {}),
          ...(child.permissions?.mcpServers || {})
        },
        tools: {
          allowed: [
            ...(parent.permissions?.tools?.allowed || []),
            ...(child.permissions?.tools?.allowed || [])
          ],
          denied: [
            ...(parent.permissions?.tools?.denied || []),
            ...(child.permissions?.tools?.denied || [])
          ]
        }
      }
    };

    // Merge optional fields
    if (parent.description || child.description) {
      merged.description = child.description || parent.description;
    }

    if (parent.promptingTemplate || child.promptingTemplate) {
      merged.promptingTemplate = child.promptingTemplate || parent.promptingTemplate;
    }

    if (parent.systemPrompt || child.systemPrompt) {
      merged.systemPrompt = child.systemPrompt || parent.systemPrompt;
    }

    // Merge context
    if (parent.context || child.context) {
      merged.context = {
        ...parent.context,
        ...child.context
      };
    }

    // Merge metadata
    if (parent.metadata || child.metadata) {
      merged.metadata = {
        ...parent.metadata,
        ...child.metadata
      };
    }

    return merged;
  }

  /**
   * Apply role definition to options
   */
  private applyRoleToOptions(
    role: RoleDefinition, 
    options: ClaudeCodeOptions,
    applicationOptions?: RoleApplicationOptions
  ): ClaudeCodeOptions {
    const applied = { ...options };
    const override = applicationOptions?.override ?? true;

    // Apply model
    if (override || !applied.model) {
      applied.model = role.model;
    }

    // Apply permissions
    if (role.permissions.mode && (override || !applied.permissionMode)) {
      applied.permissionMode = role.permissions.mode;
    }

    // Apply MCP server permissions
    if (role.permissions.mcpServers && Object.keys(role.permissions.mcpServers).length > 0) {
      applied.mcpServerPermissions = {
        ...(applied.mcpServerPermissions || {}),
        ...role.permissions.mcpServers
      };
    }

    // Apply tools
    if (role.permissions.tools?.allowed) {
      if (applicationOptions?.mergeArrays) {
        applied.allowedTools = [
          ...(applied.allowedTools || []),
          ...role.permissions.tools.allowed
        ];
      } else {
        applied.allowedTools = role.permissions.tools.allowed;
      }
    }

    if (role.permissions.tools?.denied) {
      if (applicationOptions?.mergeArrays) {
        applied.deniedTools = [
          ...(applied.deniedTools || []),
          ...role.permissions.tools.denied
        ];
      } else {
        applied.deniedTools = role.permissions.tools.denied;
      }
    }

    // Apply context
    if (role.context) {
      if (role.context.maxTokens && (override || !applied.maxTokens)) {
        applied.maxTokens = role.context.maxTokens;
      }
      if (role.context.temperature !== undefined && (override || applied.temperature === undefined)) {
        applied.temperature = role.context.temperature;
      }
      if (role.context.additionalContext) {
        applied.context = [
          ...(applied.context || []),
          ...role.context.additionalContext
        ];
      }
    }

    // Apply system prompt
    if (role.systemPrompt && (override || !applied.systemPrompt)) {
      applied.systemPrompt = role.systemPrompt;
    }

    return applied;
  }

  /**
   * Validate a role definition
   */
  validateRole(role: RoleDefinition): RoleValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!role.name) {
      errors.push('Role must have a name');
    }

    if (!role.model) {
      errors.push('Role "' + role.name + '" must have a model');
    } else {
      const validModels = ['opus', 'sonnet', 'haiku', 'claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'];
      if (!validModels.some(m => role.model.includes(m))) {
        errors.push(`Invalid model '${role.model}'`);
      }
    }

    // Validate permissions
    if (role.permissions?.mode) {
      const validModes = ['default', 'acceptEdits', 'bypassPermissions'];
      if (!validModes.includes(role.permissions.mode)) {
        errors.push('Invalid permission mode');
      }
      
      if (role.permissions.mode === 'bypassPermissions') {
        warnings.push('bypassPermissions mode may pose security risks');
      }
    }

    // Validate context
    if (role.context) {
      if (role.context.temperature !== undefined) {
        if (role.context.temperature < 0 || role.context.temperature > 1) {
          errors.push('Temperature must be between 0 and 1');
        } else if (role.context.temperature > 0.9) {
          warnings.push(`High temperature (${role.context.temperature}) may produce inconsistent results`);
        }
      }
      
      if (role.context.maxTokens !== undefined && role.context.maxTokens <= 0) {
        errors.push('Max tokens must be positive');
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Get prompting template with variable interpolation
   */
  getPromptingTemplate(roleName: string, variables: Record<string, string>): string {
    const role = this.getRole(roleName);
    if (!role || !role.promptingTemplate) {
      throw new Error(`No prompting template found for role '${roleName}'`);
    }

    return this.interpolateTemplate(role.promptingTemplate, variables);
  }

  /**
   * Get full prompt including system prompt and template
   */
  getFullPrompt(
    roleName: string, 
    variables: Record<string, string>, 
    userPrompt: string
  ): string {
    const role = this.getRole(roleName);
    if (!role) {
      throw new Error(`Role '${roleName}' not found`);
    }

    const parts: string[] = [];
    
    if (role.systemPrompt) {
      parts.push(role.systemPrompt);
    }
    
    if (role.promptingTemplate) {
      parts.push(this.interpolateTemplate(role.promptingTemplate, variables));
    }
    
    parts.push(userPrompt);
    
    return parts.join('\n\n');
  }

  /**
   * Interpolate template variables
   */
  private interpolateTemplate(template: string, variables: Record<string, string>): string {
    return template.replace(/\$\{([^}]+)\}/g, (_match, varName) => {
      if (!(varName in variables)) {
        throw new Error(`Missing template variable: ${varName}`);
      }
      return variables[varName] ?? '';
    });
  }

  /**
   * Export configuration
   */
  exportConfig(): RolesConfig {
    const config: RolesConfig = {
      version: '1.0',
      roles: {}
    };

    this.roles.forEach((role, name) => {
      const { name: _, ...roleConfig } = role;
      config.roles[name] = roleConfig;
    });

    if (this.defaultRole) {
      config.defaultRole = this.defaultRole;
    }

    return config;
  }

  /**
   * Clear all roles
   */
  clear(): void {
    this.roles.clear();
    this.defaultRole = undefined;
  }

  /**
   * Get count of roles
   */
  get size(): number {
    return this.roles.size;
  }
}