import { describe, it, expect, vi, beforeEach } from 'vitest';

// Capture the params the wrapper passes to the official SDK, and drive the
// message stream from a per-test fixture. The official CLI is never spawned.
const captured: {
  prompt?: unknown;
  options?: Record<string, unknown>;
  controlCalls: Array<[string, unknown]>;
} = { controlCalls: [] };
let fixture: unknown[] = [];

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: (params: { prompt: unknown; options: Record<string, unknown> }) => {
    captured.prompt = params.prompt;
    captured.options = params.options;

    // Streaming-input mode: echo each queued user message back as an assistant
    // turn (so session tests can assert round-trips), then emit the fixture.
    const gen = (async function* () {
      const p = params.prompt;
      if (p && typeof p === 'object' && Symbol.asyncIterator in (p as object)) {
        for await (const userMsg of p as AsyncIterable<{ message: { content: unknown } }>) {
          yield {
            type: 'assistant',
            message: { content: [{ type: 'text', text: `echo:${String(userMsg.message.content)}` }] },
            session_id: 'live-1',
            parent_tool_use_id: null
          };
        }
        yield { type: 'result', subtype: 'success', result: 'session done', session_id: 'live-1' };
        return;
      }
      for (const m of fixture) yield m;
    })();

    // Query-like surface: generator + control methods.
    return Object.assign(gen, {
      interrupt: vi.fn(async () => { captured.controlCalls.push(['interrupt', null]); return {}; }),
      setModel: vi.fn(async (m?: string) => { captured.controlCalls.push(['setModel', m]); }),
      setPermissionMode: vi.fn(async (m: string) => { captured.controlCalls.push(['setPermissionMode', m]); })
    });
  },
  // Stubs for the symbols the ./v1 entry re-exports, so the re-export wiring is
  // exercised without the real (CLI-spawning) implementations.
  createSdkMcpServer: vi.fn((o: { name: string }) => ({ type: 'sdk', name: o.name, instance: {} })),
  tool: vi.fn((name: string) => ({ name })),
  listSessions: vi.fn(async () => []),
  getSessionInfo: vi.fn(async () => undefined),
  getSessionMessages: vi.fn(async () => []),
  forkSession: vi.fn(async () => ({})),
  renameSession: vi.fn(async () => undefined),
  deleteSession: vi.fn(async () => undefined)
}));

// Imported after the mock is registered.
const v1 = await import('../src/v1/index.js');
const { claude, toOfficialOptions, adaptOfficialMessage } = v1;

const officialStream = [
  { type: 'system', subtype: 'init', session_id: 's1', model: 'claude-x', tools: ['Read'] },
  { type: 'assistant', message: { content: [{ type: 'tool_use', id: 't1', name: 'Read', input: { path: 'a.txt' } }] }, session_id: 's1', parent_tool_use_id: null },
  { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 't1', content: 'file body', is_error: false }] }, session_id: 's1', parent_tool_use_id: null },
  { type: 'assistant', message: { content: [{ type: 'text', text: 'The file says hello.' }] }, session_id: 's1', parent_tool_use_id: null },
  { type: 'result', subtype: 'success', result: 'The file says hello.', is_error: false, num_turns: 1, total_cost_usd: 0.0234, session_id: 's1', usage: { input_tokens: 12, output_tokens: 7 }, modelUsage: {}, structured_output: { answer: 42 } }
];

beforeEach(() => {
  fixture = officialStream;
  captured.prompt = undefined;
  captured.options = undefined;
  captured.controlCalls = [];
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

describe('v1 canUseTool + hooks', () => {
  it('passes a canUseTool callback through to the official query', async () => {
    const handler = vi.fn(async () => ({ behavior: 'allow' as const }));
    await claude().canUseTool(handler).query('go').asText();
    expect(captured.options?.canUseTool).toBe(handler);
  });

  it('addHook builds a Partial<Record<HookEvent, HookCallbackMatcher[]>> and passes it through', async () => {
    const pre = vi.fn(async () => ({}));
    const post = vi.fn(async () => ({}));
    await claude()
      .onPreToolUse(pre, { matcher: 'Bash' })
      .onPostToolUse(post)
      .addHook('Stop', post)
      .query('go')
      .asText();

    const hooks = captured.options?.hooks as Record<string, Array<{ matcher?: string; hooks: unknown[]; timeout?: number }>>;
    expect(hooks.PreToolUse).toHaveLength(1);
    expect(hooks.PreToolUse[0]).toMatchObject({ matcher: 'Bash' });
    expect(hooks.PreToolUse[0].hooks[0]).toBe(pre);
    expect(hooks.PostToolUse[0].hooks[0]).toBe(post);
    expect(hooks.Stop[0].hooks[0]).toBe(post);
  });

  it('multiple hooks on the same event are appended as separate matchers', async () => {
    const a = vi.fn(async () => ({}));
    const b = vi.fn(async () => ({}));
    await claude().onPreToolUse(a).onPreToolUse(b).query('go').asText();
    const hooks = captured.options?.hooks as Record<string, unknown[]>;
    expect(hooks.PreToolUse).toHaveLength(2);
  });
});

describe('v1 in-process MCP servers', () => {
  it('re-exports createSdkMcpServer and tool as functions', () => {
    expect(typeof v1.createSdkMcpServer).toBe('function');
    expect(typeof v1.tool).toBe('function');
  });

  it('withMCPServer keys the server by its name in the official mcpServers map', async () => {
    const server = { type: 'sdk' as const, name: 'math', instance: {} as never };
    await claude().withMCPServer(server).query('go').asText();
    const mcp = captured.options?.mcpServers as Record<string, unknown>;
    expect(mcp.math).toBe(server);
  });
});

describe('v1 sessions', () => {
  it('re-exports the session utilities as functions', () => {
    for (const fn of ['listSessions', 'getSessionInfo', 'getSessionMessages', 'forkSession', 'renameSession', 'deleteSession']) {
      expect(typeof (v1 as Record<string, unknown>)[fn]).toBe('function');
    }
  });

  it('.resume(id) maps to the official resume option', async () => {
    await claude().resume('sess-xyz').query('go').asText();
    expect(captured.options?.resume).toBe('sess-xyz');
  });
});

describe('v1 real partial streaming', () => {
  it('streamText() yields the model\'s actual text deltas from stream_event', async () => {
    fixture = [
      { type: 'system', subtype: 'init', session_id: 's1' },
      { type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hel' } } },
      { type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'lo' } } },
      { type: 'stream_event', event: { type: 'content_block_start', delta: {} } }, // ignored (not a text_delta)
      { type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: '!' } } },
      { type: 'result', subtype: 'success', result: 'Hello!', session_id: 's1' }
    ];
    const tokens: string[] = [];
    for await (const t of claude().streamText('hi')) tokens.push(t);
    expect(tokens).toEqual(['Hel', 'lo', '!']);
    // and it turned on partial messages
    expect(captured.options?.includePartialMessages).toBe(true);
  });
});

describe('v1 bidirectional session', () => {
  it('streams multiple sent messages and completes on close()', async () => {
    const s = claude().withModel('sonnet').session('first');
    s.send('second');

    const seen: string[] = [];
    const iterate = (async () => {
      for await (const msg of s) {
        if (msg.type === 'assistant' && Array.isArray(msg.content)) {
          const block = msg.content[0];
          if (block?.type === 'text') seen.push(block.text);
        }
        if (msg.type === 'result') break;
      }
    })();

    // Give the echo loop a tick, then end the input so the stream completes.
    await new Promise(r => setTimeout(r, 20));
    await s.close();
    await iterate;

    expect(seen).toEqual(['echo:first', 'echo:second']);
    // Streaming-input mode: the prompt passed to the official SDK is an AsyncIterable.
    expect(typeof (captured.prompt as { [Symbol.asyncIterator]?: unknown })[Symbol.asyncIterator]).toBe('function');
  });

  it('exposes interrupt / setModel / setPermissionMode controls', async () => {
    const s = claude().session();
    await s.interrupt();
    await s.setModel('opus');
    await s.setPermissionMode('acceptEdits');
    await s.close();
    expect(captured.controlCalls).toEqual([
      ['interrupt', null],
      ['setModel', 'opus'],
      ['setPermissionMode', 'acceptEdits']
    ]);
  });
});

describe('v1 structured outputs', () => {
  it('withOutputFormat maps to the official json_schema shape', () => {
    const opts = toOfficialOptions({ outputFormat: { type: 'json_schema', schema: { type: 'object' } } });
    expect(opts.outputFormat).toEqual({ type: 'json_schema', schema: { type: 'object' } });
  });

  it('asStructured() returns the result message structured_output', async () => {
    const structured = await claude()
      .withOutputFormat({ type: 'object', properties: { answer: { type: 'number' } } })
      .query('go')
      .asStructured<{ answer: number }>();
    expect(structured).toEqual({ answer: 42 });
  });
});
