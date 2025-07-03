# Role System

The Role System allows you to define preconfigured sets of fluent API methods that can be applied as a unit, making common configurations reusable and reducing boilerplate code.

## Overview

A **role** is a predefined configuration that includes:
- Default tools to allow/deny
- Default model settings
- Default prompts
- Timeout configurations
- Permission modes
- And other Claude Code options

Instead of repeating the same configuration across multiple queries, you can define it once as a role and reuse it.

## Basic Usage

```typescript
import { claude } from '@instantlyeasy/claude-code-sdk-ts';

// Using a built-in role
const result = await claude()
  .withRole('codeAnalyzer')
  .inDirectory('/my-project')
  .asText();
```

This is equivalent to:

```typescript
const result = await claude()
  .allowTools('Read', 'Grep', 'LS', 'Glob')
  .withModel('sonnet')
  .withTimeout(60000)
  .query('Analyze this codebase')
  .inDirectory('/my-project')
  .asText();
```

## Built-in Roles

The SDK comes with several built-in roles:

### `codeAnalyzer`
- **Purpose**: Analyze codebases with read-only tools
- **Tools**: Read, Grep, LS, Glob
- **Model**: sonnet
- **Default Prompt**: "Analyze this codebase"
- **Timeout**: 60 seconds

### `codeWriter`
- **Purpose**: Write and modify code with full tool access
- **Tools**: Read, Write, Edit, MultiEdit, Bash, Grep, LS, Glob
- **Model**: sonnet
- **Permission Mode**: acceptEdits
- **Default Prompt**: "Help me write code"
- **Timeout**: 120 seconds

### `debugger`
- **Purpose**: Debug code issues with analysis and execution tools
- **Tools**: Read, Bash, Grep, LS, Glob, Edit
- **Model**: sonnet
- **Debug Mode**: enabled
- **Default Prompt**: "Help me debug this issue"
- **Timeout**: 90 seconds

### `quickChat`
- **Purpose**: Quick conversations without tools
- **Tools**: None
- **Model**: haiku
- **Default Prompt**: "Hello! How can I help you?"
- **Timeout**: 30 seconds

### `researcher`
- **Purpose**: Research and analysis with web search capabilities
- **Tools**: Read, WebSearch, WebFetch, Grep, LS
- **Model**: sonnet
- **Default Prompt**: "Help me research this topic"
- **Timeout**: 180 seconds

### `fileManager`
- **Purpose**: File operations and organization
- **Tools**: Read, Write, LS, Bash
- **Model**: haiku
- **Permission Mode**: acceptEdits
- **Default Prompt**: "Help me manage files"
- **Timeout**: 60 seconds

## Custom Roles

You can create custom roles for your specific needs:

```typescript
import { claude, roleRegistry } from '@instantlyeasy/claude-code-sdk-ts';

// Define a custom role
const docWriterRole = {
  name: 'docWriter',
  description: 'Specialized role for writing documentation',
  defaultPrompt: 'Help me create clear documentation',
  allowedTools: ['Read', 'Write', 'Edit', 'Grep', 'LS'],
  model: 'sonnet',
  temperature: 0.3, // Lower temperature for consistency
  timeout: 90000,
  permissionMode: 'acceptEdits'
};

// Register the role
roleRegistry.register(docWriterRole);

// Use the custom role
const result = await claude()
  .withRole('docWriter')
  .query('Document this API endpoint')
  .asText();
```

## Default Prompts

Roles can include default prompts, allowing you to omit the prompt when calling `query()`:

```typescript
// This works because 'codeAnalyzer' has a default prompt
const result = await claude()
  .withRole('codeAnalyzer')
  .inDirectory('/my-project')
  .query() // Uses "Analyze this codebase"
  .asText();
```

## Fluent API Integration

Roles integrate seamlessly with the fluent API. You can:

1. **Apply a role first, then add more configuration**:
```typescript
const result = await claude()
  .withRole('codeWriter')
  .withTimeout(180000)    // Override timeout
  .debug(true)            // Add debug mode
  .inDirectory('/tmp')    // Set working directory
  .query('Create a web server')
  .asText();
```

2. **Define roles inline**:
```typescript
const result = await claude()
  .defineRole({
    name: 'myCustomRole',
    allowedTools: ['Read', 'Write'],
    model: 'haiku'
  }, true) // true = apply immediately
  .query('Do something')
  .asText();
```

3. **Inspect available roles**:
```typescript
const builder = claude();
const availableRoles = builder.getAvailableRoles();
console.log('Available roles:', availableRoles.map(r => r.name));
```

## Role Configuration

A role configuration supports these properties:

```typescript
interface RoleConfig {
  name: string;                    // Required: Unique role identifier
  description?: string;            // Optional: Description of the role
  defaultPrompt?: string;          // Optional: Default prompt to use
  
  // Claude Code options
  allowedTools?: string[];         // Tools to allow
  deniedTools?: string[];          // Tools to deny
  model?: string;                  // Default model
  temperature?: number;            // Temperature setting
  maxTokens?: number;              // Max tokens
  timeout?: number;                // Timeout in milliseconds
  addDirectories?: string[];       // Directories to add to context
  context?: string[];              // Context items
  permissionMode?: string;         // Permission mode
  debug?: boolean;                 // Debug mode
  
  options?: Partial<ClaudeCodeOptions>; // Any other options
}
```

## Advanced Examples

### Role Comparison
Compare how different roles handle the same task:

```typescript
const prompt = 'List files in the current directory';

// Fast response with minimal tools
const quickResult = await claude()
  .withRole('fileManager')
  .query(prompt)
  .asText();

// Thorough analysis with more tools
const detailedResult = await claude()
  .withRole('codeAnalyzer')
  .query(prompt)
  .asText();
```

### Dynamic Role Selection
Choose roles based on the task:

```typescript
function selectRole(taskType: string): string {
  switch (taskType) {
    case 'analysis': return 'codeAnalyzer';
    case 'development': return 'codeWriter';
    case 'debugging': return 'debugger';
    case 'research': return 'researcher';
    default: return 'quickChat';
  }
}

const result = await claude()
  .withRole(selectRole('analysis'))
  .query('Examine this code')
  .asText();
```

### Role Inheritance
Build roles on top of existing ones:

```typescript
import { roleRegistry, applyRole } from '@instantlyeasy/claude-code-sdk-ts';

// Get base configuration from existing role
const baseConfig = applyRole('codeAnalyzer', {});

// Create enhanced role
const enhancedRole = {
  name: 'advancedAnalyzer',
  description: 'Enhanced code analyzer with additional tools',
  ...baseConfig,
  allowedTools: [...(baseConfig.allowedTools || []), 'WebSearch', 'WebFetch'],
  timeout: 120000 // Longer timeout
};

roleRegistry.register(enhancedRole);
```

## Best Practices

1. **Use descriptive names**: Choose clear, descriptive names for your roles
2. **Include descriptions**: Always add descriptions to help others understand the role's purpose
3. **Set appropriate timeouts**: Match timeouts to the expected complexity of tasks
4. **Be specific with tools**: Only include tools that the role actually needs
5. **Use default prompts wisely**: Default prompts should be general enough to be useful in most cases
6. **Test your roles**: Verify that your custom roles work as expected
7. **Document custom roles**: Maintain documentation for any custom roles you create

## Role Registry API

The global role registry provides these methods:

```typescript
import { roleRegistry } from '@instantlyeasy/claude-code-sdk-ts';

// Register a new role
roleRegistry.register(roleConfig);

// Get a role by name
const role = roleRegistry.get('roleName');

// Check if a role exists
const exists = roleRegistry.has('roleName');

// List all roles
const allRoles = roleRegistry.list();

// Remove a role
roleRegistry.remove('roleName');

// Clear all roles (use with caution)
roleRegistry.clear();
```

## TypeScript Support

The role system is fully typed in TypeScript:

```typescript
import { RoleConfig, roleRegistry } from '@instantlyeasy/claude-code-sdk-ts';

const myRole: RoleConfig = {
  name: 'typedRole',
  allowedTools: ['Read', 'Write'], // TypeScript will validate tool names
  model: 'sonnet',
  temperature: 0.5
};

roleRegistry.register(myRole);
```

## Migration from Direct Configuration

If you're currently using direct fluent API configuration:

**Before:**
```typescript
// Repeated configuration
const result1 = await claude()
  .allowTools('Read', 'Grep', 'LS')
  .withModel('sonnet')
  .withTimeout(60000)
  .query('Analyze project A')
  .asText();

const result2 = await claude()
  .allowTools('Read', 'Grep', 'LS')
  .withModel('sonnet')
  .withTimeout(60000)
  .query('Analyze project B')
  .asText();
```

**After:**
```typescript
// Define once, use everywhere
const result1 = await claude()
  .withRole('codeAnalyzer')
  .query('Analyze project A')
  .asText();

const result2 = await claude()
  .withRole('codeAnalyzer')
  .query('Analyze project B')
  .asText();
```

This reduces code duplication and makes configurations more maintainable.