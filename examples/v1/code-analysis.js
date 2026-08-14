import { claude } from '@instantlyeasy/claude-code-sdk-ts/v1';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Code Analysis Example — v1 API
 *
 * Differences from the classic version:
 * - Tool usage is observed with a PreToolUse hook (in-process callback)
 *   instead of the classic onToolUse handler.
 * - Timeouts use AbortSignal.timeout() via withSignal() (v1 has no withTimeout).
 */

async function analyzeCodeFile(filePath) {
  const code = await fs.readFile(filePath, 'utf-8');
  const fileName = path.basename(filePath);

  console.log(`\nAnalyzing ${fileName}...`);

  await claude()
    .withModel('opus')
    .allowTools('Read', 'Grep', 'Glob')
    .withSignal(AbortSignal.timeout(60_000))
    .query(`Analyze this code and provide:
1. A brief summary of what it does
2. Any potential issues or improvements
3. Code quality assessment

Code to analyze (${fileName}):
\`\`\`javascript
${code}
\`\`\``)
    .stream(async (message) => {
      if (message.type === 'assistant' && Array.isArray(message.content)) {
        for (const block of message.content) {
          if (block.type === 'text') {
            process.stdout.write(block.text);
          }
        }
      }
    });

  console.log('\n' + '='.repeat(80));
}

// Analyze the project with a tool-usage hook
async function analyzeProject() {
  console.log('Starting project code analysis...');

  const projectAnalysis = await claude()
    .withModel('opus')
    .allowTools('Read', 'Grep', 'Glob')
    .inDirectory(path.resolve('..'))
    .withSignal(AbortSignal.timeout(120_000))
    // PreToolUse hook: runs in-process before every tool call.
    .onPreToolUse(async (input) => {
      if ('tool_name' in input) console.log(`  [Tool: ${input.tool_name}]`);
      return {};
    })
    .query(`Analyze the TypeScript SDK project structure. Look at:
1. The overall architecture and design patterns
2. Type safety and error handling
3. API design and usability
4. Potential improvements or missing features

Focus on the main source files in the src/ directory.`)
    .asText();

  console.log('\nProject Analysis:');
  console.log(projectAnalysis);
}

// Run analyses
if (process.argv[2] === '--file' && process.argv[3]) {
  analyzeCodeFile(process.argv[3]);
} else {
  analyzeProject();
}
