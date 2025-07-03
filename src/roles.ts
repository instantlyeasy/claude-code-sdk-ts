/**
 * Role system for Claude Code SDK
 * 
 * Roles are preconfigured sets of fluent API methods that can be applied as a unit.
 * This allows users to define common configurations once and reuse them easily.
 */

import type { ClaudeCodeOptions, ToolName } from './types.js';

/**
 * Configuration for a role - defines what methods should be applied
 */
export interface RoleConfig {
  /** Role name/identifier */
  name: string;
  
  /** Description of what this role does */
  description?: string;
  
  /** Default prompt to use when no prompt is provided */
  defaultPrompt?: string;
  
  /** Claude Code options to apply */
  options?: Partial<ClaudeCodeOptions>;
  
  /** Tools to allow */
  allowedTools?: ToolName[];
  
  /** Tools to deny */
  deniedTools?: ToolName[];
  
  /** Default model to use */
  model?: string;
  
  /** Default temperature */
  temperature?: number;
  
  /** Default max tokens */
  maxTokens?: number;
  
  /** Default timeout */
  timeout?: number;
  
  /** Default directories to add context from */
  addDirectories?: string[];
  
  /** Default context items */
  context?: string[];
  
  /** Default permission mode */
  permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions';
  
  /** Whether to enable debug mode by default */
  debug?: boolean;
}

/**
 * Registry for managing roles
 */
export class RoleRegistry {
  private roles = new Map<string, RoleConfig>();

  /**
   * Register a new role
   */
  register(role: RoleConfig): void {
    this.roles.set(role.name, role);
  }

  /**
   * Get a role by name
   */
  get(name: string): RoleConfig | undefined {
    return this.roles.get(name);
  }

  /**
   * Check if a role exists
   */
  has(name: string): boolean {
    return this.roles.has(name);
  }

  /**
   * List all registered roles
   */
  list(): RoleConfig[] {
    return Array.from(this.roles.values());
  }

  /**
   * Remove a role
   */
  remove(name: string): boolean {
    return this.roles.delete(name);
  }

  /**
   * Clear all roles
   */
  clear(): void {
    this.roles.clear();
  }
}

/**
 * Global role registry instance
 */
export const roleRegistry = new RoleRegistry();

/**
 * Built-in roles that are available by default
 */
export const builtInRoles: RoleConfig[] = [
  {
    name: 'codeAnalyzer',
    description: 'Analyze codebases with read-only tools',
    defaultPrompt: 'Analyze this codebase',
    allowedTools: ['Read', 'Grep', 'LS', 'Glob'],
    model: 'sonnet',
    timeout: 60000
  },
  {
    name: 'codeWriter',
    description: 'Write and modify code with full tool access',
    defaultPrompt: 'Help me write code',
    allowedTools: ['Read', 'Write', 'Edit', 'MultiEdit', 'Bash', 'Grep', 'LS', 'Glob'],
    model: 'sonnet',
    permissionMode: 'acceptEdits',
    timeout: 120000
  },
  {
    name: 'debugger',
    description: 'Debug code issues with analysis and execution tools',
    defaultPrompt: 'Help me debug this issue',
    allowedTools: ['Read', 'Bash', 'Grep', 'LS', 'Glob', 'Edit'],
    model: 'sonnet',
    debug: true,
    timeout: 90000
  },
  {
    name: 'quickChat',
    description: 'Quick conversations without tools',
    defaultPrompt: 'Hello! How can I help you?',
    allowedTools: [],
    model: 'haiku',
    timeout: 30000
  },
  {
    name: 'researcher',
    description: 'Research and analysis with web search capabilities',
    defaultPrompt: 'Help me research this topic',
    allowedTools: ['Read', 'WebSearch', 'WebFetch', 'Grep', 'LS'],
    model: 'sonnet',
    timeout: 180000
  },
  {
    name: 'fileManager',
    description: 'File operations and organization',
    defaultPrompt: 'Help me manage files',
    allowedTools: ['Read', 'Write', 'LS', 'Bash'],
    model: 'haiku',
    permissionMode: 'acceptEdits',
    timeout: 60000
  }
];

/**
 * Initialize built-in roles
 */
export function initializeBuiltInRoles(): void {
  for (const role of builtInRoles) {
    roleRegistry.register(role);
  }
}

/**
 * Apply a role configuration to Claude Code options
 */
export function applyRole(roleName: string, baseOptions: Partial<ClaudeCodeOptions> = {}): Partial<ClaudeCodeOptions> {
  const role = roleRegistry.get(roleName);
  if (!role) {
    throw new Error(`Role '${roleName}' not found. Available roles: ${roleRegistry.list().map(r => r.name).join(', ')}`);
  }

  // Merge role configuration with base options
  // Base options take precedence over role defaults
  const mergedOptions: Partial<ClaudeCodeOptions> = {
    ...role.options,
    ...baseOptions
  };

  // Apply specific role properties
  if (role.model && !baseOptions.model) {
    mergedOptions.model = role.model;
  }
  
  if (role.temperature !== undefined && baseOptions.temperature === undefined) {
    mergedOptions.temperature = role.temperature;
  }
  
  if (role.maxTokens !== undefined && baseOptions.maxTokens === undefined) {
    mergedOptions.maxTokens = role.maxTokens;
  }
  
  if (role.timeout !== undefined && baseOptions.timeout === undefined) {
    mergedOptions.timeout = role.timeout;
  }
  
  if (role.permissionMode && !baseOptions.permissionMode) {
    mergedOptions.permissionMode = role.permissionMode;
  }
  
  if (role.debug !== undefined && baseOptions.debug === undefined) {
    mergedOptions.debug = role.debug;
  }

  // Merge tool arrays
  if (role.allowedTools && role.allowedTools.length > 0) {
    mergedOptions.allowedTools = [
      ...(baseOptions.allowedTools || []),
      ...role.allowedTools.filter(tool => !baseOptions.allowedTools?.includes(tool))
    ];
  }
  
  if (role.deniedTools && role.deniedTools.length > 0) {
    mergedOptions.deniedTools = [
      ...(baseOptions.deniedTools || []),
      ...role.deniedTools.filter(tool => !baseOptions.deniedTools?.includes(tool))
    ];
  }

  // Merge context arrays
  if (role.addDirectories && role.addDirectories.length > 0) {
    mergedOptions.addDirectories = [
      ...(baseOptions.addDirectories || []),
      ...role.addDirectories.filter(dir => !baseOptions.addDirectories?.includes(dir))
    ];
  }
  
  if (role.context && role.context.length > 0) {
    mergedOptions.context = [
      ...(baseOptions.context || []),
      ...role.context.filter(ctx => !baseOptions.context?.includes(ctx))
    ];
  }

  return mergedOptions;
}

/**
 * Helper to get the default prompt for a role
 */
export function getRoleDefaultPrompt(roleName: string): string | undefined {
  const role = roleRegistry.get(roleName);
  return role?.defaultPrompt;
}

// Initialize built-in roles when module loads
initializeBuiltInRoles();