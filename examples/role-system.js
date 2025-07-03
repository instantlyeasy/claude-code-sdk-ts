/**
 * Example: Role System with Claude Code SDK
 * 
 * This example demonstrates how to use roles to preconfigure
 * sets of fluent API methods for common use cases.
 */

import { claude, roleRegistry } from '../dist/index.cjs';

// Example 1: Using built-in roles
async function exampleBuiltInRoles() {
  console.log('📋 Built-in Roles Example\n');
  
  try {
    // Using the codeAnalyzer role - includes Read, Grep, LS, Glob tools
    // and sets model to 'sonnet' with 60s timeout
    const analysis = await claude()
      .withRole('codeAnalyzer')
      .inDirectory('/Users/d/Projects/claude-code-sdk-ts/claude-code-sdk-ts')
      .query('What is the main purpose of this codebase?')
      .asText();
    
    console.log('Code Analysis Result:', analysis.slice(0, 200) + '...\n');
    
    // Using the quickChat role - no tools, haiku model, fast responses
    const quickResponse = await claude()
      .withRole('quickChat')
      .query('What is TypeScript?')
      .asText();
    
    console.log('Quick Chat Result:', quickResponse.slice(0, 200) + '...\n');
    
  } catch (error) {
    console.error('Error with built-in roles:', error.message);
  }
}

// Example 2: Creating custom roles
async function exampleCustomRoles() {
  console.log('🛠️ Custom Roles Example\n');
  
  try {
    // Define a custom role for documentation work
    const docWriterRole = {
      name: 'docWriter',
      description: 'Specialized role for writing and editing documentation',
      defaultPrompt: 'Help me create clear and comprehensive documentation',
      allowedTools: ['Read', 'Write', 'Edit', 'Grep', 'LS'],
      model: 'sonnet',
      temperature: 0.3, // Lower temperature for more consistent documentation
      timeout: 90000,
      permissionMode: 'acceptEdits'
    };
    
    // Register the custom role
    roleRegistry.register(docWriterRole);
    
    // Use the custom role
    const docResult = await claude()
      .withRole('docWriter')
      .query('Create a simple README for a JavaScript utility library')
      .asText();
    
    console.log('Documentation Result:', docResult.slice(0, 300) + '...\n');
    
  } catch (error) {
    console.error('Error with custom roles:', error.message);
  }
}

// Example 3: Using roles with default prompts
async function exampleDefaultPrompts() {
  console.log('💬 Default Prompts Example\n');
  
  try {
    // When using a role with a default prompt, you can omit the prompt
    // This will use the debugger role's default prompt: "Help me debug this issue"
    const debugResult = await claude()
      .withRole('debugger')
      .inDirectory('/Users/d/Projects/claude-code-sdk-ts/claude-code-sdk-ts')
      .addDirectory('src')
      .query() // No prompt needed - uses role's default
      .asText();
    
    console.log('Debug Result (using default prompt):', debugResult.slice(0, 200) + '...\n');
    
  } catch (error) {
    console.error('Error with default prompts:', error.message);
  }
}

// Example 4: Role comparison - same task, different configurations
async function exampleRoleComparison() {
  console.log('⚖️ Role Comparison Example\n');
  
  const prompt = 'List the files in the current directory';
  
  try {
    // Quick response with haiku model (fileManager role)
    console.time('fileManager role');
    const fileManagerResult = await claude()
      .withRole('fileManager')
      .query(prompt)
      .asText();
    console.timeEnd('fileManager role');
    console.log('File Manager Result:', fileManagerResult.slice(0, 150) + '...\n');
    
    // More thorough analysis with sonnet model (codeAnalyzer role)
    console.time('codeAnalyzer role');
    const analyzerResult = await claude()
      .withRole('codeAnalyzer')
      .query(prompt)
      .asText();
    console.timeEnd('codeAnalyzer role');
    console.log('Code Analyzer Result:', analyzerResult.slice(0, 150) + '...\n');
    
  } catch (error) {
    console.error('Error in role comparison:', error.message);
  }
}

// Example 5: Combining roles with additional configuration
async function exampleRoleCombination() {
  console.log('🔧 Role + Additional Config Example\n');
  
  try {
    // Start with codeWriter role and add custom configuration
    const result = await claude()
      .withRole('codeWriter') // Sets up tools, model, permissions
      .withTimeout(180000)    // Override the timeout
      .debug(true)            // Add debug mode
      .inDirectory('/tmp')    // Change working directory
      .query('Create a simple Node.js HTTP server')
      .asText();
    
    console.log('Combined Configuration Result:', result.slice(0, 200) + '...\n');
    
  } catch (error) {
    console.error('Error with role combination:', error.message);
  }
}

// Example 6: Listing and inspecting available roles
function exampleRoleInspection() {
  console.log('🔍 Role Inspection Example\n');
  
  // List all available roles
  const availableRoles = roleRegistry.list();
  console.log('Available Roles:');
  
  for (const role of availableRoles) {
    console.log(`\n📝 ${role.name}`);
    console.log(`   Description: ${role.description || 'No description'}`);
    console.log(`   Default Prompt: ${role.defaultPrompt || 'None'}`);
    console.log(`   Tools: ${role.allowedTools?.join(', ') || 'None specified'}`);
    console.log(`   Model: ${role.model || 'Default'}`);
    console.log(`   Timeout: ${role.timeout || 'Default'}ms`);
  }
  
  console.log('\n');
}

// Example demonstrating the exact use case from your description
async function exampleYourUseCase() {
  console.log('🎯 Your Use Case Example\n');
  
  try {
    // This is equivalent to:
    // await claude()
    //   .allowTools('Read', 'Grep', 'LS') 
    //   .query('Analyze this codebase')
    //   .inDirectory('/frontend')
    //   .asText()
    
    const result = await claude()
      .withRole('codeAnalyzer')
      .inDirectory('/frontend')
      .asText();
    
    console.log('Your use case result:', result?.slice(0, 200) + '...\n');
    
  } catch (error) {
    console.error('Error in your use case:', error.message);
  }
}

// Run all examples
async function runAllExamples() {
  console.log('Claude Code SDK Role System Examples');
  console.log('=====================================\n');
  
  // Show available roles first
  exampleRoleInspection();
  
  // Run examples
  await exampleBuiltInRoles();
  await exampleCustomRoles();
  await exampleDefaultPrompts();
  await exampleRoleComparison();
  await exampleRoleCombination();
  await exampleYourUseCase();
  
  console.log('✨ All role examples completed!\n');
  console.log('Key Benefits of the Role System:');
  console.log('- Reusable configurations for common tasks');
  console.log('- Default prompts reduce boilerplate');
  console.log('- Consistent tool and model selection');
  console.log('- Easy customization and extension');
  console.log('- Improved developer experience');
}

// Execute if this file is run directly
if (import.meta.url === new URL(process.argv[1], 'file://').href) {
  await runAllExamples();
}