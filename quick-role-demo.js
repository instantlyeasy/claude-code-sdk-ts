#!/usr/bin/env node

/**
 * Quick Role System Demo
 * 
 * Run with: node quick-role-demo.js
 */

import { claude, roleRegistry } from './dist/index.js';

async function quickDemo() {
  console.log('🚀 Claude Code SDK Role System Demo\n');

  try {
    // 1. Show available roles
    console.log('📋 Available roles:');
    const roles = roleRegistry.list();
    roles.forEach(role => {
      console.log(`  • ${role.name}: ${role.description}`);
    });
    console.log();

    // 2. Quick chat example
    console.log('💬 Quick chat (no tools, fast):');
    const quickResult = await claude()
      .withRole('quickChat')
      .query('What is TypeScript in one sentence?')
      .asText();
    console.log(`Result: ${quickResult.slice(0, 100)}...\n`);

    // 3. Code analysis example (your use case!)
    console.log('🔍 Code analysis example:');
    console.log('This demonstrates your exact use case:');
    console.log('claude().withRole("codeAnalyzer").inDirectory("./src").asText()');
    
    const analysisResult = await claude()
      .withRole('codeAnalyzer')
      .inDirectory('./src')
      .query('What are the main components of this codebase?')
      .asText();
    console.log(`Analysis: ${analysisResult.slice(0, 200)}...\n`);

    // 4. Custom role example
    console.log('🛠️ Creating and using custom role:');
    const customRole = {
      name: 'quickAnalyzer',
      description: 'Fast analysis with minimal tools',
      defaultPrompt: 'Give me a quick overview',
      allowedTools: ['Read', 'LS'],
      model: 'haiku',
      timeout: 30000
    };

    roleRegistry.register(customRole);
    
    const customResult = await claude()
      .withRole('quickAnalyzer')
      .query() // Uses default prompt!
      .asText();
    console.log(`Custom role result: ${customResult.slice(0, 150)}...\n`);

    console.log('✨ Demo complete! Role system is working perfectly.');

  } catch (error) {
    console.error('❌ Demo failed:', error.message);
  }
}

// Run the demo
await quickDemo();