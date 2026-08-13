import { claude } from '@instantlyeasy/claude-code-sdk-ts';

/**
 * Configuration and role features in the Claude Code SDK.
 *
 * 1. Configuration objects (model, permission mode, tool allow/deny lists)
 * 2. Roles / personas (model + tools + system prompt + prompt template)
 * 3. Role inheritance (structure only)
 * 4. Error handling for an unknown role
 *
 * Removed / ignored in v0.4.0 — deliberately NOT demonstrated here:
 *   - MCP server-level permissions: .withMCPServerPermission() /
 *     .withMCPServerPermissions() are deprecated and ignored (they warn once
 *     and do nothing). The underlying `mcpServerPermissions` option is a no-op.
 *   - Model sampling context on roles/config: `temperature`, `maxTokens` and
 *     role `context.additionalContext` are deprecated and ignored — the claude
 *     CLI does not accept them, so they no longer affect a query.
 *
 * Run `npm install && npm run build` from the repo root before running examples,
 * and authenticate the CLI (`claude login`) so the queries can execute.
 */

// Example 1: Configuration objects
async function configExample() {
  console.log('=== Configuration Example ===\n');

  // `globalSettings` and `tools` map to real CLI options: model,
  // permissionMode, allowedTools and deniedTools.
  const config = {
    version: '1.0',
    globalSettings: {
      model: 'sonnet',
      permissionMode: 'default'
    },
    tools: {
      allowed: ['Read', 'Grep', 'LS'],
      denied: ['Bash', 'Write']
    }
  };

  const response = await claude()
    .withConfig(config)
    .query('Summarize the project structure using read-only tools')
    .asText();

  console.log('With inline config:', response);

  // The same shape can be loaded from a file. Note withConfigFile() is async
  // (it returns a Promise), so await it before calling .query():
  //
  //   const builder = await claude().withConfigFile('./config/json/mcpconfig.json');
  //   const out = await builder.query('Analyze the project structure').asText();
}

// Example 2: Roles / personas
async function rolesExample() {
  console.log('\n=== Roles / Personas Example ===\n');

  // A role bundles model + tool permissions + system prompt + prompt template.
  // Template variables (${domain}, ${specialty}) are substituted into the
  // prompting template and prepended to your query.
  const dataAnalystRole = {
    name: 'dataAnalyst',
    description: 'Expert data analyst focused on insights and patterns',
    model: 'sonnet',
    permissions: {
      mode: 'default',
      tools: {
        allowed: ['Read', 'Grep'],
        denied: ['Write', 'Edit', 'Bash']
      }
    },
    promptingTemplate: 'You are a ${domain} data analyst specializing in ${specialty}.',
    systemPrompt: 'Always provide data-driven insights and cite the evidence.'
  };

  const response = await claude()
    .withRole(dataAnalystRole, {
      domain: 'financial',
      specialty: 'risk assessment'
    })
    .query('Analyze the quarterly revenue trends')
    .asText();

  console.log('Data Analyst response:', response);
}

// Example 3: Role inheritance (structure only)
async function roleInheritanceExample() {
  console.log('\n=== Role Inheritance (structure) ===\n');

  // Roles can extend a parent role. Child fields override the parent's;
  // tool lists are replaced (not merged) unless you opt into array merging.
  const rolesConfig = {
    version: '1.0',
    roles: {
      baseAnalyst: {
        name: 'baseAnalyst',
        model: 'sonnet',
        permissions: {
          mode: 'default',
          tools: { allowed: ['Read', 'Grep'] }
        }
      },
      seniorAnalyst: {
        name: 'seniorAnalyst',
        extends: 'baseAnalyst',
        model: 'opus', // Override the parent's model
        permissions: {
          tools: { allowed: ['Read', 'Grep', 'Write'], denied: ['Bash'] }
        },
        promptingTemplate: 'You are a senior analyst with expertise in ${domain}.'
      }
    },
    defaultRole: 'baseAnalyst'
  };

  // In real usage, load these from a file (withRolesFile is async):
  //   const builder = await claude().withRolesFile('./config/json/roles.json');
  //   await builder.withRole('seniorAnalyst', { domain: 'security' }).query('...');
  console.log('Role inheritance structure:', JSON.stringify(rolesConfig, null, 2));
}

// Example 4: Error handling
async function errorHandlingExample() {
  console.log('\n=== Error Handling Example ===\n');

  try {
    // Applying a role that was never defined throws immediately (synchronously),
    // before any query is sent.
    claude().withRole('nonExistentRole');
  } catch (error) {
    console.log('Caught expected error:', error.message);
  }
}

// Run all examples
async function main() {
  try {
    await configExample();
    await rolesExample();
    await roleInheritanceExample();
    await errorHandlingExample();
  } catch (error) {
    console.error('Demo error:', error);
  }
}

main();
