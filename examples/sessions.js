import { claude } from '@instantlyeasy/claude-code-sdk-ts';

// Example 1: getSessionId()
async function getSessionExample() {
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

// Example 3: withSession()
async function withSessionExample() {
  console.log('\n=== withSession Example ===\n');

  const session = claude().withModel('sonnet').skipPermissions().withSession();

  const parser = session.query('Tell me a random card from the deck');

  const firstCard = await parser.asText();

  const secondCard = await session.query('Which card did you pick?').asText();

  console.log('First card:', firstCard);
  console.log('Second card:', secondCard);
}

// Run all examples
async function main() {
  try {
    await getSessionExample();
    await withSessionIdExample();
    //await withSessionExample();
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
