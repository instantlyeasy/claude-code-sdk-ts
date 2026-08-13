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

export async function* runV1Query(prompt: string, options: V1Options): AsyncGenerator<Message> {
  const stream = officialQuery({
    prompt,
    // The official Options type changes frequently; our mapping asserts field
    // names via tests, so cast at this single boundary.
    options: toOfficialOptions(options) as never
  });

  for await (const msg of stream) {
    const adapted = adaptOfficialMessage(msg as unknown as OfficialMessageLike);
    if (adapted) yield adapted;
  }
}
