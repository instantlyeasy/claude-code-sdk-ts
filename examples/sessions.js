import { claude, query } from '@instantlyeasy/claude-code-sdk-ts';

// Example 1: getSessionId()
async function getSessionIdExample() {
  console.log('=== getSessionId Example ===\n');

  const parser = claude().withModel('sonnet').skipPermissions().query('Say hello in 3 different languages');

  const sessionId = await parser.getSessionId();

  console.log('Session ID:', sessionId);
}

// Example 2: withSessionId()
async function withSessionIdExample() {
  console.log('=== withSessionId Example ===\n');

  const queryBuilder = claude().withModel('sonnet').skipPermissions();

  const parser = queryBuilder.query('Tell me a number between 100 and 1000');

  const sessionId = await parser.getSessionId();

  const firstNumber = await parser.asText();

  const secondNumber = await queryBuilder.withSessionId(sessionId).query('Which number did you pick?').asText();

  console.log('First number:', firstNumber);
  console.log('Second number:', secondNumber);
}

// Example 3: Classic API with sessionId option
async function classicAPIExample() {
  console.log('\n=== Classic API with sessionId Example ===\n');

  // Step 1: Start a conversation using classic API to establish a session
  console.log('Step 1: Starting initial conversation with classic API...');

  let sessionId = null;
  let firstResponse = '';

  const initialOptions = {
    model: 'sonnet',
    permissionMode: 'bypassPermissions'
  };

  for await (const message of query(
    'Pick a completely random card from a standard deck of 52 playing cards',
    initialOptions
  )) {
    // Extract session ID from any message that has it
    if (message.session_id) {
      sessionId = message.session_id;
    }

    if (message.type === 'assistant') {
      for (const block of message.content) {
        if (block.type === 'text') {
          firstResponse += block.text;
        }
      }
    }
  }

  console.log('First response:', firstResponse);
  console.log('Extracted session ID:', sessionId);

  // Step 2: Continue the conversation using the extracted session ID
  if (sessionId) {
    console.log('\nStep 2: Continuing conversation with session ID...');

    const continueOptions = {
      sessionId: sessionId,
      model: 'sonnet',
      permissionMode: 'bypassPermissions'
    };

    let secondResponse = '';

    for await (const message of query('Which card did you pick?', continueOptions)) {
      if (message.type === 'assistant') {
        for (const block of message.content) {
          if (block.type === 'text') {
            secondResponse += block.text;
          }
        }
      }
    }

    console.log('Second response:', secondResponse);
    console.log('\n✅ Classic API session management working properly!');
  } else {
    console.log('❌ Could not extract session ID from first conversation.');
  }
}

// Run all examples
async function main() {
  try {
    await getSessionIdExample();
    await withSessionIdExample();
    await classicAPIExample();
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
