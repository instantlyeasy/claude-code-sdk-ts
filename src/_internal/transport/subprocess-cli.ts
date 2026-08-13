import { execa, type ExecaChildProcess } from 'execa';
import which from 'which';
import { createInterface } from 'node:readline';
import { platform } from 'node:os';
import { join } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { access, constants, writeFile, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { CLIConnectionError, CLINotFoundError, ProcessError, CLIJSONDecodeError, AbortError } from '../../errors.js';
import { TimeoutError } from '../../types/enhanced-errors.js';
import type { ClaudeCodeOptions, CLIOutput, MCPServer } from '../../types.js';
import { SubprocessAbortHandler } from './subprocess-abort-handler.js';

/**
 * Permission modes the installed CLI accepts via `--permission-mode`.
 * `default` is intentionally excluded — the CLI has no `default` choice; it is
 * the implicit behaviour when no flag is passed. `bypassPermissions` is handled
 * separately via `--dangerously-skip-permissions`.
 */
const CLI_PERMISSION_MODES = new Set(['acceptEdits', 'auto', 'manual', 'dontAsk', 'plan']);

/**
 * Options that the SDK historically translated into CLI flags that never
 * existed. Setting any of them used to abort the entire query with an opaque
 * error. We now warn once and ignore them. (Full removal is planned for 0.4.0.)
 */
const UNSUPPORTED_OPTIONS = ['temperature', 'maxTokens', 'context', 'role', 'configFile', 'mcpServerPermissions'] as const;
const warnedUnsupported = new Set<string>();

function warnUnsupportedOnce(name: string): void {
  if (warnedUnsupported.has(name)) return;
  warnedUnsupported.add(name);
  // eslint-disable-next-line no-console
  console.warn(
    `[claude-code-sdk-ts] Option "${name}" is not supported by the installed claude CLI and is ignored. ` +
      `This option will be removed in 0.4.0.`
  );
}

/**
 * Reject option values that would be reinterpreted by the CLI as a standalone
 * flag (argument injection). A leading "-" is the tell; legitimate models,
 * session IDs and directories never start with one.
 */
function assertNoArgInjection(value: string, optionName: string): void {
  if (value.startsWith('-')) {
    throw new CLIConnectionError(
      `Refusing to pass option "${optionName}" with a value that begins with "-" ` +
        `(would be parsed by the CLI as a flag): ${JSON.stringify(value)}`
    );
  }
}

export class SubprocessCLITransport {
  private process?: ExecaChildProcess;
  private options: ClaudeCodeOptions;
  private prompt: string;
  private abortHandler?: SubprocessAbortHandler;
  private cleanupAbort?: () => void;
  private mcpConfigPath?: string;
  private stderrBuffer: string[] = [];
  private static readonly STDERR_BUFFER_MAX = 40;

  constructor(prompt: string, options: ClaudeCodeOptions = {}) {
    this.prompt = prompt;
    this.options = options;
  }

  private get debugEnabled(): boolean {
    return this.options.debug === true;
  }

  private async findCLI(): Promise<string> {
    // First check for local Claude installation (newer version with --output-format support)
    const localPaths = [
      join(homedir(), '.claude', 'local', 'claude'),
      join(homedir(), '.claude', 'bin', 'claude')
    ];

    for (const path of localPaths) {
      try {
        await access(path, constants.X_OK);
        return path;
      } catch {
        // Continue checking
      }
    }

    // Then try to find in PATH - try both 'claude' and 'claude-code' for compatibility
    try {
      return await which('claude');
    } catch {
      // Try the alternative name
      try {
        return await which('claude-code');
      } catch {
        // Not found in PATH, continue to check other locations
      }
    }

    // Common installation paths to check
    const paths: string[] = [];
    const isWindows = platform() === 'win32';
    const home = homedir();

    if (isWindows) {
      paths.push(
        join(home, 'AppData', 'Local', 'Programs', 'claude', 'claude.exe'),
        join(home, 'AppData', 'Local', 'Programs', 'claude-code', 'claude-code.exe'),
        'C:\\Program Files\\claude\\claude.exe',
        'C:\\Program Files\\claude-code\\claude-code.exe'
      );
    } else {
      paths.push(
        '/usr/local/bin/claude',
        '/usr/local/bin/claude-code',
        '/usr/bin/claude',
        '/usr/bin/claude-code',
        '/opt/homebrew/bin/claude',
        '/opt/homebrew/bin/claude-code',
        join(home, '.local', 'bin', 'claude'),
        join(home, '.local', 'bin', 'claude-code'),
        join(home, 'bin', 'claude'),
        join(home, 'bin', 'claude-code'),
        join(home, '.claude', 'local', 'claude')  // Claude's custom installation path
      );
    }

    // Try global npm/yarn paths
    try {
      const { stdout: npmPrefix } = await execa('npm', ['config', 'get', 'prefix']);
      if (npmPrefix) {
        paths.push(
          join(npmPrefix.trim(), 'bin', 'claude'),
          join(npmPrefix.trim(), 'bin', 'claude-code')
        );
      }
    } catch {
      // Ignore error and continue
    }

    // Check each path
    for (const path of paths) {
      try {
        await access(path, constants.X_OK);
        return path;
      } catch {
        // Ignore error and continue
      }
    }

    throw new CLINotFoundError();
  }

  /**
   * Build the name-keyed MCP config the CLI expects and write it to a 0600 temp
   * file, returning its path. Passing a file (not an inline JSON argv element)
   * keeps MCP server `env` secrets off the world-readable process command line.
   */
  private async writeMcpConfig(servers: MCPServer[]): Promise<string> {
    const mcpServers: Record<string, { command: string; args?: string[]; env?: Record<string, string> }> = {};
    servers.forEach((server, index) => {
      const key = server.name ?? `server${index}`;
      mcpServers[key] = { command: server.command, args: server.args, env: server.env };
    });
    const path = join(tmpdir(), `claude-sdk-mcp-${randomUUID()}.json`);
    await writeFile(path, JSON.stringify({ mcpServers }), { mode: 0o600 });
    return path;
  }

  private buildCommand(): string[] {
    const args: string[] = ['--output-format', 'stream-json', '--verbose'];

    if (this.options.model) {
      assertNoArgInjection(this.options.model, 'model');
      args.push('--model', this.options.model);
    }

    // Session resumption
    if (this.options.sessionId) {
      assertNoArgInjection(this.options.sessionId, 'sessionId');
      args.push('--resume', this.options.sessionId);
    }

    // Allowed / disallowed tools (CLI accepts a comma-separated list).
    if (this.options.allowedTools && this.options.allowedTools.length > 0) {
      args.push('--allowedTools', this.options.allowedTools.join(','));
    }
    if (this.options.deniedTools && this.options.deniedTools.length > 0) {
      args.push('--disallowedTools', this.options.deniedTools.join(','));
    }

    // Permission mode. `bypassPermissions` maps to the dedicated flag; the other
    // real modes map to `--permission-mode`; `default` emits nothing.
    const mode = this.options.permissionMode;
    if (mode === 'bypassPermissions') {
      args.push('--dangerously-skip-permissions');
    } else if (mode && mode !== 'default' && CLI_PERMISSION_MODES.has(mode)) {
      args.push('--permission-mode', mode);
    }

    // System prompt: append to the CLI's default (matches the previous
    // prompt-prepending behaviour, but via the real flag with correct semantics).
    if (this.options.systemPrompt) {
      args.push('--append-system-prompt', this.options.systemPrompt);
    }

    // MCP config path (prepared in connect(); see writeMcpConfig).
    if (this.mcpConfigPath) {
      args.push('--mcp-config', this.mcpConfigPath);
    }

    // Additional directories: --add-dir is variadic — one argv token per path.
    if (this.options.addDirectories && this.options.addDirectories.length > 0) {
      for (const dir of this.options.addDirectories) {
        assertNoArgInjection(dir, 'addDirectories');
      }
      args.push('--add-dir', ...this.options.addDirectories);
    }

    // Warn (once) about options that the installed CLI does not support instead
    // of emitting nonexistent flags that abort the whole query.
    for (const name of UNSUPPORTED_OPTIONS) {
      const value = (this.options as Record<string, unknown>)[name];
      const isSet =
        value !== undefined &&
        !(Array.isArray(value) && value.length === 0) &&
        !(typeof value === 'object' && value !== null && !Array.isArray(value) && Object.keys(value).length === 0);
      if (isSet) warnUnsupportedOnce(name);
    }

    // Prompt is sent via stdin.
    args.push('--print');

    return args;
  }

  async connect(): Promise<void> {
    // Fail fast (and with the correct error type) if already aborted, before we
    // spawn anything — this avoids leaking a process whose rejection we'd then
    // have to swallow, and avoids connect()'s catch rewrapping it.
    if (this.options.signal?.aborted) {
      throw new AbortError('Operation aborted before starting');
    }

    const cliPath = this.options.pathToClaudeCodeExecutable ?? await this.findCLI();

    // Prepare the MCP config file (kept off the command line for secret hygiene).
    if (this.options.mcpServers && this.options.mcpServers.length > 0) {
      this.mcpConfigPath = await this.writeMcpConfig(this.options.mcpServers);
    }

    const args = this.buildCommand();

    const env = {
      ...process.env,
      ...this.options.env,
      CLAUDE_CODE_ENTRYPOINT: 'sdk-ts'
    };

    if (this.debugEnabled) {
      // Never log the resolved args here — they no longer carry MCP secrets
      // (those live in the temp file), but session IDs and prompts can still be
      // sensitive, so only the binary path is printed.
      // eslint-disable-next-line no-console
      console.error('[claude-code-sdk-ts] spawning CLI:', cliPath);
    }

    try {
      this.process = execa(cliPath, args, {
        env,
        cwd: this.options.cwd,
        stdin: 'pipe',
        stdout: 'pipe',
        stderr: 'pipe',
        buffer: false,
        ...(this.options.timeout ? { timeout: this.options.timeout } : {})
      });

      // Safety net: guarantee the child's promise always has a rejection handler,
      // so an intentional kill() on early break / abort / timeout can never
      // surface as an unhandledRejection that crashes the host process. The
      // awaiting consumer in receiveMessages() still observes the real outcome.
      this.process.catch(() => {});

      // Abort handling with proper cleanup.
      this.abortHandler = new SubprocessAbortHandler(this.process, this.options.signal);
      this.cleanupAbort = this.abortHandler.setup();

      // Send prompt via stdin. Guard against EPIPE if the child died early.
      if (this.process.stdin) {
        this.process.stdin.on('error', () => {
          // The child may have exited before consuming stdin; the exit path
          // reports the real failure, so swallow the stream error here.
        });
        this.process.stdin.write(this.prompt);
        this.process.stdin.end();
      }
    } catch (error) {
      await this.cleanupMcpConfig();
      throw new CLIConnectionError(`Failed to start Claude Code CLI: ${error}`);
    }
  }

  async *receiveMessages(): AsyncGenerator<CLIOutput> {
    if (!this.process || !this.process.stdout) {
      throw new CLIConnectionError('Not connected to CLI');
    }

    try {
      // Drain stderr into a bounded ring buffer so failures are diagnosable
      // (and so a full stderr pipe never blocks the child).
      if (this.process.stderr) {
        const stderrRl = createInterface({
          input: this.process.stderr,
          crlfDelay: Infinity
        });

        stderrRl.on('line', (line) => {
          this.stderrBuffer.push(line);
          if (this.stderrBuffer.length > SubprocessCLITransport.STDERR_BUFFER_MAX) {
            this.stderrBuffer.shift();
          }
          if (this.debugEnabled) {
            // eslint-disable-next-line no-console
            console.error('[claude-code-sdk-ts] stderr:', line);
          }
        });
      }

      const rl = createInterface({
        input: this.process.stdout,
        crlfDelay: Infinity
      });

      // stream-json: one JSON object per line.
      for await (const line of rl) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        if (this.debugEnabled) {
          // eslint-disable-next-line no-console
          console.error('[claude-code-sdk-ts] stdout:', trimmedLine);
        }

        try {
          const parsed = JSON.parse(trimmedLine) as CLIOutput;
          yield parsed;
        } catch (error) {
          // Skip non-JSON lines (like the Python SDK does).
          if (trimmedLine.startsWith('{') || trimmedLine.startsWith('[')) {
            throw new CLIJSONDecodeError(
              `Failed to parse CLI output: ${error}`,
              trimmedLine
            );
          }
          continue;
        }
      }

      // Wait for process to exit and surface failures with diagnostics.
      try {
        await this.process;
      } catch (error) {
        const execError = error as {
          isCanceled?: boolean;
          timedOut?: boolean;
          exitCode?: number;
          signal?: NodeJS.Signals;
        };

        if (execError.timedOut) {
          throw new TimeoutError(
            `Claude Code CLI timed out after ${this.options.timeout}ms`,
            this.options.timeout
          );
        }

        if (execError.isCanceled || this.abortHandler?.wasAborted()) {
          throw new AbortError('Query was aborted via AbortSignal');
        }

        if (execError.exitCode !== 0) {
          const stderr = this.stderrBuffer.join('\n').trim();
          const detail = stderr ? `: ${stderr}` : '';
          throw new ProcessError(
            `Claude Code CLI exited with code ${execError.exitCode ?? 'unknown'}${detail}`,
            execError.exitCode,
            execError.signal
          );
        }
      }
    } finally {
      if (this.cleanupAbort) {
        this.cleanupAbort();
      }
      await this.cleanupMcpConfig();
    }
  }

  private async cleanupMcpConfig(): Promise<void> {
    if (this.mcpConfigPath) {
      const path = this.mcpConfigPath;
      this.mcpConfigPath = undefined;
      await rm(path, { force: true }).catch(() => {});
    }
  }

  async disconnect(): Promise<void> {
    if (this.cleanupAbort) {
      this.cleanupAbort();
      this.cleanupAbort = undefined;
    }

    if (this.process) {
      if (!this.process.killed) {
        this.process.kill();
      }
      this.process = undefined;
    }

    this.abortHandler = undefined;
    await this.cleanupMcpConfig();
  }
}
