import { SubprocessCLITransport } from './transport/subprocess-cli.js';
import type {
  ClaudeCodeOptions,
  Message,
  CLIOutput,
  AssistantMessage,
  UserMessage,
  SystemMessage,
  ResultMessage,
  CLIAssistantOutput,
  CLIUserOutput,
  CLISystemOutput,
  CLIResultOutput,
  CLIErrorOutput
} from '../types.js';
import { detectErrorType, createTypedError } from '../errors.js';
import { loadSafeEnvironmentOptions } from '../environment.js';
import { applyEnvironmentOptions } from './options-merger.js';

export class InternalClient {
  private options: ClaudeCodeOptions;
  private prompt: string;

  constructor(prompt: string, options: ClaudeCodeOptions = {}) {
    this.prompt = prompt;
    
    // Load safe environment variables and merge with user options
    const envOptions = loadSafeEnvironmentOptions();
    this.options = applyEnvironmentOptions(options, envOptions);
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

  private parseMessage(output: CLIOutput): Message | null {
    // Handle CLIOutput types based on actual CLI stream-json output
    switch (output.type) {
      case 'assistant': {
        // Extract the actual assistant message from the wrapper
        const assistantMsg = output as CLIAssistantOutput;
        return {
          type: 'assistant',
          content: assistantMsg.message?.content ?? [],
          session_id: assistantMsg.session_id
        } as AssistantMessage;
      }

      case 'user': {
        // The CLI delivers tool_result blocks inside `user` messages.
        // Surfacing them is what makes asToolExecutions()/findToolResults() work.
        const userMsg = output as CLIUserOutput;
        return {
          type: 'user',
          content: userMsg.message?.content ?? [],
          session_id: userMsg.session_id
        } as UserMessage;
      }

      case 'system': {
        // Surface system/init so getSessionId() and init metadata are reachable.
        const sysMsg = output as CLISystemOutput;
        return {
          type: 'system',
          subtype: sysMsg.subtype,
          session_id: sysMsg.session_id,
          uuid: sysMsg.uuid,
          model: sysMsg.model,
          permissionMode: sysMsg.permissionMode,
          tools: sysMsg.tools,
          mcp_servers: sysMsg.mcp_servers,
          slash_commands: sysMsg.slash_commands,
          apiKeySource: sysMsg.apiKeySource,
          cwd: sysMsg.cwd
        } as SystemMessage;
      }

      case 'result': {
        // Real CLI shape: final text in `result`, cost in top-level `total_cost_usd`.
        const resultMsg = output as CLIResultOutput;
        const text = resultMsg.result ?? '';
        return {
          type: 'result',
          subtype: resultMsg.subtype,
          content: text,
          result: text,
          session_id: resultMsg.session_id,
          is_error: resultMsg.is_error,
          num_turns: resultMsg.num_turns,
          duration_ms: resultMsg.duration_ms,
          duration_api_ms: resultMsg.duration_api_ms,
          total_cost_usd: resultMsg.total_cost_usd,
          usage: resultMsg.usage,
          modelUsage: resultMsg.modelUsage,
          permission_denials: resultMsg.permission_denials,
          // Back-compat: keep the nested cost.total_cost that getUsage() reads.
          cost: {
            total_cost: resultMsg.total_cost_usd
          }
        } as ResultMessage;
      }

      case 'error': {
        // The CLI does not emit `type:"error"` lines on stream-json (failures come
        // via a result error subtype or a nonzero exit + stderr, handled elsewhere),
        // but keep this branch defensively in case a future/though version does.
        const errorOutput = output as CLIErrorOutput;
        const errorMessage = errorOutput.error?.message || 'Unknown error';
        const errorType = detectErrorType(errorMessage);
        throw createTypedError(errorType, errorMessage, errorOutput.error);
      }

      default:
        // Skip unknown message types (schema evolution degrades gracefully).
        return null;
    }
  }
}