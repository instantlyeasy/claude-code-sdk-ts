/**
 * Environment option types loaded from the process environment.
 */

export interface SafeEnvironmentOptions {
  debug?: boolean;
  verbose?: boolean;
  logLevel?: number;
  nodeEnv?: string;
}