import { claude } from '@instantlyeasy/claude-code-sdk-ts/v1';
import path from 'path';

/**
 * File Operations Example — v1 API
 *
 * v1 upgrades over the classic version:
 * - A canUseTool permission callback enforces a write sandbox programmatically
 *   (the classic ToolPermissionManager computed decisions nothing enforced).
 * - Tool usage is logged with a PreToolUse hook.
 * - Timeouts via AbortSignal.timeout().
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
    if (message.type === 'assistant' && Array.isArray(message.content)) {
      for (const block of message.content) {
        if (block.type === 'text') {
          process.stdout.write(block.text);
        }
      }
    }
  });

// 4. Batch file operations with a tool-usage hook
console.log('\n\n4. Batch file operations:');
const batchResult = await claude()
  .allowTools('Read', 'Write', 'Glob')
  .acceptEdits()
  .withSignal(AbortSignal.timeout(60_000))
  .onPreToolUse(async (input) => {
    if ('tool_name' in input) console.log(`  Using tool: ${input.tool_name}`);
    return {};
  })
  .query(`Please do the following:
1. List all .js files in the current directory
2. Create a file called "file-list.txt" containing the names
3. Add a timestamp at the top of the file`)
  .asText();

console.log(batchResult);

// 5. ENFORCED write sandbox via canUseTool — a real permission callback.
// Any Write outside ./sandbox is rewritten into it; Bash is denied outright.
console.log('\n5. Enforced write sandbox (canUseTool):');
const sandboxResult = await claude()
  .allowTools('Read', 'Glob')
  .canUseTool(async (toolName, input) => {
    if (toolName === 'Bash') {
      return { behavior: 'deny', message: 'Shell commands are not allowed in this example' };
    }
    if (toolName === 'Write' && typeof input.file_path === 'string' && !input.file_path.includes('sandbox/')) {
      return { behavior: 'allow', updatedInput: { ...input, file_path: `sandbox/${path.basename(input.file_path)}` } };
    }
    return { behavior: 'allow' };
  })
  .query(`Create a "notes.txt" file summarizing the .txt files present here`)
  .asText();

console.log(sandboxResult);

// 6. Safe file editing (interactive permission flow)
console.log('\n6. Safe file editing:');
const editResult = await claude()
  .allowTools('Read', 'Edit')
  .withPermissions('default') // fall through to normal permission prompts
  .query('Add a comment header to example-output.txt explaining when it was created')
  .asText();

console.log(editResult);

// 7. Read-only sweep (no-arg allowTools = read-only mode)
console.log('\n7. Cleanup scan (read-only):');
const cleanupResult = await claude()
  .allowTools() // denies mutating tools; Read/Grep/Glob stay available
  .query('List any temporary files (*.tmp, *.log) that might need cleanup')
  .asText();

console.log(cleanupResult);
