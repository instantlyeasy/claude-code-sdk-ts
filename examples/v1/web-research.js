import { claude } from '@instantlyeasy/claude-code-sdk-ts/v1';

/**
 * Web Research Example — v1 API
 *
 * v1 upgrades over the classic version:
 * - Section 4 uses REAL structured outputs (.withOutputFormat + .asStructured)
 *   instead of asking the model to format markdown.
 * - Section 5's follow-up questions use real session resume — the conversation
 *   continues server-side instead of re-sending concatenated history.
 */

// 1. Simple research query
console.log('1. Basic research:');
const basicResearch = await claude()
  .withModel('sonnet')
  .query('What are the latest features in TypeScript 5.0?')
  .asText();

console.log(basicResearch);

// 2. Comparative analysis
console.log('\n2. Comparative analysis:');
const comparison = await claude()
  .withModel('opus')
  .withSignal(AbortSignal.timeout(60_000))
  .query(`Compare and contrast these JavaScript frameworks:
    - React
    - Vue
    - Angular
    - Svelte

    Focus on:
    1. Performance characteristics
    2. Learning curve
    3. Ecosystem and community
    4. Best use cases`)
  .asText();

console.log(comparison);

// 3. Technical deep dive with real token streaming
console.log('\n3. Technical deep dive (streamed):');
for await (const token of claude()
  .withModel('opus')
  .streamText(`Research and explain JavaScript Promises vs Async/Await:
    1. Provide a comprehensive explanation
    2. Show practical code examples
    3. Include error handling patterns`)) {
  process.stdout.write(token);
}

// 4. REAL structured output — typed JSON, not formatted markdown
console.log('\n\n4. Structured research output:');
const report = await claude()
  .withModel('sonnet')
  .withOutputFormat({
    type: 'object',
    properties: {
      overview: { type: 'string' },
      keyBenefits: { type: 'array', items: { type: 'string' } },
      useCases: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            example: { type: 'string' }
          },
          required: ['name', 'example']
        }
      },
      gettingStarted: { type: 'array', items: { type: 'string' } }
    },
    required: ['overview', 'keyBenefits', 'useCases', 'gettingStarted']
  })
  .query('Research WebAssembly (WASM) and provide a structured report')
  .asStructured();

if (report) {
  console.log('Overview:', report.overview);
  console.log('Key benefits:', report.keyBenefits.join(' · '));
  console.log(`Use cases: ${report.useCases.map(u => u.name).join(', ')}`);
  console.log('Getting started steps:', report.gettingStarted.length);
}

// 5. Follow-up questions via REAL session resume (no history re-sending)
console.log('\n5. Interactive research with session resume:');

const first = claude().withModel('opus').query('What is GraphQL?');
console.log('Q: What is GraphQL?');
console.log('A:', await first.asText());
const sessionId = await first.getSessionId();

const q2 = await claude()
  .resume(sessionId)                          // same conversation, server-side
  .query('How does it compare to REST?')
  .asText();
console.log('\nQ: How does it compare to REST?');
console.log('A:', q2);

const q3 = await claude()
  .resume(sessionId)
  .query('Show me a simple GraphQL schema example')
  .asText();
console.log('\nQ: Show me a simple GraphQL schema example');
console.log('A:', q3);

// 6. Research with tool assistance
console.log('\n6. Research with documentation lookup:');
const docsResearch = await claude()
  .withModel('opus')
  .allowTools('Read', 'Grep', 'WebFetch')
  .query(`Research the Claude Code SDK by:
    1. Looking at the README.md file
    2. Examining the type definitions
    3. Providing a comprehensive guide on using the Fluent API
    4. Include real code examples from the codebase`)
  .asText();

console.log(docsResearch);

// 7. Research project with artifact creation
console.log('\n7. Creating research artifacts:');
const researchProject = await claude()
  .withModel('opus')
  .allowTools('Write', 'Edit')
  .acceptEdits()
  .withSignal(AbortSignal.timeout(90_000))
  .onPreToolUse(async (input) => {
    if ('tool_name' in input && 'tool_input' in input) {
      console.log(`  Creating: ${input.tool_input?.file_path || input.tool_name}`);
    }
    return {};
  })
  .query(`Create a comprehensive research document about "Modern State Management in React":
    1. Research current state management solutions
    2. Create a markdown file "state-management-guide.md" with:
       - Overview of each solution
       - Pros and cons
       - Code examples
       - Decision matrix
    3. Create example implementations for the top 3 solutions`)
  .asText();

console.log(researchProject);
