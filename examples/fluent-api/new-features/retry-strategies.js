#!/usr/bin/env node

/**
 * Retry Strategies Example
 * 
 * This example demonstrates various retry strategies available in the SDK,
 * including exponential backoff, linear retry, and Fibonacci sequences.
 * 
 * Use cases:
 * - Handling transient network failures
 * - Managing rate limits gracefully
 * - Building resilient API integrations
 */

import { 
  claude,
  createRetryExecutor,
  createExponentialRetryExecutor,
  createLinearRetryExecutor,
  createFibonacciRetryExecutor,
  withRetry
} from '../../../dist/index.js';

async function retryStrategiesExample() {
  console.log('🔄 Retry Strategies Example\n');

  // Example 1: Basic retry with exponential backoff
  console.log('1. Exponential Backoff Retry');
  console.log('----------------------------\n');
  
  const exponentialRetry = createExponentialRetryExecutor({
    maxAttempts: 4,
    initialDelay: 1000,  // Start with 1 second
    multiplier: 2,       // Double the delay each time
    maxDelay: 10000,     // Cap at 10 seconds
    jitter: true         // Add randomization to prevent thundering herd
  });
  
  try {
    let attemptCount = 0;
    
    const result = await exponentialRetry.execute(async () => {
      attemptCount++;
      console.log(`📍 Attempt ${attemptCount}`);
      
      // Simulate failures for first 2 attempts
      if (attemptCount < 3) {
        throw new Error('Simulated transient error');
      }
      
      return await claude()
        .withModel('sonnet')
        .query('Say "Success after retry!"')
        .asText();
    }, {
      onRetry: (attempt, error, nextDelay) => {
        console.log(`⏳ Retry ${attempt} in ${nextDelay}ms after: ${error.message}`);
      }
    });
    
    console.log('✅ Result:', result);
    console.log('📊 Stats:', exponentialRetry.getStats());
    
  } catch (error) {
    console.log('❌ Failed after all retries:', error.message);
  }

  // Example 2: Linear retry for predictable delays
  console.log('\n\n2. Linear Retry Strategy');
  console.log('------------------------\n');
  
  const linearRetry = createLinearRetryExecutor({
    maxAttempts: 3,
    delay: 2000,  // Fixed 2 second delay between attempts
    jitter: false // No randomization
  });
  
  try {
    const startTime = Date.now();
    
    const result = await linearRetry.execute(async () => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      console.log(`📍 Attempting at T+${elapsed}s`);
      
      // Succeed on second attempt
      if (linearRetry.getStats().totalAttempts > 1) {
        return 'Linear retry success!';
      }
      
      throw new Error('Need one more try');
    });
    
    console.log('✅ Result:', result);
    
  } catch (error) {
    console.log('❌ Linear retry failed:', error.message);
  }

  // Example 3: Fibonacci retry for gradual backoff
  console.log('\n\n3. Fibonacci Retry Strategy');
  console.log('---------------------------\n');
  
  const fibonacciRetry = createFibonacciRetryExecutor({
    maxAttempts: 5,
    initialDelay: 1000,  // 1 second
    maxDelay: 8000      // Cap at 8 seconds
  });
  
  console.log('Fibonacci sequence delays: 1s, 1s, 2s, 3s, 5s...\n');
  
  try {
    let previousDelay = 0;
    
    await fibonacciRetry.execute(async () => {
      throw new Error('Always fail to show sequence');
    }, {
      onRetry: (attempt, error, nextDelay) => {
        const sequence = attempt === 1 ? 1 : previousDelay;
        console.log(`🔢 Fibonacci attempt ${attempt}: waiting ${nextDelay}ms`);
        previousDelay = nextDelay;
      }
    });
    
  } catch (error) {
    console.log('✅ Fibonacci sequence demonstrated');
  }

  // Example 4: Using withRetry helper function
  console.log('\n\n4. WithRetry Helper Function');
  console.log('----------------------------\n');
  
  try {
    // withRetry(fn, opts) returns a wrapper function — call it to run.
    const runWithRetry = withRetry(
      async () => {
        return await claude()
          .withModel('sonnet')
          .query('Write a haiku about persistence')
          .asText();
      },
      {
        maxAttempts: 3,
        initialDelay: 500,
        shouldRetry: (error, attempt) => {
          // Custom retry logic - only retry on specific errors
          const retryableErrors = ['network_error', 'timeout_error', 'rate_limit_error'];
          const errorType = error.type || 'unknown';

          console.log(`🤔 Checking if should retry: ${errorType}`);
          return retryableErrors.includes(errorType) && attempt < 3;
        }
      }
    );
    const result = await runWithRetry();
    
    console.log('✅ Result with retry helper:');
    console.log(result);
    
  } catch (error) {
    console.log('❌ WithRetry failed:', error.message);
  }

  // Example 5: Advanced retry with circuit breaker pattern
  console.log('\n\n5. Circuit Breaker Pattern');
  console.log('--------------------------\n');
  
  class CircuitBreaker {
    constructor(retryExecutor, options = {}) {
      this.retryExecutor = retryExecutor;
      this.failureThreshold = options.failureThreshold || 3;
      this.resetTimeout = options.resetTimeout || 30000; // 30 seconds
      this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
      this.failures = 0;
      this.lastFailureTime = null;
    }
    
    async execute(fn) {
      // Check if circuit should be reset
      if (this.state === 'OPEN' && 
          Date.now() - this.lastFailureTime > this.resetTimeout) {
        console.log('🔄 Circuit breaker: Moving to HALF_OPEN');
        this.state = 'HALF_OPEN';
      }
      
      // If circuit is open, fail fast
      if (this.state === 'OPEN') {
        throw new Error('Circuit breaker is OPEN - failing fast');
      }
      
      try {
        const result = await this.retryExecutor.execute(fn);
        
        // Success - reset the circuit
        if (this.state === 'HALF_OPEN') {
          console.log('✅ Circuit breaker: Success in HALF_OPEN, closing circuit');
          this.state = 'CLOSED';
          this.failures = 0;
        }
        
        return result;
        
      } catch (error) {
        this.failures++;
        this.lastFailureTime = Date.now();
        
        if (this.failures >= this.failureThreshold) {
          console.log('🚫 Circuit breaker: Opening circuit after', this.failures, 'failures');
          this.state = 'OPEN';
        }
        
        throw error;
      }
    }
    
    getState() {
      return {
        state: this.state,
        failures: this.failures,
        lastFailureTime: this.lastFailureTime
      };
    }
  }
  
  // Create circuit breaker with exponential retry
  const breaker = new CircuitBreaker(
    createExponentialRetryExecutor({ maxAttempts: 2, initialDelay: 1000 }),
    { failureThreshold: 2, resetTimeout: 5000 }
  );
  
  // Simulate multiple failures to open the circuit
  for (let i = 0; i < 4; i++) {
    try {
      await breaker.execute(async () => {
        throw new Error('Service unavailable');
      });
    } catch (error) {
      console.log(`❌ Request ${i + 1} failed:`, error.message);
      console.log('   Circuit state:', breaker.getState().state);
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n⏳ Waiting for circuit reset timeout...');
  await new Promise(resolve => setTimeout(resolve, 5500));
  
  // Try again after reset
  try {
    await breaker.execute(async () => {
      console.log('✅ Service recovered!');
      return 'Success after circuit reset';
    });
  } catch (error) {
    console.log('❌ Still failing:', error.message);
  }

  // Example 6: Retry with telemetry
  console.log('\n\n6. Retry with Telemetry');
  console.log('-----------------------\n');
  
  const telemetryRetry = createRetryExecutor({
    maxAttempts: 3,
    initialDelay: 1000
  });
  
  // Track retry metrics
  const metrics = {
    attempts: [],
    totalDuration: 0,
    finalStatus: null
  };
  
  const startTime = Date.now();
  
  try {
    await telemetryRetry.execute(
      async () => {
        const attemptStart = Date.now();
        const attemptNumber = metrics.attempts.length + 1;
        
        try {
          // Simulate work
          await new Promise(resolve => setTimeout(resolve, 200));
          
          if (attemptNumber < 2) {
            throw new Error('Simulated failure');
          }
          
          return 'Success with telemetry';
          
        } finally {
          metrics.attempts.push({
            number: attemptNumber,
            duration: Date.now() - attemptStart,
            timestamp: new Date().toISOString()
          });
        }
      },
      {
        onRetry: (attempt, error, delay) => {
          console.log(`📈 Telemetry: Retry ${attempt}, delay ${delay}ms`);
        }
      }
    );
    
    metrics.finalStatus = 'success';
    
  } catch (error) {
    metrics.finalStatus = 'failure';
  }
  
  metrics.totalDuration = Date.now() - startTime;
  
  console.log('\n📊 Retry Telemetry Report:');
  console.log('- Total attempts:', metrics.attempts.length);
  console.log('- Total duration:', metrics.totalDuration, 'ms');
  console.log('- Final status:', metrics.finalStatus);
  console.log('- Attempt details:');
  metrics.attempts.forEach(attempt => {
    console.log(`  - Attempt ${attempt.number}: ${attempt.duration}ms`);
  });

  console.log('\n✨ Retry strategies examples completed!');
}

// Error handling wrapper
retryStrategiesExample().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});