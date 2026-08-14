import { claude, createSdkMcpServer, tool } from '@instantlyeasy/claude-code-sdk-ts/v1';
import { z } from 'zod';

/**
 * Custom Tools Example — v1 only
 *
 * Define tools as plain functions running INSIDE your process (in-process MCP
 * server). No separate server binary, no stdio config. This capability did not
 * exist in the classic API — it comes from the official Agent SDK backend.
 */

// A tiny in-process server with two tools.
const utilities = createSdkMcpServer({
  name: 'utils',
  tools: [
    tool(
      'get_weather',
      'Get the current weather for a city (demo data)',
      { city: z.string() },
      async ({ city }) => ({
        content: [{ type: 'text', text: `Weather in ${city}: 22°C, partly cloudy (demo)` }]
      })
    ),
    tool(
      'lookup_order',
      'Look up an order by id in the local database (demo data)',
      { orderId: z.string(), includeItems: z.boolean().optional() },
      async ({ orderId, includeItems }) => {
        const order = { id: orderId, status: 'shipped', items: includeItems ? ['widget', 'gadget'] : undefined };
        return { content: [{ type: 'text', text: JSON.stringify(order) }] };
      }
    )
  ]
});

const answer = await claude()
  .withModel('sonnet')
  .withMCPServer(utilities)
  .allowTools('mcp__utils__get_weather', 'mcp__utils__lookup_order')
  .query('What is the weather in Paris, and what is the status of order A-123?')
  .asText();

console.log(answer);

// The tool calls and their results are also inspectable on the parser:
const parser = claude()
  .withMCPServer(utilities)
  .allowTools('mcp__utils__get_weather')
  .query('Check the weather in Tokyo using the tool.');

await parser.asText();
const executions = await parser.asToolExecutions();
for (const exec of executions) {
  console.log(`Tool ${exec.tool} -> ${JSON.stringify(exec.result).slice(0, 80)}`);
}
