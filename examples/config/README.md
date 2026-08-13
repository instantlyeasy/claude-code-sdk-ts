# Configuration Files

This directory contains example configuration files for the Claude Code SDK in both JSON and YAML formats.

## Directory Structure

```
config/
├── json/           # JSON format configurations
│   ├── config.json
│   ├── mcpconfig.json
│   └── roles.json
└── yaml/           # YAML format configurations
    ├── config.yaml
    ├── mcpconfig.yaml
    └── roles.yaml
```

## File Descriptions

### 1. General Configuration (`config.json/yaml`)
General project and SDK settings including:
- Project metadata
- SDK timeout and retry settings
- Claude model configuration
- Logging preferences
- Development settings

### 2. MCP Server Permissions (`mcpconfig.json/yaml`)
Model Context Protocol server-level permissions:
- Global settings (model, timeout, permission mode)
- Server-specific permissions (file-system, database, git, etc.)
- Tool-level allow/deny lists
- Environment variables

### 3. Role-Based Access Control (`roles.json/yaml`)
Role definitions with specific permissions and contexts:
- Pre-defined roles (developer, dataAnalyst, securityAuditor, etc.)
- Permission modes and tool access
- Prompting templates with variable substitution
- Role inheritance (e.g., seniorDeveloper extends developer)

> **Note:** per-call model sampling params (`context.temperature` /
> `context.maxTokens`) are not supported by the Claude Code CLI and are ignored
> by the SDK (it warns once), so the sample roles omit them. Also, a role that
> `extends` another must still declare its own `model` — role validation runs
> before inheritance is resolved.

## YAML vs JSON

### Why Use YAML?

1. **Better Readability**
   ```yaml
   # Clear structure without quotes and commas
   model: opus
   timeout: 30000
   ```

2. **Comments Support**
   ```yaml
   # This server handles all file operations
   file-system-mcp:
     defaultPermission: allow  # Be careful with this!
   ```

3. **Multi-line Strings**
   ```yaml
   promptingTemplate: |
     You are a ${language} developer.
     Focus on clean, maintainable code.
     Follow best practices.
   ```

4. **Anchors & References**
   ```yaml
   defaults: &defaults
     model: sonnet
     timeout: 30000
   
   globalSettings:
     <<: *defaults
     permissionMode: ask
   ```

5. **Environment Variables**
   ```yaml
   cwd: ${HOME}/projects
   authToken: ${CLAUDE_AUTH_TOKEN}
   ```

### When to Use JSON?

- When integrating with systems that only support JSON
- When you need strict schema validation
- For programmatic generation/manipulation
- When file size is critical (JSON is slightly smaller)

## Usage Examples

### Loading Configuration Files

```javascript
import { claude } from '@instantlyeasy/claude-code-sdk-ts';

// Auto-detects format based on file extension
const builder = await claude()
  .withConfigFile('./config/yaml/mcpconfig.yaml');

// Or use JSON
const builder = await claude()
  .withConfigFile('./config/json/mcpconfig.json');

// Load multiple configurations
const builder = claude();
await builder.withConfigFile('./config/yaml/mcpconfig.yaml');
await builder.withRolesFile('./config/yaml/roles.yaml');
```

### Applying Roles

```javascript
// Apply a role with template variables
builder.withRole('developer', {
  language: 'TypeScript',
  framework: 'React'
});

// The role's prompting template will be interpolated:
// "You are a TypeScript developer with expertise in React."
```

### Environment Variable Expansion

Environment variables in configurations are automatically expanded:

```yaml
globalSettings:
  cwd: ${HOME}/projects      # Expands to /Users/username/projects
  env:
    AUTH_TOKEN: ${AUTH_TOKEN} # Expands from process.env.AUTH_TOKEN
```

## Best Practices

1. **Use YAML for Human-Edited Configs**
   - Better readability
   - Inline documentation with comments
   - Easier to maintain

2. **Use JSON for Machine-Generated Configs**
   - Programmatic generation
   - Strict parsing
   - Universal support

3. **Organize by Environment**
   ```
   config/
   ├── development/
   ├── staging/
   └── production/
   ```

4. **Version Control Considerations**
   - Commit example configs
   - Use `.gitignore` for environment-specific configs
   - Document required environment variables

5. **Security**
   - Never commit sensitive data (auth tokens, passwords)
   - Use environment variables for secrets
   - Review permission settings carefully

## Converting Between Formats

### JSON to YAML
```bash
# Using Python (if available)
python -c "import json, yaml; print(yaml.dump(json.load(open('config.json'))))" > config.yaml

# Using Node.js
node -e "console.log(require('js-yaml').dump(require('./config.json')))" > config.yaml
```

### YAML to JSON
```bash
# Using Python (if available)
python -c "import json, yaml; print(json.dumps(yaml.safe_load(open('config.yaml')), indent=2))" > config.json

# Using Node.js
node -e "console.log(JSON.stringify(require('js-yaml').load(require('fs').readFileSync('./config.yaml', 'utf8')), null, 2))" > config.json
```

## Schema Reference

For detailed schema documentation, see:
- [Configuration Types](../../src/types/config.ts)
- [Role Types](../../src/types/roles.ts)
- [Permission Types](../../src/types/permissions.ts)