import { claude } from '@instantlyeasy/claude-code-sdk-ts/v1';

/**
 * Error Handling Example — v1 API
 *
 * v1 upgrades over the classic version:
 * - Fallback models are NATIVE (.withFallbackModel) — no manual model loop.
 * - Timeouts use AbortSignal.timeout(); an expired signal surfaces as an abort.
 * - succeeded()/getErrors() actually reflect the run outcome.
 * - Permission denials are observable on the result (permission_denials) and
 *   controllable up-front via canUseTool.
 */

async function errorHandlingExamples() {
  // 1. Timeout via AbortSignal (v1 has no withTimeout)
  console.log('1. Timeout with AbortSignal');
  console.log('---------------------------\n');

  // Check the signal itself to distinguish a timeout from other failures —
  // robust regardless of which error class the backend throws.
  const timeoutSignal = AbortSignal.timeout(5_000); // short timeout for demonstration
  try {
    const result = await claude()
      .withSignal(timeoutSignal)
      .query('Write a very long detailed essay about quantum computing')
      .asText();

    console.log('Success:', result.substring(0, 100) + '...');
  } catch (error) {
    if (timeoutSignal.aborted) {
      console.error('❌ Timed out (signal aborted)');
    } else {
      console.error('❌ Error occurred:', error.message);
    }
  }

  // 2. Failures as data — the official SDK backend reports most failures on
  // the RESULT (subtype / is_error), not as thrown transport errors. Inspect
  // the run outcome via the parser; keep a generic catch for hard failures.
  console.log('\n\n2. Failures as Data (result inspection)');
  console.log('---------------------------------------\n');

  try {
    const parser = claude()
      .withModel('invalid-model-xyz')
      .query('Test query');
    const ok = await parser.succeeded();
    if (!ok) {
      console.error('❌ Run did not succeed. Details:', (await parser.getErrors()).join('; ') || '(none reported)');
    } else {
      console.log('✅ Unexpectedly succeeded:', await parser.asResult());
    }
  } catch (error) {
    console.error('❌ Hard failure:', error.name, '-', error.message);
  }

  // 3. Graceful degradation — native fallback models (was a manual loop)
  console.log('\n\n3. Native Fallback Models');
  console.log('-------------------------\n');

  try {
    const result = await claude()
      .withModel('opus')
      .withFallbackModel('sonnet') // automatic fallback, no retry loop needed
      .query('What is 2+2?')
      .asText();
    console.log('✅ Success (with automatic fallback if opus was unavailable):', result);
  } catch (error) {
    console.error('❌ All models failed:', error.message);
  }

  // 4. Simple retry with exponential backoff (manual pattern)
  console.log('\n\n4. Retry with Exponential Backoff');
  console.log('---------------------------------\n');

  async function queryWithRetry(prompt, maxRetries = 3) {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Attempt ${attempt}/${maxRetries}...`);
        return await claude().withModel('sonnet').query(prompt).asText();
      } catch (error) {
        lastError = error;
        console.error(`❌ Attempt ${attempt} failed:`, error.message);
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt - 1) * 1000;
          console.log(`⏳ Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    throw lastError;
  }

  try {
    const result = await queryWithRetry('Say hello!');
    console.log('✅ Success after retry:', result);
  } catch (error) {
    console.error('❌ Failed after all retries:', error.message);
  }

  // 5. Run outcome: succeeded() and getErrors() reflect the real result
  console.log('\n\n5. Run Outcome Inspection');
  console.log('-------------------------\n');

  try {
    const parser = claude()
      .withModel('sonnet')
      .withMaxTurns(1)
      .query('Count from 1 to 3');
    const ok = await parser.succeeded();
    const errors = await parser.getErrors();
    console.log(`✅ Completed. succeeded=${ok}, errors=[${errors.join('; ')}]`);
  } catch (error) {
    console.error('❌ Query error:', error.message);
  }

  // 6. Tool permissions: deny up-front with canUseTool and observe denials
  console.log('\n\n6. Tool Permission Handling');
  console.log('---------------------------\n');

  try {
    const parser = claude()
      .allowTools('Read')
      .canUseTool(async (toolName) => {
        if (toolName === 'Write' || toolName === 'Edit' || toolName === 'Bash') {
          return { behavior: 'deny', message: `${toolName} is not allowed in this example` };
        }
        return { behavior: 'allow' };
      })
      .query('Create a new file called test.txt with the content "Hello World"');

    const result = await parser.asResult();
    const errors = await parser.getErrors();
    console.log('Result:', result);
    if (errors.length) console.log('Denials/errors observed:', errors);
  } catch (error) {
    console.error('❌ Tool permission error:', error.message);
  }

  // 7. Cancellation with a manual AbortController
  console.log('\n\n7. Manual Cancellation');
  console.log('----------------------\n');

  const controller = new AbortController();
  setTimeout(() => controller.abort(), 2_000); // cancel after 2s

  try {
    const result = await claude()
      .withSignal(controller.signal)
      .query('Write a haiku')
      .asText();
    console.log('✅ Query completed:', result);
  } catch (error) {
    console.error('❌ Query cancelled/errored:', error.message);
  }

  console.log('\n✨ Error handling examples completed!');
}

errorHandlingExamples().catch(error => {
  console.error('\n💥 Unhandled error:', error);
  process.exit(1);
});
