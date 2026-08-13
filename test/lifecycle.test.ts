import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { query } from '../src/index.js';
import { AbortError } from '../src/errors.js';
import { TimeoutError } from '../src/types/enhanced-errors.js';

const MOCK = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'mock-cli.mjs');

function withMode<T>(mode: string, fn: () => Promise<T>): Promise<T> {
  const prev = process.env.MOCK_CLI_MODE;
  process.env.MOCK_CLI_MODE = mode;
  return fn().finally(() => { process.env.MOCK_CLI_MODE = prev; });
}

// Direct query() calls with the executable injected via options.
async function collect(mode: string, prompt = 'hi') {
  return withMode(mode, async () => {
    const messages = [];
    for await (const m of query(prompt, { pathToClaudeCodeExecutable: MOCK })) {
      messages.push(m);
    }
    return messages;
  });
}

describe('query() lifecycle (#15 crash, #18 timeout, abort)', () => {
  it('yields system/assistant/result and reads the result text', async () => {
    const messages = await collect('basic');
    const result = messages.find(m => m.type === 'result') as { content?: string } | undefined;
    expect(messages.some(m => m.type === 'system')).toBe(true);
    expect(messages.some(m => m.type === 'assistant')).toBe(true);
    expect(result?.content).toBe('Final answer from mock');
  });

  it('surfaces tool results as user messages', async () => {
    const messages = await collect('tool');
    const user = messages.find(m => m.type === 'user') as { content?: unknown } | undefined;
    expect(user).toBeDefined();
    expect(Array.isArray(user?.content)).toBe(true);
  });

  it('does NOT crash the host process when the consumer breaks early (#15)', async () => {
    const rejections: unknown[] = [];
    const onRejection = (r: unknown) => rejections.push(r);
    process.on('unhandledRejection', onRejection);
    try {
      await withMode('slow', async () => {
        for await (const _m of query('hi', { pathToClaudeCodeExecutable: MOCK })) {
          break; // kills the still-running mock via disconnect()
        }
      });
      // Give any stray rejection a tick to surface.
      await new Promise(r => setTimeout(r, 200));
      expect(rejections).toEqual([]);
    } finally {
      process.off('unhandledRejection', onRejection);
    }
  });

  it('throws AbortError when aborted mid-stream, without crashing (#15)', async () => {
    const rejections: unknown[] = [];
    const onRejection = (r: unknown) => rejections.push(r);
    process.on('unhandledRejection', onRejection);
    const controller = new AbortController();
    try {
      await expect(withMode('slow', async () => {
        setTimeout(() => controller.abort(), 100);
        for await (const _m of query('hi', { pathToClaudeCodeExecutable: MOCK, signal: controller.signal })) {
          // consume until aborted
        }
      })).rejects.toBeInstanceOf(AbortError);
      await new Promise(r => setTimeout(r, 200));
      expect(rejections).toEqual([]);
    } finally {
      process.off('unhandledRejection', onRejection);
    }
  });

  it('throws AbortError immediately when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(withMode('basic', async () => {
      for await (const _m of query('hi', { pathToClaudeCodeExecutable: MOCK, signal: controller.signal })) {
        // should not get here
      }
    })).rejects.toBeInstanceOf(AbortError);
  });

  it('enforces timeout and throws TimeoutError (#18)', async () => {
    await expect(withMode('slow', async () => {
      for await (const _m of query('hi', { pathToClaudeCodeExecutable: MOCK, timeout: 200 })) {
        // consume until timeout kills it
      }
    })).rejects.toBeInstanceOf(TimeoutError);
  });

  it('includes stderr in ProcessError on nonzero exit (#23c)', async () => {
    await expect(withMode('error-exit', async () => {
      for await (const _m of query('hi', { pathToClaudeCodeExecutable: MOCK })) {
        // consume
      }
    })).rejects.toThrow(/something went wrong in the mock/);
  });
});
