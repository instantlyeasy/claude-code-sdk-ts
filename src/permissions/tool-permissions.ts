/**
 * Per-call tool permission implementation
 */

import type {
  ToolOverrides,
  ToolPermission,
  PermissionContext,
  DynamicPermissionFunction,
  PermissionResolution,
} from '../types/per-call-permissions.js';
import type { ToolName, ClaudeCodeOptions } from '../types.js';

export class ToolPermissionManager {
  private globalPermissions: Map<ToolName, ToolPermission>;
  private rolePermissions: Map<ToolName, ToolPermission>;
  private resolutionLog: PermissionResolution[] = [];
  
  constructor(
    options: ClaudeCodeOptions,
    rolePermissions?: Partial<Record<ToolName, ToolPermission>>
  ) {
    // Initialize global permissions from options
    this.globalPermissions = this.initializeGlobalPermissions(options);
    
    // Initialize role permissions if provided
    this.rolePermissions = new Map(
      rolePermissions ? Object.entries(rolePermissions) as [ToolName, ToolPermission][] : []
    );
  }
  
  private initializeGlobalPermissions(options: ClaudeCodeOptions): Map<ToolName, ToolPermission> {
    const permissions = new Map<ToolName, ToolPermission>();
    
    // Set allowed tools
    if (options.allowedTools) {
      for (const tool of options.allowedTools) {
        permissions.set(tool, 'allow');
      }
    }
    
    // Set denied tools (overrides allowed)
    if (options.deniedTools) {
      for (const tool of options.deniedTools) {
        permissions.set(tool, 'deny');
      }
    }
    
    // Legacy tools array support
    if (options.tools) {
      for (const tool of options.tools) {
        if (!permissions.has(tool)) {
          permissions.set(tool, 'allow');
        }
      }
    }
    
    return permissions;
  }
  
  /**
   * Resolve permissions for a specific tool with optional overrides
   */
  async resolvePermission(
    tool: ToolName,
    context: PermissionContext,
    overrides?: ToolOverrides
  ): Promise<PermissionResolution> {
    const resolution: PermissionResolution = {
      tool,
      permission: 'allow', // Default to allow
      source: 'default',
      context,
      timestamp: Date.now()
    };
    
    // 1. Check query-level overrides (highest priority)
    if (overrides) {
      const overridePermission = await this.checkOverrides(tool, context, overrides);
      if (overridePermission !== undefined) {
        resolution.permission = overridePermission;
        resolution.source = 'query';
        resolution.override = overrides;
        this.resolutionLog.push(resolution);
        return resolution;
      }
    }
    
    // 2. Check dynamic permissions
    if (overrides?.dynamicPermissions) {
      const dynamicPermission = await this.checkDynamicPermissions(
        tool,
        context,
        overrides.dynamicPermissions
      );
      if (dynamicPermission !== undefined) {
        resolution.permission = dynamicPermission;
        resolution.source = 'dynamic';
        resolution.override = overrides;
        this.resolutionLog.push(resolution);
        return resolution;
      }
    }
    
    // 3. Check role permissions
    if (this.rolePermissions.has(tool)) {
      resolution.permission = this.rolePermissions.get(tool)!;
      resolution.source = 'role';
      this.resolutionLog.push(resolution);
      return resolution;
    }
    
    // 4. Check global permissions
    if (this.globalPermissions.has(tool)) {
      resolution.permission = this.globalPermissions.get(tool)!;
      resolution.source = 'global';
      this.resolutionLog.push(resolution);
      return resolution;
    }
    
    // 5. Default permission
    this.resolutionLog.push(resolution);
    return resolution;
  }
  
  /**
   * Check query-level overrides
   */
  private async checkOverrides(
    tool: ToolName,
    _context: PermissionContext,
    overrides: ToolOverrides
  ): Promise<ToolPermission | undefined> {
    // Check explicit deny list (highest priority)
    if (overrides.deny?.includes(tool)) {
      return 'deny';
    }
    
    // Check explicit allow list
    if (overrides.allow?.includes(tool)) {
      return 'allow';
    }
    
    // Check permission map
    if (overrides.permissions?.[tool]) {
      return overrides.permissions[tool];
    }
    
    return undefined;
  }
  
  /**
   * Check dynamic permissions
   */
  private async checkDynamicPermissions(
    tool: ToolName,
    context: PermissionContext,
    dynamicPermissions: Partial<Record<ToolName, DynamicPermissionFunction>>
  ): Promise<ToolPermission | undefined> {
    const dynamicFn = dynamicPermissions[tool];
    if (dynamicFn) {
      try {
        return await dynamicFn(context);
      } catch (error) {
        // Log error and fall through to next permission level
        // Error in dynamic permission function for ${tool} - falling through to next permission level
      }
    }
    
    return undefined;
  }
  
  /**
   * Get permission resolution history
   */
  getResolutionHistory(): PermissionResolution[] {
    return [...this.resolutionLog];
  }
  
  /**
   * Clear resolution history
   */
  clearHistory(): void {
    this.resolutionLog = [];
  }
  
  /**
   * Update role permissions
   */
  updateRolePermissions(permissions: Partial<Record<ToolName, ToolPermission>>): void {
    this.rolePermissions = new Map(Object.entries(permissions) as [ToolName, ToolPermission][]);
  }
  
  /**
   * Check if a tool is allowed with current configuration
   */
  async isToolAllowed(
    tool: ToolName,
    context: PermissionContext,
    overrides?: ToolOverrides
  ): Promise<boolean> {
    const resolution = await this.resolvePermission(tool, context, overrides);
    return resolution.permission === 'allow';
  }
  
  /**
   * Get effective permissions for a context
   */
  async getEffectivePermissions(
    context: PermissionContext,
    overrides?: ToolOverrides
  ): Promise<Map<ToolName, PermissionResolution>> {
    const allTools: ToolName[] = [
      'Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob', 'LS',
      'MultiEdit', 'NotebookRead', 'NotebookEdit', 'WebFetch',
      'TodoRead', 'TodoWrite', 'WebSearch', 'Task', 'MCPTool'
    ];
    
    const effectivePermissions = new Map<ToolName, PermissionResolution>();
    
    for (const tool of allTools) {
      const resolution = await this.resolvePermission(tool, context, overrides);
      effectivePermissions.set(tool, resolution);
    }
    
    return effectivePermissions;
  }
}

// Export factory function
export function createPermissionManager(
  options: ClaudeCodeOptions,
  rolePermissions?: Partial<Record<ToolName, ToolPermission>>
): ToolPermissionManager {
  return new ToolPermissionManager(options, rolePermissions);
}