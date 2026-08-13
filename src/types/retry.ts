/**
 * Retry and backoff interfaces for resilient API calls
 */

// Types for retry functionality

// Retry configuration options
export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxAttempts?: number;
  /** Initial delay in milliseconds */
  initialDelay?: number;
  /** Maximum delay in milliseconds */
  maxDelay?: number;
  /** Backoff multiplier */
  multiplier?: number;
  /** Add random jitter to delays */
  jitter?: boolean;
  /** Jitter factor (0-1) */
  jitterFactor?: number;
  /** List of retryable error classes (e.g. `[RateLimitError, NetworkError]`). */
  // `any[]` args + `abstract new` so concrete classes with typed constructors
  // are assignable (a plain `new (...args: unknown[])` rejects every real class).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  retryableErrors?: Array<abstract new (...args: any[]) => Error>;
  /** Custom retry predicate */
  shouldRetry?: (error: Error, attempt: number) => boolean;
  /** Callback on each retry attempt */
  onRetry?: (attempt: number, error: Error, nextDelay: number) => void | Promise<void>;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
  /** Timeout for individual attempts */
  attemptTimeout?: number;
  /** Total timeout for all attempts */
  totalTimeout?: number;
}

// Retry result with metadata
export interface RetryResult<T> {
  /** The successful result */
  value: T;
  /** Number of attempts made */
  attempts: number;
  /** Total time spent retrying */
  totalDuration: number;
  /** Errors encountered during retries */
  errors: Error[];
}

// Backoff strategy types
export type BackoffStrategy = 
  | 'exponential'
  | 'linear'
  | 'constant'
  | 'fibonacci'
  | 'polynomial';

// Advanced retry configuration
export interface AdvancedRetryOptions extends RetryOptions {
  /** Backoff strategy to use */
  strategy?: BackoffStrategy;
  /** Polynomial degree for polynomial backoff */
  polynomialDegree?: number;
  /** Base for exponential backoff */
  exponentialBase?: number;
  /** Rate limiting */
  rateLimit?: RateLimitOptions;
  /** Circuit breaker integration */
  circuitBreaker?: CircuitBreakerOptions;
}

// Rate limiting options
export interface RateLimitOptions {
  /** Maximum requests per window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Strategy when rate limited */
  strategy: 'delay' | 'drop' | 'queue';
  /** Maximum queue size for 'queue' strategy */
  maxQueueSize?: number;
}

// Circuit breaker options
export interface CircuitBreakerOptions {
  /** Failure threshold to open circuit */
  failureThreshold: number;
  /** Success threshold to close circuit */
  successThreshold?: number;
  /** Timeout before attempting half-open */
  resetTimeout: number;
  /** Requests allowed in half-open state */
  halfOpenLimit?: number;
  /** Callback when circuit opens */
  onOpen?: (failures: number) => void;
  /** Callback when circuit closes */
  onClose?: () => void;
  /** Callback when circuit enters half-open */
  onHalfOpen?: () => void;
}

// Circuit breaker states
export type CircuitState = 'closed' | 'open' | 'half-open';

// Circuit breaker interface
export interface CircuitBreaker {
  /** Current state */
  readonly state: CircuitState;
  /** Execute function with circuit breaker */
  execute<T>(fn: () => Promise<T>): Promise<T>;
  /** Reset the circuit breaker */
  reset(): void;
  /** Get circuit statistics */
  getStats(): CircuitBreakerStats;
}

// Circuit breaker statistics
export interface CircuitBreakerStats {
  /** Current state */
  state: CircuitState;
  /** Total requests */
  totalRequests: number;
  /** Successful requests */
  successfulRequests: number;
  /** Failed requests */
  failedRequests: number;
  /** Consecutive failures */
  consecutiveFailures: number;
  /** Consecutive successes */
  consecutiveSuccesses: number;
  /** Last failure time */
  lastFailureTime?: number;
  /** Last success time */
  lastSuccessTime?: number;
  /** Time circuit opened */
  openedAt?: number;
  /** Next retry time (if open) */
  nextRetryAt?: number;
}

// Retry strategy interface
export interface RetryStrategy {
  /** Calculate next delay */
  calculateDelay(attempt: number, baseDelay: number): number;
  /** Check if should retry */
  shouldRetry(error: Error, attempt: number): boolean;
  /** Reset strategy state */
  reset(): void;
}

// Exponential backoff strategy
export class ExponentialBackoffStrategy implements RetryStrategy {
  constructor(
    private options: {
      multiplier?: number;
      maxDelay?: number;
      jitter?: boolean;
      jitterFactor?: number;
      base?: number;
    } = {}
  ) {}
  
  calculateDelay(attempt: number, baseDelay: number): number {
    const multiplier = this.options.multiplier || 2;
    const base = this.options.base || multiplier;
    const maxDelay = this.options.maxDelay || 60000;
    
    let delay = baseDelay * Math.pow(base, attempt - 1);
    delay = Math.min(delay, maxDelay);
    
    if (this.options.jitter) {
      const jitterFactor = this.options.jitterFactor || 0.1;
      const jitterRange = delay * jitterFactor;
      const jitter = (Math.random() - 0.5) * 2 * jitterRange;
      delay = Math.max(0, delay + jitter);
    }
    
    return Math.round(delay);
  }
  
  shouldRetry(_error: Error, _attempt: number): boolean {
    // Default implementation - let options handle this
    return true;
  }
  
  reset(): void {
    // No state to reset in exponential backoff
  }
}

// Linear backoff strategy
export class LinearBackoffStrategy implements RetryStrategy {
  constructor(
    private options: {
      increment?: number;
      maxDelay?: number;
      jitter?: boolean;
    } = {}
  ) {}
  
  calculateDelay(attempt: number, baseDelay: number): number {
    const increment = this.options.increment || baseDelay;
    const maxDelay = this.options.maxDelay || 60000;
    
    let delay = baseDelay + (increment * (attempt - 1));
    delay = Math.min(delay, maxDelay);
    
    if (this.options.jitter) {
      const jitter = (Math.random() - 0.5) * 0.2 * delay;
      delay = Math.max(0, delay + jitter);
    }
    
    return Math.round(delay);
  }
  
  shouldRetry(_error: Error, _attempt: number): boolean {
    return true;
  }
  
  reset(): void {
    // No state to reset
  }
}

// Fibonacci backoff strategy
export class FibonacciBackoffStrategy implements RetryStrategy {
  private sequence: number[] = [1, 1];
  
  constructor(
    private options: {
      maxDelay?: number;
      jitter?: boolean;
    } = {}
  ) {}
  
  calculateDelay(attempt: number, baseDelay: number): number {
    const maxDelay = this.options.maxDelay || 60000;
    
    // Generate Fibonacci sequence up to attempt
    while (this.sequence.length < attempt) {
      const len = this.sequence.length;
      if (len >= 2) {
        const next = this.sequence[len - 1]! + this.sequence[len - 2]!;
        this.sequence.push(next);
      }
    }
    
    const fibValue = this.sequence[attempt - 1] ?? 1;
    let delay = baseDelay * fibValue;
    delay = Math.min(delay, maxDelay);
    
    if (this.options.jitter) {
      const jitter = (Math.random() - 0.5) * 0.2 * delay;
      delay = Math.max(0, delay + jitter);
    }
    
    return Math.round(delay);
  }
  
  shouldRetry(_error: Error, _attempt: number): boolean {
    return true;
  }
  
  reset(): void {
    this.sequence = [1, 1];
  }
}

// Retry executor interface
export interface RetryExecutor {
  /** Execute function with retry logic */
  execute<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T>;
  /** Execute with detailed result */
  executeWithResult<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<RetryResult<T>>;
  /** Set default options */
  setDefaults(options: RetryOptions): void;
  /** Get statistics */
  getStats(): RetryExecutorStats;
  /** Reset statistics */
  resetStats(): void;
}

// Retry executor statistics
export interface RetryExecutorStats {
  /** Total executions */
  totalExecutions: number;
  /** Successful on first attempt */
  successfulFirstAttempts: number;
  /** Successful after retry */
  successfulRetries: number;
  /** Failed after all retries */
  totalFailures: number;
  /** Total retry attempts */
  totalRetryAttempts: number;
  /** Average attempts per execution */
  averageAttempts: number;
  /** Maximum attempts for any execution */
  maxAttempts: number;
}

// Retry utilities
export class RetryUtils {
  /** Default retryable errors */
  static readonly DEFAULT_RETRYABLE_ERRORS = [
    'NetworkError',
    'TimeoutError',
    'RateLimitError',
    'ServiceUnavailableError'
  ];
  
  /** Check if error is retryable by default */
  static isRetryableError(error: Error): boolean {
    // Check error name
    if (this.DEFAULT_RETRYABLE_ERRORS.includes(error.name)) {
      return true;
    }
    
    // Check error message patterns
    const retryablePatterns = [
      /timeout/i,
      /rate.?limit/i,
      /too.?many.?requests/i,
      /service.?unavailable/i,
      /gateway.?timeout/i,
      /ECONNREFUSED/,
      /ETIMEDOUT/,
      /ENOTFOUND/
    ];
    
    return retryablePatterns.some(pattern => pattern.test(error.message));
  }
  
  /** Sleep for specified milliseconds */
  static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /** Create retry function with defaults */
  static withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
  ): () => Promise<T> {
    return async () => {
      const executor = new SimpleRetryExecutor();
      return executor.execute(fn, options);
    };
  }
}

// Simple retry executor implementation
export class SimpleRetryExecutor implements RetryExecutor {
  private defaults: RetryOptions = {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    multiplier: 2,
    jitter: true
  };
  
  private stats: RetryExecutorStats = {
    totalExecutions: 0,
    successfulFirstAttempts: 0,
    successfulRetries: 0,
    totalFailures: 0,
    totalRetryAttempts: 0,
    averageAttempts: 0,
    maxAttempts: 0
  };
  
  async execute<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T> {
    const result = await this.executeWithResult(fn, options);
    return result.value;
  }
  
  async executeWithResult<T>(
    fn: () => Promise<T>,
    options?: RetryOptions
  ): Promise<RetryResult<T>> {
    const opts = { ...this.defaults, ...options };
    const errors: Error[] = [];
    const startTime = Date.now();
    
    this.stats.totalExecutions++;
    
    for (let attempt = 1; attempt <= (opts.maxAttempts || 3); attempt++) {
      try {
        const value = await fn();
        
        // Success
        if (attempt === 1) {
          this.stats.successfulFirstAttempts++;
        } else {
          this.stats.successfulRetries++;
        }
        
        this.updateStats(attempt);
        
        return {
          value,
          attempts: attempt,
          totalDuration: Date.now() - startTime,
          errors
        };
      } catch (error) {
        errors.push(error as Error);
        
        // Check if should retry
        const shouldRetry = this.shouldRetry(error as Error, attempt, opts);
        
        if (!shouldRetry || attempt === opts.maxAttempts) {
          this.stats.totalFailures++;
          this.updateStats(attempt);
          throw error;
        }
        
        // Calculate delay
        const delay = this.calculateDelay(attempt, opts);
        
        // Call retry callback
        if (opts.onRetry) {
          await opts.onRetry(attempt, error as Error, delay);
        }
        
        // Wait before retry
        await RetryUtils.sleep(delay);
        this.stats.totalRetryAttempts++;
      }
    }
    
    // Should never reach here
    throw errors[errors.length - 1];
  }
  
  setDefaults(options: RetryOptions): void {
    this.defaults = { ...this.defaults, ...options };
  }
  
  getStats(): RetryExecutorStats {
    return { ...this.stats };
  }
  
  resetStats(): void {
    this.stats = {
      totalExecutions: 0,
      successfulFirstAttempts: 0,
      successfulRetries: 0,
      totalFailures: 0,
      totalRetryAttempts: 0,
      averageAttempts: 0,
      maxAttempts: 0
    };
  }
  
  private shouldRetry(error: Error, attempt: number, options: RetryOptions): boolean {
    if (options.shouldRetry) {
      return options.shouldRetry(error, attempt);
    }
    
    if (options.retryableErrors) {
      return options.retryableErrors.some(ErrorClass => error instanceof ErrorClass);
    }
    
    return RetryUtils.isRetryableError(error);
  }
  
  private calculateDelay(attempt: number, options: RetryOptions): number {
    const strategy = new ExponentialBackoffStrategy({
      multiplier: options.multiplier,
      maxDelay: options.maxDelay,
      jitter: options.jitter,
      jitterFactor: options.jitterFactor
    });
    
    return strategy.calculateDelay(attempt, options.initialDelay || 1000);
  }
  
  private updateStats(attempts: number): void {
    this.stats.maxAttempts = Math.max(this.stats.maxAttempts, attempts);
    
    const totalAttempts = this.stats.successfulFirstAttempts + 
                         (this.stats.successfulRetries * 2) + // At least 2 attempts
                         (this.stats.totalFailures * (this.defaults.maxAttempts || 3));
    
    this.stats.averageAttempts = totalAttempts / this.stats.totalExecutions;
  }
}