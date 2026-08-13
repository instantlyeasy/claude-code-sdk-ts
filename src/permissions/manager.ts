import type { 
  MCPServerPermission, 
  MCPServerPermissionConfig,
  ToolPermission
} from '../types/permissions.js';
import type { ClaudeCodeOptions } from '../types.js';

/**
 * Manages MCP server-level permissions
 */
export class PermissionManager {
  private mcpServerPermissions: Map<string, MCPServerPermission>;

  constructor() {
    this.mcpServerPermissions = new Map();
  }

  /**
   * Set permission for an MCP server
   */
  setMCPServerPermission(serverName: string, permission: MCPServerPermission): void {
    if (!serverName) {
      throw new Error('Server name cannot be empty');
    }

    if (!['whitelist', 'blacklist', 'ask'].includes(permission)) {
      throw new Error(`Invalid permission value: ${permission}`);
    }

    this.mcpServerPermissions.set(serverName, permission);
  }

  /**
   * Get permission for an MCP server
   */
  getMCPServerPermission(serverName: string): MCPServerPermission | undefined {
    return this.mcpServerPermissions.get(serverName);
  }

  /**
   * Set multiple MCP server permissions at once
   */
  setMCPServerPermissions(permissions: MCPServerPermissionConfig): void {
    Object.entries(permissions).forEach(([serverName, permission]) => {
      this.setMCPServerPermission(serverName, permission);
    });
  }

  /**
   * Clear all MCP server permissions
   */
  clearMCPServerPermissions(): void {
    this.mcpServerPermissions.clear();
  }

  /**
   * Export current configuration
   */
  exportConfig(): MCPServerPermissionConfig {
    const config: MCPServerPermissionConfig = {};
    this.mcpServerPermissions.forEach((permission, serverName) => {
      config[serverName] = permission;
    });
    return config;
  }

  /**
   * Resolve tool permission based on MCP server permission
   * Maps MCP server permissions to tool-level permissions
   */
  // Note: resolution is currently server-level; the specific tool name is not
  // yet consulted (kept in the signature for forward compatibility).
  resolveToolPermission(_toolName: string, serverName: string): ToolPermission | undefined {
    const serverPermission = this.getMCPServerPermission(serverName);
    
    if (!serverPermission) {
      return undefined;
    }

    // Map MCP server permissions to tool permissions
    const permissionMap: Record<MCPServerPermission, ToolPermission> = {
      'whitelist': 'allow',
      'blacklist': 'deny',
      'ask': 'ask'
    };

    return permissionMap[serverPermission];
  }

  /**
   * Apply permissions to ClaudeCodeOptions
   */
  applyToOptions(options: ClaudeCodeOptions, merge: boolean = true): ClaudeCodeOptions {
    const exportedConfig = this.exportConfig();
    
    if (Object.keys(exportedConfig).length === 0) {
      return options;
    }

    if (merge && options.mcpServerPermissions) {
      return {
        ...options,
        mcpServerPermissions: {
          ...options.mcpServerPermissions,
          ...exportedConfig
        }
      };
    }

    return {
      ...options,
      mcpServerPermissions: exportedConfig
    };
  }

  /**
   * Serialize to JSON string
   */
  toJSON(): string {
    return JSON.stringify(this.exportConfig());
  }

  /**
   * Deserialize from JSON string
   */
  fromJSON(json: string): void {
    try {
      const config = JSON.parse(json) as MCPServerPermissionConfig;
      this.clearMCPServerPermissions();
      this.setMCPServerPermissions(config);
    } catch (error) {
      throw new Error('Invalid JSON');
    }
  }

  /**
   * Clone the permission manager
   */
  clone(): PermissionManager {
    const cloned = new PermissionManager();
    cloned.setMCPServerPermissions(this.exportConfig());
    return cloned;
  }

  /**
   * Check if a server has any permission set
   */
  hasPermission(serverName: string): boolean {
    return this.mcpServerPermissions.has(serverName);
  }

  /**
   * Get all server names with permissions
   */
  getServerNames(): string[] {
    return Array.from(this.mcpServerPermissions.keys());
  }

  /**
   * Get count of permissions
   */
  get size(): number {
    return this.mcpServerPermissions.size;
  }

  /**
   * Check if empty
   */
  get isEmpty(): boolean {
    return this.mcpServerPermissions.size === 0;
  }
}