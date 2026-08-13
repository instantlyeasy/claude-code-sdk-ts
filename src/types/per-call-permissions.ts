/**
 * Per-call permission interfaces for fine-grained tool control
 */

import type { ToolName } from '../types.js';

// Re-export ToolPermission type
export type ToolPermission = 'allow' | 'deny' | 'ask';

// Tool override options for a single query
export interface ToolOverrides {
  /** Tools to allow for this specific call */
  allow?: ToolName[];
  /** Tools to deny for this specific call */
  deny?: ToolName[];
  /** Specific permissions per tool */
  permissions?: Partial<Record<ToolName, ToolPermission>>;
  /** Dynamic permissions based on context */
  dynamicPermissions?: Partial<Record<ToolName, DynamicPermissionFunction>>;
}

// Permission context (alias for QueryContext for backward compatibility)
export type PermissionContext = QueryContext;

// Query context for dynamic permissions
export interface QueryContext {
  /** The prompt being executed */
  prompt: string;
  /** The model being used */
  model?: string;
  /** Timestamp of the query */
  timestamp: number;
  /** User-provided metadata */
  metadata?: Record<string, any>;
  /** Current environment */
  environment?: 'development' | 'staging' | 'production';
  /** User role (if applicable) */
  userRole?: string;
}

// Dynamic permission function type
export type DynamicPermissionFunction = (context: QueryContext) => ToolPermission | Promise<ToolPermission>;

// Permission resolution record
export interface PermissionResolution {
  /** The tool being resolved */
  tool: ToolName;
  /** The resolved permission */
  permission: ToolPermission;
  /** Source of the permission */
  source: PermissionSource;
  /** Context used for resolution */
  context: PermissionContext;
  /** Optional override that was applied */
  override?: ToolOverrides;
  /** Timestamp of resolution */
  timestamp: number;
}

// Permission source type
export type PermissionSource = 'default' | 'global' | 'role' | 'dynamic' | 'query';

// Resolved permissions after applying all layers
export interface ResolvedPermissions {
  /** Final list of allowed tools */
  allowed: ToolName[];
  /** Final list of denied tools */
  denied: ToolName[];
  /** Source of each permission decision */
  sources?: Partial<Record<ToolName, PermissionSource>>;
}

// Source details of a permission decision
export interface PermissionSourceDetails {
  /** Where the permission came from */
  level: PermissionSource;
  /** The permission value */
  permission: ToolPermission;
  /** Additional context */
  context?: string;
}

// Permission resolver configuration
export interface PermissionResolverConfig {
  /** Enable detailed permission tracking */
  trackSources?: boolean;
  /** Default permission when not specified */
  defaultPermission?: ToolPermission;
  /** Strict mode - deny by default */
  strictMode?: boolean;
}

// Permission conflict resolution strategy
export type ConflictResolution = 'deny-wins' | 'allow-wins' | 'last-wins' | 'query-wins';

// Advanced permission options
export interface AdvancedPermissionOptions {
  /** How to resolve conflicts between permission levels */
  conflictResolution?: ConflictResolution;
  /** Enable audit logging of permission decisions */
  auditLog?: boolean;
  /** Callback for permission decisions */
  onPermissionDecision?: (tool: ToolName, decision: PermissionDecision) => void;
}

// Permission decision details
export interface PermissionDecision {
  /** The tool in question */
  tool: ToolName;
  /** The final decision */
  decision: 'allow' | 'deny';
  /** Reason for the decision */
  reason: string;
  /** All sources that were considered */
  consideredSources: PermissionSourceDetails[];
  /** The winning source */
  winningSource: PermissionSourceDetails;
  /** Query context if available */
  context?: QueryContext;
}

// Tool permission manager interface
export interface ToolPermissionManager {
  /** Set global tool permissions */
  setGlobalPermissions(permissions: ToolOverrides): void;
  
  /** Set role-based permissions */
  setRolePermissions(role: string, permissions: ToolOverrides): void;
  
  /** Resolve permissions for a specific query */
  resolvePermissions(
    queryOverrides?: ToolOverrides,
    context?: QueryContext,
    dynamicFn?: DynamicPermissionFunction
  ): ResolvedPermissions;
  
  /** Check if a specific tool is allowed */
  isToolAllowed(
    tool: ToolName,
    queryOverrides?: ToolOverrides,
    context?: QueryContext
  ): boolean;
  
  /** Get permission history for auditing */
  getPermissionHistory(): PermissionDecision[];
  
  /** Clear permission history */
  clearHistory(): void;
}

// Permission middleware for intercepting tool calls
export interface PermissionMiddleware {
  /** Called before a tool is executed */
  beforeToolExecution(
    tool: ToolName,
    input: unknown,
    context: QueryContext
  ): Promise<PermissionCheckResult>;
  
  /** Called after a tool is executed */
  afterToolExecution(
    tool: ToolName,
    result: unknown,
    context: QueryContext
  ): Promise<void>;
}

// Result of a permission check
export interface PermissionCheckResult {
  /** Whether the tool is allowed */
  allowed: boolean;
  /** Reason for denial (if denied) */
  denialReason?: string;
  /** Modified input (if allowed with modifications) */
  modifiedInput?: unknown;
  /** Additional constraints to apply */
  constraints?: ToolConstraints;
}

// Constraints that can be applied to tool execution
export interface ToolConstraints {
  /** Maximum execution time in ms */
  timeout?: number;
  /** Maximum retries allowed */
  maxRetries?: number;
  /** Rate limit (calls per minute) */
  rateLimit?: number;
  /** Sandboxed execution */
  sandbox?: boolean;
  /** Read-only mode */
  readOnly?: boolean;
}

// Permission template for common scenarios
export interface PermissionTemplate {
  /** Template name */
  name: string;
  /** Description of the template */
  description: string;
  /** Tool permissions */
  permissions: ToolOverrides;
  /** Constraints to apply */
  constraints?: ToolConstraints;
  /** Conditions for applying this template */
  conditions?: TemplateCondition[];
}

// Condition for applying a permission template
export interface TemplateCondition {
  /** Field to check in the context */
  field: keyof QueryContext | string;
  /** Operator to use */
  operator: 'equals' | 'contains' | 'matches' | 'in' | 'not-in';
  /** Value to compare against */
  value: unknown;
}

// Built-in permission templates
export const PERMISSION_TEMPLATES: Record<string, PermissionTemplate> = {
  readOnly: {
    name: 'Read Only',
    description: 'Only allow read operations',
    permissions: {
      allow: ['Read', 'Grep', 'Glob', 'LS', 'NotebookRead', 'TodoRead'],
      deny: ['Write', 'Edit', 'MultiEdit', 'NotebookEdit', 'TodoWrite', 'Bash']
    }
  },
  
  safeExecution: {
    name: 'Safe Execution',
    description: 'Allow most operations except system commands',
    permissions: {
      deny: ['Bash'],
      allow: ['Read', 'Write', 'Edit', 'Grep', 'Glob', 'LS']
    },
    constraints: {
      timeout: 30000,
      maxRetries: 2
    }
  },
  
  fullAccess: {
    name: 'Full Access',
    description: 'Allow all operations',
    permissions: {
      allow: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob', 'LS', 'MultiEdit', 
              'NotebookRead', 'NotebookEdit', 'WebFetch', 'TodoRead', 'TodoWrite', 
              'WebSearch', 'Task', 'MCPTool']
    }
  },
  
  analysisOnly: {
    name: 'Analysis Only',
    description: 'Only allow analysis tools',
    permissions: {
      allow: ['Read', 'Grep', 'Glob', 'LS', 'WebFetch', 'WebSearch'],
      deny: ['Write', 'Edit', 'MultiEdit', 'Bash', 'NotebookEdit', 'TodoWrite']
    }
  }
};