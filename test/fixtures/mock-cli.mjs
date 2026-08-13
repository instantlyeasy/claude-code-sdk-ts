#!/usr/bin/env node
/**
 * Mock `claude` CLI for integration tests. Emits real-shaped stream-json to
 * stdout and exits, with behaviour selected by MOCK_CLI_MODE. It never calls
 * any API. The real CLI's flags are accepted and ignored (except that we echo
 * the received argv to MOCK_ARGV_FILE when set, so arg-building can be asserted
 * end-to-end).
 */
import { writeFileSync } from 'node:fs';

const mode = process.env.MOCK_CLI_MODE || 'basic';
const sid = 'sess-mock-1';

if (process.env.MOCK_ARGV_FILE) {
  try { writeFileSync(process.env.MOCK_ARGV_FILE, JSON.stringify(process.argv.slice(2))); } catch { /* ignore */ }
}

// Drain stdin (the prompt) so the writer's end() resolves cleanly, optionally
// capturing it so tests can assert what prompt the SDK actually sent.
let stdinBuf = '';
process.stdin.resume();
process.stdin.on('data', (d) => { stdinBuf += d; });
process.stdin.on('end', () => {
  if (process.env.MOCK_STDIN_FILE) {
    try { writeFileSync(process.env.MOCK_STDIN_FILE, stdinBuf); } catch { /* ignore */ }
  }
});

const emit = (obj) => {
  process.stdout.write(JSON.stringify(obj) + '\n');
};

const init = () =>
  emit({
    type: 'system', subtype: 'init', session_id: sid, uuid: 'u-init',
    model: 'claude-mock', permissionMode: 'default', tools: ['Read', 'Write'],
    mcp_servers: [], slash_commands: [], apiKeySource: 'user', cwd: process.cwd()
  });

const assistantText = (text) =>
  emit({ type: 'assistant', message: { content: [{ type: 'text', text }] }, session_id: sid });

const successResult = (result = 'Final answer from mock') =>
  emit({
    type: 'result', subtype: 'success', is_error: false, result,
    total_cost_usd: 0.0123, num_turns: 1, duration_ms: 42, session_id: sid,
    usage: { input_tokens: 10, output_tokens: 5 }
  });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  switch (mode) {
    case 'basic':
      init();
      assistantText('Hello from the mock CLI');
      successResult();
      break;

    case 'tool':
      init();
      emit({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 'tu1', name: 'Read', input: { path: 'a.txt' } }] }, session_id: sid });
      emit({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'tu1', content: 'file contents', is_error: false }] }, session_id: sid });
      assistantText('I read the file.');
      successResult('Done reading a.txt');
      break;

    case 'error-result':
      init();
      emit({ type: 'result', subtype: 'error_max_turns', is_error: true, num_turns: 5, total_cost_usd: 0.02, session_id: sid, permission_denials: [{ tool_name: 'Bash', tool_use_id: 'tu9', tool_input: {} }] });
      break;

    case 'error-exit':
      init();
      process.stderr.write("error: something went wrong in the mock\n");
      process.exit(3);
      break;

    case 'slow':
      // Emit a couple of messages, then stay alive well past any test timeout so
      // the SDK is the one that kills us (early break / abort / timeout paths).
      init();
      assistantText('working...');
      await sleep(30000);
      successResult();
      break;

    default:
      init();
      successResult();
  }
}

main();
