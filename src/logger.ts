/**
 * Log levels for the logging framework
 */
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4
}

/**
 * Log entry structure
 */
export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: Record<string, unknown>;
  error?: Error;
}

/**
 * Logger interface for pluggable logging
 * 
 * @example
 * ```typescript
 * class CustomLogger implements Logger {
 *   log(entry: LogEntry): void {
 *     // Send to your logging service
 *   }
 * }
 * 
 * const result = await claude()
 *   .withLogger(new CustomLogger())
 *   .query('Hello');
 * ```
 */
export interface Logger {
  /**
   * Log an entry
   */
  log(entry: LogEntry): void;

  /**
   * Convenience methods
   */
  error(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  debug(message: string, context?: Record<string, unknown>): void;
  trace(message: string, context?: Record<string, unknown>): void;
}

/**
 * Console logger implementation
 */
export class ConsoleLogger implements Logger {
  constructor(
    private minLevel: LogLevel = LogLevel.INFO,
    private prefix: string = '[Claude SDK]'
  ) {}

  log(entry: LogEntry): void {
    if (entry.level > this.minLevel) return;

    const timestamp = entry.timestamp.toISOString();
    const level = LogLevel[entry.level];
    const prefix = `${timestamp} ${this.prefix} ${level}`;
    
    const args: unknown[] = [`${prefix}: ${entry.message}`];
    
    if (entry.context && Object.keys(entry.context).length > 0) {
      // Serialize nested objects properly
      args.push(JSON.stringify(entry.context, null, 2));
    }
    
    if (entry.error) {
      args.push(entry.error);
    }

    switch (entry.level) {
      case LogLevel.ERROR:
        // eslint-disable-next-line no-console
        console.error(...args);
        break;
      case LogLevel.WARN:
        // eslint-disable-next-line no-console
        console.warn(...args);
        break;
      case LogLevel.INFO:
        // eslint-disable-next-line no-console
        console.info(...args);
        break;
      case LogLevel.DEBUG:
      case LogLevel.TRACE:
        // eslint-disable-next-line no-console
        console.log(...args);
        break;
    }
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.log({
      level: LogLevel.ERROR,
      message,
      timestamp: new Date(),
      context,
      error: context?.error instanceof Error ? context.error : undefined
    });
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log({
      level: LogLevel.WARN,
      message,
      timestamp: new Date(),
      context
    });
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log({
      level: LogLevel.INFO,
      message,
      timestamp: new Date(),
      context
    });
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log({
      level: LogLevel.DEBUG,
      message,
      timestamp: new Date(),
      context
    });
  }

  trace(message: string, context?: Record<string, unknown>): void {
    this.log({
      level: LogLevel.TRACE,
      message,
      timestamp: new Date(),
      context
    });
  }
}

/**
 * Structured logger that outputs JSON
 */
export class JSONLogger implements Logger {
  constructor(
    private minLevel: LogLevel = LogLevel.INFO,
    // eslint-disable-next-line no-console
    private output: (json: string) => void = console.log
  ) {}

  log(entry: LogEntry): void {
    if (entry.level > this.minLevel) return;

    const logObject = {
      level: LogLevel[entry.level],
      message: entry.message,
      timestamp: entry.timestamp.toISOString(),
      context: entry.context,
      ...(entry.error && {
        error: {
          message: entry.error.message,
          stack: entry.error.stack,
          name: entry.error.name
        }
      })
    };

    this.output(JSON.stringify(logObject));
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.log({
      level: LogLevel.ERROR,
      message,
      timestamp: new Date(),
      context,
      error: context?.error instanceof Error ? context.error : undefined
    });
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log({
      level: LogLevel.WARN,
      message,
      timestamp: new Date(),
      context
    });
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log({
      level: LogLevel.INFO,
      message,
      timestamp: new Date(),
      context
    });
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log({
      level: LogLevel.DEBUG,
      message,
      timestamp: new Date(),
      context
    });
  }

  trace(message: string, context?: Record<string, unknown>): void {
    this.log({
      level: LogLevel.TRACE,
      message,
      timestamp: new Date(),
      context
    });
  }
}

/**
 * Multi-logger that sends logs to multiple loggers
 */
export class MultiLogger implements Logger {
  constructor(private loggers: Logger[]) {}

  log(entry: LogEntry): void {
    for (const logger of this.loggers) {
      try {
        logger.log(entry);
      } catch {
        // Continue to next logger
      }
    }
  }

  error(message: string, context?: Record<string, unknown>): void {
    for (const logger of this.loggers) {
      try {
        logger.error(message, context);
      } catch {
        // Continue to next logger
      }
    }
  }

  warn(message: string, context?: Record<string, unknown>): void {
    for (const logger of this.loggers) {
      try {
        logger.warn(message, context);
      } catch {
        // Continue to next logger
      }
    }
  }

  info(message: string, context?: Record<string, unknown>): void {
    for (const logger of this.loggers) {
      try {
        logger.info(message, context);
      } catch {
        // Continue to next logger
      }
    }
  }

  debug(message: string, context?: Record<string, unknown>): void {
    for (const logger of this.loggers) {
      try {
        logger.debug(message, context);
      } catch {
        // Continue to next logger
      }
    }
  }

  trace(message: string, context?: Record<string, unknown>): void {
    for (const logger of this.loggers) {
      try {
        logger.trace(message, context);
      } catch {
        // Continue to next logger
      }
    }
  }
}

/**
 * Null logger that discards all logs (useful for testing)
 */
export class NullLogger implements Logger {
  log(_entry: LogEntry): void {
    // Discard
  }

  error(_message: string, _context?: Record<string, any>): void {
    // Discard
  }

  warn(_message: string, _context?: Record<string, any>): void {
    // Discard
  }

  info(_message: string, _context?: Record<string, any>): void {
    // Discard
  }

  debug(_message: string, _context?: Record<string, any>): void {
    // Discard
  }

  trace(_message: string, _context?: Record<string, any>): void {
    // Discard
  }
}