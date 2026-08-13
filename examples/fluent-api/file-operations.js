import { claude } from '../../dist/index.js';
import path from 'path';

/**
 * File Operations Example using Fluent API
 * Demonstrates file manipulation tasks using Claude Code SDK
 */

// 1. Create a new file with content
console.log('1. Creating a new file:');
const createResult = await claude()
  .allowTools('Write')
  .acceptEdits()
  .query('Create a file called "example-output.txt" with a haiku about coding')
  .asText();

console.log(createResult);

// 2. Read and analyze file contents
console.log('\n2. Reading and analyzing a file:');
const analyzeResult = await claude()
  .allowTools('Read', 'Grep')
  .query('Read the package.json file and summarize the project dependencies')
  .asText();

console.log(analyzeResult);

// 3. Search for patterns in files
console.log('\n3. Searching for patterns:');
await claude()
  .allowTools('Grep', 'Glob')
  .inDirectory(path.resolve('..'))
  .query('Find all TypeScript files that import the "Message" type')
  .stream(async (message) => {
    if (message.type === 'assistant') {
      for (const block of message.content) {
        if (block.type === 'text') {
          process.stdout.write(block.text);
        }
      }
    }
  });

// 4. Batch file operations
console.log('\n\n4. Batch file operations:');
const batchResult = await claude()
  .allowTools('Read', 'Write', 'LS')
  .acceptEdits()
  .withTimeout(60000)
  .onToolUse(tool => console.log(`  Using tool: ${tool.name}`))
  .query(`Please do the following:
1. List all .js files in the current directory
2. Create a file called "file-list.txt" containing the names
3. Add a timestamp at the top of the file`)
  .asText();

console.log(batchResult);

// 5. File organization with explicit tool permissions
console.log('\n5. File organization with safety:');
const organizeResult = await claude()
  .allowTools('Read', 'Write', 'LS', 'Glob')
  .denyTools('Bash') // Prevent shell commands
  .acceptEdits()
  .query(`Organize the example files:
- Create a "processed" subdirectory if it doesn't exist
- List all .txt files created today
- Provide a summary of what was found`)
  .asText();

console.log(organizeResult);

// 6. Safe file editing
console.log('\n6. Safe file editing:');
const editResult = await claude()
  .allowTools('Read', 'Edit')
  .withPermissions('default') // Ask for permission
  .query('Add a comment header to example-output.txt explaining when it was created')
  .asText();

console.log(editResult);

// 7. Clean up temporary files
console.log('\n7. Cleanup operations:');
const cleanupResult = await claude()
  .allowTools('LS', 'Read')
  .skipPermissions() // For read-only operations
  .query('List any temporary files (*.tmp, *.log) that might need cleanup')
  .asText();

console.log(cleanupResult);