/**
 * Adapter: official Agent SDK `SDKMessage` → this package's classic `Message`.
 *
 * The whole point of the v1 rebuild is that the official SDK owns the wire
 * protocol, so every parsing bug in the 0.3.x/0.4.x subprocess transport simply
 * cannot exist here. We map the official message stream onto the existing
 * `Message` shape so the battle-tested `ResponseParser` keeps working unchanged.
 *
 * The official message types are large and evolving; we narrow structurally by
 * `type` and read only the fields we surface, ignoring the rest (so new message
 * variants degrade gracefully rather than breaking the adapter).
 */
import type { Message, ContentBlock } from '../types.js';

/** Minimal structural view of an official SDKMessage (we only read by `type`). */
export interface OfficialMessageLike {
  type: string;
  session_id?: string;
  subtype?: string;
  message?: { content?: unknown };
  result?: string;
  is_error?: boolean;
  num_turns?: number;
  duration_ms?: number;
  total_cost_usd?: number;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
  modelUsage?: Record<string, unknown>;
  permission_denials?: Array<{ tool_name: string; tool_use_id: string; tool_input: Record<string, unknown> }>;
  model?: string;
  permissionMode?: string;
  tools?: string[];
  [key: string]: unknown;
}

/**
 * Convert one official message to a classic `Message`, or `null` for message
 * variants that have no classic equivalent (stream_event, task_*, hooks, etc.).
 */
export function adaptOfficialMessage(msg: OfficialMessageLike): Message | null {
  switch (msg.type) {
    case 'assistant':
      return {
        type: 'assistant',
        content: (msg.message?.content as ContentBlock[]) ?? [],
        session_id: msg.session_id
      };

    case 'user':
      // Tool results arrive here as content blocks — surfaced so the parser's
      // asToolExecutions()/findToolResult() work end-to-end.
      return {
        type: 'user',
        content: (msg.message?.content as ContentBlock[]) ?? [],
        session_id: msg.session_id
      };

    case 'system':
      return {
        type: 'system',
        subtype: msg.subtype,
        session_id: msg.session_id,
        model: msg.model,
        permissionMode: msg.permissionMode,
        tools: msg.tools
      };

    case 'result': {
      const text = msg.result ?? '';
      return {
        type: 'result',
        subtype: msg.subtype,
        content: text,
        result: text,
        session_id: msg.session_id,
        is_error: msg.is_error,
        num_turns: msg.num_turns,
        duration_ms: msg.duration_ms,
        total_cost_usd: msg.total_cost_usd,
        usage: msg.usage,
        modelUsage: msg.modelUsage,
        permission_denials: msg.permission_denials,
        // Back-compat: keep the nested cost.total_cost the parser's getUsage() reads.
        cost: { total_cost: msg.total_cost_usd }
      };
    }

    default:
      // stream_event, task_*, hook_*, rate_limit, etc. — not part of the classic
      // Message surface yet. (Exposing them is tracked in V1_STATUS.md.)
      return null;
  }
}
