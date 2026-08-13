# New Features Documentation

This document describes three powerful new features added to the Claude Code SDK TypeScript library:

1. **MCP Server-Level Permission Management**
2. **Configuration File Support**
3. **Roles/Personas System**

## Table of Contents
- [MCP Server-Level Permissions](#mcp-server-level-permissions)
- [Configuration File Support](#configuration-file-support)
- [Roles/Personas System](#rolespersonas-system)
- [Integration Examples](#integration-examples)
- [API Reference](#api-reference)

## MCP Server-Level Permissions

> **Deprecated and ignored as of v0.4.0.** MCP server-level permissions are built on the `mcpServerPermissions` option, which the installed `claude` CLI does not accept as a flag. The SDK now warns once and **ignores** it — `.withMCPServerPermission()`, `.withMCPServerPermissions()`, and the `mcpServers` blocks inside config files and roles have **no effect on the actual run**. This section is kept for reference only and the feature is slated for removal. To control tool access, use `.allowTools(...)` / `.denyTools(...)` (fluent) or the config `tools.allowed` / `tools.denied` lists instead.

Control permissions at the MCP server level, managing all tools from a specific MCP server as a group.

### Basic Usage

```typescript
import { claude } from '@instantlyeasy/claude-code-sdk-ts';

// Set individual MCP server permissions
const response = await claude()
  .withMCPServerPermission('file-system-mcp', 'whitelist')
  .withMCPServerPermission('database-mcp', 'ask')
  .withMCPServerPermission('external-api-mcp', 'blacklist')
  .query('Analyze the codebase')
  .asText();
```

### Bulk Permissions

```typescript
// Set multiple permissions at once
const response = await claude()
  .withMCPServerPermissions({
    'file-system-mcp': 'whitelist',
    'git-mcp': 'whitelist',
    'database-mcp': 'blacklist',
    'external-api-mcp': 'ask'
  })
  .query('Show git status')
  .asText();
```

### Permission States

- `whitelist` - All tools from this MCP server are automatically allowed
- `blacklist` - All tools from this MCP server are automatically denied
- `ask` - Prompt user for each tool usage from this MCP server

## Configuration File Support

Load permissions and settings from external JSON configuration files.

### Configuration Schema

Create an `mcpconfig.json` file:

```json
{
  "version": "1.0",
  "globalSettings": {
    "model": "opus",
    "timeout": 60000,
    "permissionMode": "acceptEdits",
    "cwd": "${HOME}/projects",
    "env": {
      "NODE_ENV": "development"
    }
  },
  "mcpServers": {
    "file-system-mcp": {
      "defaultPermission": "allow",
      "tools": {
        "Read": "allow",
        "Write": "deny",
        "Edit": "ask"
      }
    },
    "database-mcp": {
      "defaultPermission": "deny",
      "tools": {
        "Query": "ask"
      }
    }
  },
  "tools": {
    "allowed": ["Read", "Grep", "LS"],
    "denied": ["Bash", "WebSearch"]
  }
}
```

### Loading Configuration

```typescript
// Load from file — withConfigFile is ASYNC (returns Promise<this>),
// so await it on its own line before continuing the chain.
const builder = await claude().withConfigFile('./mcpconfig.json');
const response = await builder
  .query('Analyze project')
  .asText();

// Or use inline configuration — withConfig is synchronous.
const inlineResponse = await claude()
  .withConfig({
    version: '1.0',
    globalSettings: {
      model: 'sonnet',
      timeout: 30000
    }
  })
  .query('Hello')
  .asText();
```

### Environment Variables

Configuration files support environment variable expansion. `${VAR}` placeholders in string values are expanded from `process.env` at load time (this works as of v0.4.0):

```json
{
  "globalSettings": {
    "cwd": "${HOME}/projects",
    "env": {
      "AUTH_TOKEN": "${MY_SECRET_TOKEN}"
    }
  }
}
```

> **Note:** Expansion is strict — if a referenced variable is not set in the environment, `withConfigFile()` / `withConfig()` throws `Environment variable <NAME> not found`. Make sure every `${VAR}` you reference is defined before loading the config.

## Roles/Personas System

Define comprehensive roles with permissions, models, and prompting templates.

### Role Definition

```typescript
const dataAnalystRole = {
  name: 'dataAnalyst',
  description: 'Expert data analyst',
  model: 'opus',
  permissions: {
    mode: 'acceptEdits',       // honored -> --permission-mode
    mcpServers: {              // IGNORED (see MCP-server-permissions note above)
      'database-mcp': 'whitelist'
    },
    tools: {
      allowed: ['Read', 'Query', 'Analyze'],  // honored -> --allowedTools
      denied: ['Write', 'Delete']             // honored -> --disallowedTools
    }
  },
  promptingTemplate: 'You are a ${domain} analyst specializing in ${specialty}.',
  systemPrompt: 'Provide data-driven insights.', // honored -> --append-system-prompt
  context: {
    // IGNORED in v0.4.0: maxTokens and temperature are not supported by the
    // claude CLI. They are accepted for forward-compat but have no effect.
    maxTokens: 4000,
    temperature: 0.2
  }
};

// Use with template variables
const response = await claude()
  .withRole(dataAnalystRole, {
    domain: 'financial',
    specialty: 'risk assessment'
  })
  .query('Analyze quarterly revenue')
  .asText();
```

### Loading Roles from File

Create a `roles.json` file:

```json
{
  "version": "1.0",
  "defaultRole": "developer",
  "roles": {
    "developer": {
      "model": "sonnet",
      "permissions": {
        "mode": "default",
        "tools": {
          "allowed": ["Read", "Write", "Edit"],
          "denied": ["Delete"]
        }
      }
    },
    "seniorDeveloper": {
      "extends": "developer",
      "model": "opus",
      "permissions": {
        "mode": "acceptEdits",
        "tools": {
          "allowed": ["TodoRead", "TodoWrite"]
        }
      }
    }
  }
}
```

Load and use roles:

```typescript
// withRolesFile is ASYNC (returns Promise<this>) — await it on its own line,
// then apply a loaded role synchronously.
const builder = await claude().withRolesFile('./roles.json');
const response = await builder
  .withRole('seniorDeveloper')
  .query('Review this code')
  .asText();
```

### Role Inheritance

Roles support single inheritance through the `extends` field:

```json
{
  "roles": {
    "baseAnalyst": {
      "model": "sonnet",
      "permissions": {
        "tools": {
          "allowed": ["Read", "Grep"]
        }
      }
    },
    "seniorAnalyst": {
      "extends": "baseAnalyst",
      "model": "opus",
      "permissions": {
        "tools": {
          "allowed": ["Write", "Query"]
        }
      }
    }
  }
}
```

Child roles inherit and can override parent properties. Tool permissions are merged.

## Integration Examples

### Combining All Features

```typescript
// withConfigFile and withRolesFile are BOTH async — await each on its own line
// before chaining the synchronous methods.
let builder = await claude().withConfigFile('./mcpconfig.json'); // Load configuration
builder = await builder.withRolesFile('./roles.json');          // Load roles

const response = await builder
  .withRole('securityAuditor')   // Apply a role (synchronous)
  .debug(true)                   // Additional settings
  .onToolUse(tool => console.log(`Using: ${tool.name}`))
  .query('Audit authentication system')
  .asText();
```

> Note: `.withMCPServerPermission()` / `.withMCPServerPermissions()` are omitted here
> because they are ignored in v0.4.0 (see the deprecation note under
> [MCP Server-Level Permissions](#mcp-server-level-permissions)).

### How settings combine (actual behavior)

The builder is **mutable and order-sensitive**: each method applies its effect to the accumulated options *immediately when you call it*, so **the last call to touch a given setting wins**. There is no separate precedence pass that re-ranks "sources" at query time.

Two consequences are worth knowing:

- **`withConfig` / `withConfigFile` override values already set.** When a config is applied, its `globalSettings` (`model`, `timeout`, `cwd`, `permissionMode`, `env`, ...) overwrite anything you set programmatically *before* the config call. Config `tools.allowed` / `tools.denied` are merged with — actually prepended to — any tools already configured.
- **`withRole` also overrides values already set** at the point where you call it.

Because it is call-order based, put the programmatic overrides you want to win *after* the `withConfig` / `withRole` calls:

```typescript
const builder = await claude().withConfigFile('./mcpconfig.json'); // config sets model: 'opus'
const response = await builder
  .withModel('sonnet') // applied AFTER config, so THIS wins
  .query('...')
  .asText();
```

Any setting that no call touches falls back to the CLI's own default.

### Security Best Practices

```typescript
// Create a restricted role for untrusted operations.
// The actual enforcement here comes from tools.allowed / tools.denied — the
// mcpServers block and context.maxTokens are IGNORED in v0.4.0, so do NOT
// rely on them for security.
const restrictedRole = {
  name: 'restricted',
  model: 'haiku',
  permissions: {
    mode: 'default',
    mcpServers: {                 // IGNORED — no effect on the run
      'file-system-mcp': 'blacklist',
      'database-mcp': 'blacklist',
      'external-api-mcp': 'blacklist'
    },
    tools: {
      allowed: ['Read'],                                    // enforced
      denied: ['Write', 'Edit', 'Delete', 'Bash', 'WebFetch'] // enforced
    }
  },
  context: {
    maxTokens: 1000               // IGNORED — no effect on the run
  }
};
```

## API Reference

### QueryBuilder Methods

#### MCP Server Permissions (deprecated / ignored in v0.4.0)

These methods still exist and chain, but the resulting `mcpServerPermissions` option is not passed to the CLI — it is warned about once and ignored. Do not depend on them.

```typescript
// Set single permission (IGNORED at query time)
.withMCPServerPermission(serverName: string, permission: MCPServerPermission): this

// Set multiple permissions (IGNORED at query time)
.withMCPServerPermissions(permissions: MCPServerPermissionConfig): this
```

#### Configuration

```typescript
// Load from file (async)
.withConfigFile(filePath: string): Promise<this>

// Apply configuration object
.withConfig(config: MCPConfigSchema): this
```

#### Roles

```typescript
// Load roles from file (async)
.withRolesFile(filePath: string): Promise<this>

// Apply role by name
.withRole(roleName: string): this

// Apply role definition with template variables
.withRole(role: RoleDefinition, templateVariables?: Record<string, string>): this
```

### Type Definitions

```typescript
// MCP Server Permission
type MCPServerPermission = 'whitelist' | 'blacklist' | 'ask';

// Tool Permission
type ToolPermission = 'allow' | 'deny' | 'ask';

// Configuration Schema
interface MCPConfigSchema {
  version: '1.0';
  globalSettings?: GlobalConfigSettings;
  mcpServers?: Record<string, MCPServerConfig>;
  tools?: {
    allowed?: ToolName[];
    denied?: ToolName[];
  };
}

// Role Definition
interface RoleDefinition {
  name: string;
  model: string;
  permissions: {
    mode?: PermissionMode;
    mcpServers?: MCPServerPermissionConfig;
    tools?: {
      allowed?: ToolName[];
      denied?: ToolName[];
    };
  };
  promptingTemplate?: string;
  systemPrompt?: string;
  // NOTE: `context` (maxTokens / temperature) is accepted but IGNORED in v0.4.0 —
  // these are not supported by the claude CLI and have no effect on the run.
  context?: {
    maxTokens?: number;
    temperature?: number;
    additionalContext?: string[];
  };
  extends?: string;
}
```

## Error Handling

The new features include comprehensive error handling:

```typescript
try {
  // withConfigFile is async and rejects on a bad/missing file, so await it
  // directly — the error surfaces here, not from .query().
  const builder = await claude().withConfigFile('./invalid.json');
  await builder.query('test').asText();
} catch (error) {
  // Handle configuration errors
  console.error('Config error:', error.message);
}

try {
  // withRole throws synchronously if the named role was never loaded, so load
  // the roles file first, then apply the role.
  const builder = await claude().withRolesFile('./roles.json');
  await builder.withRole('nonExistentRole').query('test').asText();
} catch (error) {
  // Handle role errors
  console.error('Role error:', error.message);
}
```

## Migration Guide

These features are fully backward compatible. Existing code continues to work without changes:

```typescript
// Original API still works
const response = await query('Hello', { model: 'sonnet' });

// New features are additive. Note: withRole('developer') requires the role to
// have been loaded first (e.g. via the async withRolesFile), otherwise it throws
// "Role 'developer' not found".
const builder = await claude().withRolesFile('./roles.json');
const response = await builder
  .withModel('sonnet')  // Existing method
  .withRole('developer') // New feature
  .query('Hello')
  .asText();
```