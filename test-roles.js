#!/usr/bin/env node

import { claude, roleRegistry } from './dist/index.js';

// Test role system basics
console.log('🔧 Testing Role System...\n');

// 1. Show built-in roles
console.log('📋 Built-in roles loaded:');
const roles = roleRegistry.list();
roles.forEach(role => {
  console.log(`  ✓ ${role.name}: ${role.description}`);
  console.log(`    Tools: ${role.allowedTools?.join(', ') || 'none'}`);
  console.log(`    Model: ${role.model || 'default'}`);
  console.log(`    Default prompt: ${role.defaultPrompt || 'none'}\n`);
});

// 2. Test role application
console.log('🎯 Testing role application...');
try {
  const builder = claude().withRole('codeAnalyzer');
  console.log('✓ Role "codeAnalyzer" applied successfully');
  
  // Test your specific use case syntax
  const yourUseCase = claude()
    .withRole('codeAnalyzer')
    .inDirectory('/tmp');
  console.log('✓ Your use case syntax works: .withRole("codeAnalyzer").inDirectory("/tmp")');
  
} catch (error) {
  console.error('❌ Role application failed:', error.message);
}

// 3. Test custom role
console.log('\n🛠️ Testing custom role...');
try {
  const customRole = {
    name: 'testRole',
    description: 'Test role for validation',
    defaultPrompt: 'This is a test',
    allowedTools: ['Read'],
    model: 'haiku'
  };
  
  roleRegistry.register(customRole);
  console.log('✓ Custom role registered');
  
  claude().withRole('testRole');
  console.log('✓ Custom role applied');
  
} catch (error) {
  console.error('❌ Custom role failed:', error.message);
}

console.log('\n✨ Role system test complete!');