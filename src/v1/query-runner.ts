/**
 * Runs a query through the official Agent SDK and yields classic `Message`s.
 *
 * This is the single seam between the fluent wrapper and the official SDK. It is
 * the only file that imports `@anthropic-ai/claude-agent-sdk`, so tests mock it
 * here to exercise the wrapper without spawning the real CLI.
 */
import { query as officialQuery } from '@anthropic-ai/claude-agent-sdk';
import type { Message } from '../types.js';
import { adaptOfficialMessage, type OfficialMessageLike } from './adapter.js';
import { toOfficialOptions } from './options.js';
import type { V1Options } from './types.js';

/** Raw official message stream (before adaptation to classic `Message`s). */
export async function* runV1QueryRaw(prompt: string, options: V1Options): AsyncGenerator<OfficialMessageLike> {
  const stream = officialQuery({
    prompt,
    // The official Options type changes frequently; our mapping asserts field
    // names via tests, so cast at this single boundary.
    options: toOfficialOptions(options) as never
  });

  for await (const msg of stream) {
    yield msg as unknown as OfficialMessageLike;
  }
}

export async function* runV1Query(prompt: string, options: V1Options): AsyncGenerator<Message> {
  for await (const msg of runV1QueryRaw(prompt, options)) {
    const adapted = adaptOfficialMessage(msg);
    if (adapted) yield adapted;
  }
}

/**
 * Yield real incremental text deltas from the official `stream_event` messages
 * (requires `includePartialMessages`). Unlike the classic SDK's after-the-fact
 * word-splitting, these are the model's actual streamed tokens.
 */
export async function* streamTextDeltas(prompt: string, options: V1Options): AsyncGenerator<string> {
  for await (const msg of runV1QueryRaw(prompt, { ...options, includePartialMessages: true })) {
    if (msg.type !== 'stream_event') continue;
    const event = (msg as { event?: { type?: string; delta?: { type?: string; text?: string } } }).event;
    if (event?.type === 'content_block_delta' && event.delta?.type === 'text_delta' && event.delta.text) {
      yield event.delta.text;
    }
  }
}
