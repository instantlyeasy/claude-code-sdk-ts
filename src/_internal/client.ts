import { SubprocessCLITransport } from './transport/subprocess-cli.js';
import type { ClaudeCodeOptions, Message } from '../types.js';
import { ClaudeSDKError } from '../errors.js';

export class InternalClient {
  private options: ClaudeCodeOptions;
  private prompt: string;

  constructor(prompt: string, options: ClaudeCodeOptions = {}) {
    this.prompt = prompt;
    this.options = options;
  }

  async *processQuery(): AsyncGenerator<Message> {
    const transport = new SubprocessCLITransport(this.prompt, this.options);

    try {
      await transport.connect();

      for await (const output of transport.receiveMessages()) {
        const message = this.parseMessage(output);
        if (message) {
          yield message;
        }
      }
    } finally {
      await transport.disconnect();
    }
  }

  private parseMessage(output: any): Message | null {
    // Handle stream-json format directly from CLI
    switch (output.type) {
      case 'user':
        return {
          type: 'user',
          content: output.message?.content || '',
          session_id: output.session_id
        };

      case 'assistant':
        return {
          type: 'assistant',
          content: output.message?.content || [],
          session_id: output.session_id
        };

      case 'system':
        return {
          type: 'system',
          subtype: output.subtype,
          data: output,
          session_id: output.session_id
        };

      case 'result':
        return {
          type: 'result',
          subtype: output.subtype,
          content: output.result || '',
          usage: output.usage,
          cost: {
            total_cost: output.total_cost_usd
          },
          session_id: output.session_id
        };

      case 'error':
        throw new ClaudeSDKError(`CLI error: ${output.error?.message || 'Unknown error'}`);

      default:
        // Skip unknown message types
        return null;
    }
  }
}
