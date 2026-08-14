import { claude } from '@instantlyeasy/claude-code-sdk-ts/v1';

/**
 * Hello World Example — v1 API (official Agent SDK backend)
 *
 * The simplest usage of the v1 fluent API. The Claude Code CLI is bundled by
 * the official SDK — no separate install needed. Auth is still handled by the
 * CLI (`claude login` or ANTHROPIC_API_KEY).
 *
 * Run from a fresh clone: npm install && npm run build, then
 *   node examples/v1/hello-world.js
 */

async function main() {
  try {
    // 1. Simple query
    console.log('1. Basic Query Example');
    console.log('---------------------\n');

    const result = await claude()
      .query('Say hello!')
      .asText();

    console.log('Response:', result);
  } catch (error) {
    console.error('Error in basic query:', error.message);
  }

  try {
    // 2. Model selection
    console.log('\n\n2. Model Selection Example');
    console.log('--------------------------\n');

    const sonnetResult = await claude()
      .withModel('sonnet')
      .query('Write a haiku about programming')
      .asText();

    console.log('Haiku with Sonnet model:');
    console.log(sonnetResult);
  } catch (error) {
    console.error('Error with model selection:', error.message);
  }

  try {
    // 3. REAL token streaming — v1 yields the model's actual incremental
    // tokens (stream_event deltas), not re-chunked complete messages.
    console.log('\n\n3. Real Token Streaming');
    console.log('-----------------------\n');

    for await (const token of claude()
      .withModel('sonnet')
      .streamText('Count from 1 to 5 slowly, one number per line')) {
      process.stdout.write(token);
    }

    console.log('\n\n✅ Streaming completed!');
  } catch (error) {
    console.error('Error in streaming:', error.message);
  }

  console.log('\n✨ All examples completed!');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
