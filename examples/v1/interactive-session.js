import { claude } from '@instantlyeasy/claude-code-sdk-ts/v1';
import readline from 'readline';

/**
 * Interactive Session Example — v1 API
 *
 * This is where v1 shines. The classic version faked conversation continuity by
 * concatenating history into every prompt and spawning a fresh CLI per turn.
 * v1 opens ONE persistent bidirectional session: the agent keeps its own
 * context, and you get mid-run controls — switch model, change permission
 * mode, or interrupt a running turn.
 */

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'You: '
});

// One persistent session for the whole conversation.
const session = claude()
  .withModel('sonnet')
  .allowTools('Read', 'Write', 'Edit', 'Grep')
  .acceptEdits()
  .session();

console.log('Claude Code Interactive Session (v1 — persistent bidirectional)');
console.log('Type "help" for commands, "exit" to quit\n');

// Single consumer: prints assistant text live; re-prompts when a turn ends.
const consumer = (async () => {
  try {
    for await (const msg of session) {
      if (msg.type === 'assistant' && Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block.type === 'text') process.stdout.write(block.text);
        }
      }
      if (msg.type === 'result') {
        process.stdout.write('\n\n');
        rl.prompt();
      }
    }
  } catch (error) {
    console.error('\nSession error:', error.message);
    process.exit(1);
  }
})();

rl.prompt();

rl.on('line', async (input) => {
  const trimmed = input.trim();

  if (trimmed === 'exit' || trimmed === 'quit') {
    console.log('Goodbye!');
    await session.close();
    await consumer;
    rl.close();
    process.exit(0);
  }

  if (trimmed === 'help') {
    console.log(`
Available commands:
  help          - Show this help message
  model <name>  - Switch model mid-session (e.g. "model opus") — no restart!
  mode <mode>   - Change permission mode (default/acceptEdits/plan/bypassPermissions)
  interrupt     - Interrupt the currently running turn
  exit          - Exit the session
    `);
    rl.prompt();
    return;
  }

  if (trimmed.startsWith('model ')) {
    const model = trimmed.substring(6);
    await session.setModel(model);       // mid-run control — same conversation
    console.log(`Switched to model: ${model}`);
    rl.prompt();
    return;
  }

  if (trimmed.startsWith('mode ')) {
    const mode = trimmed.substring(5);
    await session.setPermissionMode(mode);
    console.log(`Permission mode: ${mode}`);
    rl.prompt();
    return;
  }

  if (trimmed === 'interrupt') {
    await session.interrupt();
    console.log('Turn interrupted.');
    rl.prompt();
    return;
  }

  if (!trimmed) {
    rl.prompt();
    return;
  }

  // No manual history management — the session holds the conversation.
  console.log('\nClaude: ');
  session.send(trimmed);
});

// Handle Ctrl+C gracefully
rl.on('SIGINT', async () => {
  console.log('\n\nGoodbye!');
  await session.close();
  rl.close();
  process.exit(0);
});
