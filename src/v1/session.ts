/**
 * Persistent bidirectional session over the official Agent SDK.
 *
 * Unlike the one-shot `.query()` (which returns a `ResponseParser` over a single
 * turn), a session keeps the subprocess alive so you can send multiple messages,
 * read the live message stream, and issue control requests — interrupt, change
 * model, change permission mode — mid-run. This is the one capability a
 * spawn-per-query wrapper fundamentally cannot provide.
 *
 * @example
 * ```typescript
 * const s = claude().withModel('sonnet').session('start a long task');
 * for await (const msg of s) {
 *   if (msg.type === 'assistant') console.log(msg.content);
 * }
 * await s.setModel('opus');
 * s.send('now do the harder version');
 * await s.interrupt();
 * await s.close();
 * ```
 */
import { query as officialQuery } from '@anthropic-ai/claude-agent-sdk';
import type { Query, SDKUserMessage, PermissionMode as OfficialPermissionMode } from '@anthropic-ai/claude-agent-sdk';
import type { Message } from '../types.js';
import { adaptOfficialMessage, type OfficialMessageLike } from './adapter.js';
import { toOfficialOptions } from './options.js';
import type { V1Options } from './types.js';

/** Minimal push/pull async channel used to feed streaming input to the CLI. */
class AsyncInputQueue<T> implements AsyncIterable<T> {
  private items: T[] = [];
  private waiters: Array<(r: IteratorResult<T>) => void> = [];
  private ended = false;

  push(item: T): void {
    if (this.ended) return;
    const waiter = this.waiters.shift();
    if (waiter) waiter({ value: item, done: false });
    else this.items.push(item);
  }

  end(): void {
    this.ended = true;
    let waiter: ((r: IteratorResult<T>) => void) | undefined;
    while ((waiter = this.waiters.shift())) waiter({ value: undefined as never, done: true });
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<T> {
    for (;;) {
      if (this.items.length) {
        yield this.items.shift() as T;
        continue;
      }
      if (this.ended) return;
      const result = await new Promise<IteratorResult<T>>((resolve) => this.waiters.push(resolve));
      if (result.done) return;
      yield result.value;
    }
  }
}

export class V1Session implements AsyncIterable<Message> {
  private readonly input = new AsyncInputQueue<SDKUserMessage>();
  private readonly query: Query;
  private closed = false;

  constructor(options: V1Options, initialPrompt?: string) {
    this.query = officialQuery({
      prompt: this.input,
      options: toOfficialOptions(options) as never
    });
    if (initialPrompt !== undefined) this.send(initialPrompt);
  }

  /** Queue a user message. Returns `this` for chaining. */
  send(text: string): this {
    this.input.push({
      type: 'user',
      message: { role: 'user', content: text },
      parent_tool_use_id: null
    } as SDKUserMessage);
    return this;
  }

  /** Iterate the live message stream, adapted to classic `Message`s. */
  async *[Symbol.asyncIterator](): AsyncGenerator<Message> {
    for await (const msg of this.query) {
      const adapted = adaptOfficialMessage(msg as unknown as OfficialMessageLike);
      if (adapted) yield adapted;
    }
  }

  /** The raw official message stream + control object, for advanced use. */
  get controls(): Query {
    return this.query;
  }

  /** Interrupt the current turn. */
  interrupt(): Promise<unknown> {
    return this.query.interrupt();
  }

  /** Change the model for subsequent turns (undefined/null resets to default). */
  setModel(model?: string): Promise<void> {
    return this.query.setModel(model);
  }

  /** Change the permission mode for subsequent turns. */
  setPermissionMode(mode: OfficialPermissionMode): Promise<void> {
    return this.query.setPermissionMode(mode);
  }

  /** End the input stream so the session completes, and release resources. */
  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.input.end();
    // The official Query is an async generator; return() tears down the subprocess.
    await this.query.return?.(undefined);
  }
}
