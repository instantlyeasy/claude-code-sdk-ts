import { describe, it, expect } from 'vitest';
import { ResponseParser } from '../src/parser.js';
import type { Message } from '../src/types.js';

async function* gen(messages: Message[]): AsyncGenerator<Message> {
  for (const m of messages) yield m;
}

function parser(messages: Message[]): ResponseParser {
  return new ResponseParser(gen(messages));
}

// A realistic message stream mirroring the CLI's stream-json output.
const toolStream: Message[] = [
  { type: 'system', subtype: 'init', session_id: 'sess-1', model: 'claude-x' } as Message,
  { type: 'assistant', content: [{ type: 'tool_use', id: 'tu1', name: 'Read', input: { path: 'a.txt' } }], session_id: 'sess-1' },
  { type: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu1', content: 'file contents', is_error: false }], session_id: 'sess-1' },
  { type: 'assistant', content: [{ type: 'text', text: 'I read the file.' }], session_id: 'sess-1' },
  { type: 'result', subtype: 'success', content: 'Done', result: 'Done', is_error: false, total_cost_usd: 0.0123, num_turns: 1, session_id: 'sess-1', usage: { input_tokens: 10, output_tokens: 5 }, cost: { total_cost: 0.0123 } }
];

describe('ResponseParser — result shape (#20)', () => {
  it('asResult() returns the CLI result text, not empty string', async () => {
    expect(await parser(toolStream).asResult()).toBe('Done');
  });

  it('getUsage() reports the real total cost and tokens', async () => {
    const usage = await parser(toolStream).getUsage();
    expect(usage?.totalCost).toBeCloseTo(0.0123);
    expect(usage?.inputTokens).toBe(10);
    expect(usage?.totalTokens).toBe(15);
  });
});

describe('ResponseParser — tool results from user messages (#21, #9)', () => {
  it('asToolExecutions() correlates tool_use with tool_result across messages', async () => {
    const execs = await parser(toolStream).asToolExecutions();
    expect(execs).toHaveLength(1);
    expect(execs[0]).toMatchObject({ tool: 'Read', result: 'file contents', isError: false });
  });

  it('findToolResult() returns the tool result content', async () => {
    expect(await parser(toolStream).findToolResult('Read')).toBe('file contents');
  });

  it('getSessionId() resolves from the init/system message', async () => {
    expect(await parser(toolStream).getSessionId()).toBe('sess-1');
  });
});

describe('ResponseParser — success/error semantics (#22)', () => {
  it('succeeded() is true for a success result', async () => {
    expect(await parser(toolStream).succeeded()).toBe(true);
  });

  it('succeeded() is false when the result subtype is an error', async () => {
    const stream: Message[] = [
      { type: 'result', subtype: 'error_max_turns', content: '', is_error: true, num_turns: 5, session_id: 's' }
    ];
    expect(await parser(stream).succeeded()).toBe(false);
  });

  it('getErrors() surfaces a run-level failure and permission denials', async () => {
    const stream: Message[] = [
      { type: 'result', subtype: 'error_max_turns', content: '', is_error: true, session_id: 's', permission_denials: [{ tool_name: 'Bash', tool_use_id: 'x', tool_input: {} }] }
    ];
    const errors = await parser(stream).getErrors();
    expect(errors.some(e => /error_max_turns/.test(e))).toBe(true);
    expect(errors.some(e => /Bash/.test(e))).toBe(true);
  });

  it('getErrors() reports failed tool executions', async () => {
    const stream: Message[] = [
      { type: 'assistant', content: [{ type: 'tool_use', id: 't', name: 'Bash', input: {} }] },
      { type: 'user', content: [{ type: 'tool_result', tool_use_id: 't', content: 'boom', is_error: true }] },
      { type: 'result', subtype: 'success', content: 'ok', is_error: false }
    ];
    const errors = await parser(stream).getErrors();
    expect(errors.some(e => /Bash failed/.test(e))).toBe(true);
  });
});

describe('ResponseParser — stream() robustness (#core-21)', () => {
  it('replays cached messages when called after the stream was already consumed', async () => {
    const p = parser(toolStream);
    await p.asText(); // consume
    const seen: string[] = [];
    await p.stream(m => { seen.push(m.type); });
    expect(seen.length).toBe(toolStream.length);
  });
});
