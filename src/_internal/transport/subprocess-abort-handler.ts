import { type ExecaChildProcess } from 'execa';

/**
 * Manages proper subprocess cleanup when AbortSignal is triggered.
 * Addresses the Node.js console warning issue and ensures clean termination.
 */
export class SubprocessAbortHandler {
  private cleanupHandler?: () => void;
  private timeoutId?: NodeJS.Timeout;

  constructor(
    private process: ExecaChildProcess,
    private signal?: AbortSignal
  ) {}

  /**
   * Sets up abort handling with proper cleanup.
   * Returns a cleanup function that should be called in finally blocks.
   */
  setup(): () => void {
    if (!this.signal) {
      return () => {};
    }

    // Already-aborted signals are handled by the transport *before* spawn, so
    // by the time we get here the signal should be live. Guard defensively:
    // cancel and let the awaiting consumer observe the AbortError — never throw
    // synchronously from here.
    if (this.signal.aborted) {
      this.process.cancel();
      return () => {};
    }

    // Create abort handler
    this.cleanupHandler = () => {
      // Use execa's cancel method for clean termination
      this.process.cancel();

      // Set a fallback timeout for forceful termination
      this.timeoutId = setTimeout(() => {
        if (!this.process.killed) {
          this.process.kill('SIGKILL');
        }
      }, 5000);
    };

    // Attach abort listener
    this.signal.addEventListener('abort', this.cleanupHandler, { once: true });

    // A process 'error' event (e.g. spawn failure) must NEVER be rethrown from
    // inside this listener: an exception thrown from an EventEmitter callback
    // becomes an uncaughtException and terminates the host process. The real
    // error is delivered through the child's promise, which the transport
    // awaits in receiveMessages(); here we only need to keep the event from
    // going unhandled.
    const errorHandler = (_error: Error) => {
      // Intentionally swallowed — see comment above.
    };
    this.process.on('error', errorHandler);

    // Return cleanup function
    return () => {
      if (this.cleanupHandler) {
        this.signal?.removeEventListener('abort', this.cleanupHandler);
      }
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
      }
      this.process.removeListener('error', errorHandler);
    };
  }

  /**
   * Checks if the process was aborted
   */
  wasAborted(): boolean {
    return this.signal?.aborted ?? false;
  }
}