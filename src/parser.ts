import type { Message, ToolUseBlock, ResultMessage } from './types.js';
import type { Logger } from './logger.js';

/**
 * Response parser for extracting and transforming Claude messages
 * Provides convenient methods for common parsing patterns
 *
 * @example
 * ```typescript
 * const result = await claude()
 *   .query('Create a hello.txt file')
 *   .asText(); // Returns just the text content
 *
 * const files = await claude()
 *   .query('Read all config files')
 *   .findToolResults('Read'); // Returns all Read tool results
 * ```
 */
export class ResponseParser {
  protected messages: Message[] = [];
  private consumed = false;

  constructor(
    private generator: AsyncGenerator<Message>,
    private handlers: Array<(message: Message) => void> = [],
    private logger?: Logger
  ) {}

  /**
   * Get all messages as an array (consumes the generator)
   */
  async asArray(): Promise<Message[]> {
    await this.consume();
    return this.messages;
  }

  /**
   * Get only the text content from assistant messages
   */
  async asText(): Promise<string> {
    await this.consume();

    const texts: string[] = [];
    for (const msg of this.messages) {
      if (msg.type === 'assistant') {
        for (const block of msg.content) {
          if (block.type === 'text') {
            texts.push(block.text);
          }
        }
      }
    }

    return texts.join('\n');
  }

  /**
   * Get the final result message content
   */
  async asResult(): Promise<string | null> {
    await this.consume();

    const resultMsg = this.messages.findLast((msg): msg is ResultMessage => msg.type === 'result');
    return resultMsg?.content ?? null;
  }

  /**
   * Get all tool uses with their results
   */
  async asToolExecutions(): Promise<ToolExecution[]> {
    await this.consume();

    const executions: ToolExecution[] = [];
    const toolUses = new Map<string, ToolUseBlock>();

    for (const msg of this.messages) {
      if (msg.type === 'assistant') {
        for (const block of msg.content) {
          if (block.type === 'tool_use') {
            toolUses.set(block.id, block);
          } else if (block.type === 'tool_result') {
            const toolUse = toolUses.get(block.tool_use_id);
            if (toolUse) {
              executions.push({
                tool: toolUse.name,
                input: toolUse.input,
                result: block.content,
                isError: block.is_error ?? false
              });
            }
          }
        }
      }
    }

    return executions;
  }

  /**
   * Find all tool results for a specific tool
   */
  async findToolResults(toolName: string): Promise<any[]> {
    const executions = await this.asToolExecutions();
    return executions.filter(exec => exec.tool === toolName && !exec.isError).map(exec => exec.result);
  }

  /**
   * Get first tool result for a specific tool
   */
  async findToolResult(toolName: string): Promise<any | null> {
    const results = await this.findToolResults(toolName);
    return results[0] ?? null;
  }

  /**
   * Extract structured data from the response
   */
  async asJSON<T = any>(): Promise<T | null> {
    const text = await this.asText();

    // Try to find JSON in code blocks first
    const codeBlockMatch = text.match(/```(?:json)?\n([\s\S]*?)\n```/);
    if (codeBlockMatch) {
      try {
        return JSON.parse(codeBlockMatch[1] ?? '');
      } catch (e) {
        this.logger?.warn('Failed to parse JSON from code block', { error: e });
      }
    }

    // Try to parse the entire text as JSON
    try {
      return JSON.parse(text);
    } catch {
      // Try to find JSON-like content
      const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch (e) {
          this.logger?.warn('Failed to parse JSON from text', { error: e });
        }
      }
    }

    return null;
  }

  /**
   * Get usage statistics
   */
  async getUsage(): Promise<UsageStats | null> {
    await this.consume();

    const resultMsg = this.messages.findLast((msg): msg is ResultMessage => msg.type === 'result');
    if (!resultMsg?.usage) return null;

    return {
      inputTokens: resultMsg.usage.input_tokens ?? 0,
      outputTokens: resultMsg.usage.output_tokens ?? 0,
      cacheCreationTokens: resultMsg.usage.cache_creation_input_tokens ?? 0,
      cacheReadTokens: resultMsg.usage.cache_read_input_tokens ?? 0,
      totalTokens: (resultMsg.usage.input_tokens ?? 0) + (resultMsg.usage.output_tokens ?? 0),
      totalCost: resultMsg.cost?.total_cost ?? 0
    };
  }

  /**
   * Get the session ID if available
   */
  async getSessionId(): Promise<string | null> {
    await this.consume();

    // Look for session_id on any message (CLI sets this on all messages)
    for (const msg of this.messages) {
      if (msg.session_id) {
        return msg.session_id;
      }

      // Also check system messages with session data
      if (msg.type === 'system' && msg.data?.session_id) {
        return msg.data.session_id;
      }
    }

    return null;
  }

  /**
   * Stream messages with a callback (doesn't consume for other methods)
   */
  async stream(callback: (message: Message) => void | Promise<void>): Promise<void> {
    for await (const message of this.generator) {
      // Run handlers
      for (const handler of this.handlers) {
        try {
          handler(message);
        } catch (error) {
          this.logger?.error('Message handler error', { error });
        }
      }

      // Store message
      this.messages.push(message);

      // Run callback
      await callback(message);
    }

    this.consumed = true;
  }

  /**
   * Wait for completion and return success status
   */
  async succeeded(): Promise<boolean> {
    await this.consume();

    const resultMsg = this.messages.findLast((msg): msg is ResultMessage => msg.type === 'result');
    if (!resultMsg) return false;

    // Check if any tool execution failed
    const executions = await this.asToolExecutions();
    const hasErrors = executions.some(exec => exec.isError);

    return !hasErrors;
  }

  /**
   * Get all error messages
   */
  async getErrors(): Promise<string[]> {
    await this.consume();

    const errors: string[] = [];

    // Check system messages for errors
    for (const msg of this.messages) {
      if (msg.type === 'system' && msg.subtype === 'error') {
        errors.push(msg.data?.message || 'Unknown error');
      }
    }

    // Check tool results for errors
    const executions = await this.asToolExecutions();
    for (const exec of executions) {
      if (exec.isError) {
        errors.push(`Tool ${exec.tool} failed: ${exec.result}`);
      }
    }

    return errors;
  }

  /**
   * Transform messages using a custom transformer
   */
  async transform<T>(transformer: (messages: Message[]) => T): Promise<T> {
    await this.consume();
    return transformer(this.messages);
  }

  /**
   * Consume the generator if not already consumed
   */
  protected async consume(): Promise<void> {
    if (this.consumed) return;

    this.logger?.debug('Consuming message generator');

    for await (const message of this.generator) {
      this.logger?.debug('Received message', { type: message.type });

      // Run handlers
      for (const handler of this.handlers) {
        try {
          handler(message);
        } catch (error) {
          this.logger?.error('Message handler error', { error });
        }
      }

      this.messages.push(message);
    }

    this.consumed = true;
    this.logger?.debug('Message generator consumed', {
      messageCount: this.messages.length
    });
  }
}

/**
 * Represents a tool execution with its input and result
 */
export interface ToolExecution {
  tool: string;
  input: Record<string, unknown>;
  result: any;
  isError: boolean;
}

/**
 * Usage statistics for a query
 */
export interface UsageStats {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  totalCost: number;
}
