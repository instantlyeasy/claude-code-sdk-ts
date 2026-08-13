/**
 * Configuration file types for mcpconfig.json/yaml support
 */

import type { PermissionMode, ToolName } from '../types.js';
import type { ToolPermission } from './permissions.js';

// Re-export ToolPermission for use in config
export type { ToolPermission };

/**
 * Schema version for configuration files
 */
export type ConfigVersion = '1.0';

/**
 * Supported configuration file formats
 */
export type ConfigFormat = 'json' | 'yaml';

/**
 * MCP server configuration in config file
 */
export interface MCPServerConfig {
  /** Default permission for all tools from this server */
  defaultPermission: ToolPermission;
  /** Optional tool-specific permissions */
  tools?: {
    [toolName: string]: ToolPermission;
  };
}

/**
 * Global settings in configuration file
 */
export interface GlobalConfigSettings {
  /** Default permission for all tools */
  defaultToolPermission?: ToolPermission;
  /** Permission mode (default, acceptEdits, bypassPermissions) */
  permissionMode?: PermissionMode;
  /** Default model to use */
  model?: string;
  /** Default timeout in milliseconds */
  timeout?: number;
  /** Working directory */
  cwd?: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** Temperature for model responses */
  temperature?: number;
  /** Maximum tokens for model responses */
  maxTokens?: number;
}

/**
 * Main configuration file schema for mcpconfig.json
 */
export interface MCPConfigSchema {
  /** Configuration schema version */
  version: ConfigVersion;
  /** MCP server configurations */
  mcpServers?: {
    [serverName: string]: MCPServerConfig;
  };
  /** Global settings */
  globalSettings?: GlobalConfigSettings;
  /** Tool-level permissions (independent of MCP servers) */
  tools?: {
    allowed?: ToolName[];
    denied?: ToolName[];
  };
}

/**
 * Configuration loading options
 */
export interface ConfigLoadOptions {
  /** Whether to validate the configuration against schema */
  validate?: boolean;
  /** Whether to merge with existing configuration */
  merge?: boolean;
  /** Custom schema for validation */
  schema?: unknown;
  /** Override format detection */
  format?: ConfigFormat;
}