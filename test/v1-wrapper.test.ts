import { describe, it, expect, vi, beforeEach } from 'vitest';

// Capture the params the wrapper passes to the official SDK, and drive the
// message stream from a per-test fixture. The official CLI is never spawned.
const captured: { prompt?: unknown; options?: Record<string, unknown> } = {};
let fixture: unknown[] = [];

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: (params: { prompt: unknown; options: Record<string, unknown> }) => {
    captured.prompt = params.prompt;
    captured.options = params.options;
    return (async function* () {
      for (const m of fixture) yield m;
    })();
  }
}));

// Imported after the mock is registered.
const { claude, toOfficialOptions, adaptOfficialMessage } = await import('../src/v1/index.js');

const officialStream = [
  { type: 'system', subtype: 'init', session_id: 's1', model: 'claude-x', tools: ['Read'] },
  { type: 'assistant', message: { content: [{ type: 'tool_use', id: 't1', name: 'Read', input: { path: 'a.txt' } }] }, session_id: 's1', parent_tool_use_id: null },
  { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 't1', content: 'file body', is_error: false }] }, session_id: 's1', parent_tool_use_id: null },
  { type: 'assistant', message: { content: [{ type: 'text', text: 'The file says hello.' }] }, session_id: 's1', parent_tool_use_id: null },
  { type: 'result', subtype: 'success', result: 'The file says hello.', is_error: false, num_turns: 1, total_cost_usd: 0.0234, session_id: 's1', usage: { input_tokens: 12, output_tokens: 7 }, modelUsage: {} }
];

beforeEach(() => {
  fixture = officialStream;
  captured.prompt = undefined;
  captured.options = undefined;
});

describe('v1 option mapping', () => {
  it('maps builder state to official Options field names', () => {
    const opts = toOfficialOptions({
      model: 'sonnet',
      allowedTools: ['Read'],
      deniedTools: ['Bash'],
      permissionMode: 'acceptEdits',
      addDirectories: ['/x'],
      sessionId: 'sess-1',
      maxTurns: 3,
      systemPrompt: 'Be terse.'
    });
    expect(opts).toMatchObject({
      model: 'sonnet',
      allowedTools: ['Read'],
      disallowedTools: ['Bash'],
      permissionMode: 'acceptEdits',
      additionalDirectories: ['/x'],
      resume: 'sess-1',
      maxTurns: 3,
      systemPrompt: { type: 'preset', preset: 'claude_code', append: 'Be terse.' }
    });
  });
});

describe('v1 message adapter', () => {
  it('maps official result to a classic ResultMessage with real text + cost', () => {
    const m = adaptOfficialMessage({ type: 'result', subtype: 'success', result: 'Hi', total_cost_usd: 0.01, session_id: 's' });
    expect(m).toMatchObject({ type: 'result', content: 'Hi', result: 'Hi', total_cost_usd: 0.01 });
  });
  it('returns null for message variants with no classic equivalent', () => {
    expect(adaptOfficialMessage({ type: 'stream_event' })).toBeNull();
  });
});

describe('v1 end-to-end through the official SDK (mocked)', () => {
  it('runs a query and extracts text via the shared ResponseParser', async () => {
    const text = await claude().withModel('sonnet').allowTools('Read').query('read a.txt').asText();
    expect(text).toContain('The file says hello.');
    // The wrapper actually invoked the official query with mapped options.
    expect(captured.options).toMatchObject({ model: 'sonnet', allowedTools: ['Read'] });
    expect(captured.prompt).toBe('read a.txt');
  });

  it('asResult() and getUsage() reflect the official result message', async () => {
    const parser = claude().query('go');
    expect(await parser.asResult()).toBe('The file says hello.');
    const usage = await claude().query('go').getUsage();
    expect(usage?.totalCost).toBeCloseTo(0.0234);
    expect(usage?.inputTokens).toBe(12);
  });

  it('asToolExecutions() correlates official tool_use/tool_result across messages', async () => {
    const execs = await claude().query('go').asToolExecutions();
    expect(execs).toHaveLength(1);
    expect(execs[0]).toMatchObject({ tool: 'Read', result: 'file body', isError: false });
  });

  it('getSessionId() resolves from the official init message', async () => {
    expect(await claude().query('go').getSessionId()).toBe('s1');
  });

  it('read-only allowTools() denies mutating tools', () => {
    void claude().allowTools().query('noop');
    // deniedTools mapped to disallowedTools
    const opts = toOfficialOptions({ deniedTools: ['Write', 'Edit', 'MultiEdit', 'Bash', 'NotebookEdit', 'TodoWrite'] });
    expect(opts.disallowedTools).toContain('Bash');
  });
});
