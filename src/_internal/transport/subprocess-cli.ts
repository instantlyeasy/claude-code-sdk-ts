import { execa, type ExecaChildProcess } from 'execa';
import which from 'which';
import { createInterface } from 'node:readline';
import { platform } from 'node:os';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { access, constants } from 'node:fs/promises';
import { CLIConnectionError, CLINotFoundError, ProcessError, CLIJSONDecodeError, AbortError } from '../../errors.js';
import type { ClaudeCodeOptions, CLIOutput } from '../../types.js';
import { SubprocessAbortHandler } from './subprocess-abort-handler.js';

export class SubprocessCLITransport {
  private process?: ExecaChildProcess;
  private options: ClaudeCodeOptions;
  private prompt: string;
  private abortHandler?: SubprocessAbortHandler;
  private cleanupAbort?: () => void;

  constructor(prompt: string, options: ClaudeCodeOptions = {}) {
    this.prompt = prompt;
    this.options = options;
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
        await execa(path, ['--version']);
        return path;
      } catch {
      // Ignore error and continue
    }
    }

    throw new CLINotFoundError();
  }

  private buildCommand(): string[] {
    // Build command following Python SDK pattern
    const args: string[] = ['--output-format', 'stream-json', '--verbose'];

    // Claude CLI supported flags (from --help)
    if (this.options.model) args.push('--model', this.options.model);
    // Don't pass --debug flag as it produces non-JSON output
    
    // Note: Claude CLI handles authentication internally
    // Authentication is managed entirely by the CLI

    // Handle session resumption
    if (this.options.sessionId) {
      args.push('--resume', this.options.sessionId);
    }

    // Handle allowed/disallowed tools (Claude CLI uses camelCase flags)
    if (this.options.allowedTools && this.options.allowedTools.length > 0) {
      args.push('--allowedTools', this.options.allowedTools.join(','));
    }
    if (this.options.deniedTools && this.options.deniedTools.length > 0) {
      args.push('--disallowedTools', this.options.deniedTools.join(','));
    }

    // Handle permission mode - map to CLI's actual flag
    if (this.options.permissionMode === 'bypassPermissions') {
      args.push('--dangerously-skip-permissions');
    }
    // Note: 'default' and 'acceptEdits' are not supported by current CLI version

    // Handle MCP config
    if (this.options.mcpServers && this.options.mcpServers.length > 0) {
      const mcpConfig = {
        mcpServers: this.options.mcpServers
      };
      args.push('--mcp-config', JSON.stringify(mcpConfig));
    }

    // Handle MCP server permissions
    if (this.options.mcpServerPermissions && Object.keys(this.options.mcpServerPermissions).length > 0) {
      args.push('--mcp-server-permissions', JSON.stringify(this.options.mcpServerPermissions));
    }

    // Handle configuration file
    if (this.options.configFile) {
      args.push('--config-file', this.options.configFile);
    }

    // Handle role
    if (this.options.role) {
      args.push('--role', this.options.role);
    }

    // Handle additional context
    if (this.options.context && this.options.context.length > 0) {
      args.push('--context', ...this.options.context);
    }

    // Handle temperature
    if (this.options.temperature !== undefined) {
      args.push('--temperature', this.options.temperature.toString());
    }

    // Handle max tokens
    if (this.options.maxTokens !== undefined) {
      args.push('--max-tokens', this.options.maxTokens.toString());
    }

    // Handle add directories
    if (this.options.addDirectories && this.options.addDirectories.length > 0) {
      args.push('--add-dir', this.options.addDirectories.join(' '));
    }

    // Add --print flag (prompt will be sent via stdin)
    args.push('--print');

    return args;
  }

  async connect(): Promise<void> {
    const cliPath = await this.findCLI();
    const args = this.buildCommand();

    const env = {
      ...process.env,
      ...this.options.env,
      CLAUDE_CODE_ENTRYPOINT: 'sdk-ts'
    };

    // Debug: Log the actual command being run
    if (this.options.debug) {
      // eslint-disable-next-line no-console
      console.error('DEBUG: Running command:', cliPath, args.join(' '));
    }

    try {
      // Don't pass signal to execa - we'll handle it manually
      this.process = execa(cliPath, args, {
        env,
        cwd: this.options.cwd,
        stdin: 'pipe',
        stdout: 'pipe',
        stderr: 'pipe',
        buffer: false
        // Remove signal from here - we'll handle it manually
      });

      // Set up abort handling with proper cleanup
      this.abortHandler = new SubprocessAbortHandler(this.process, this.options.signal);
      this.cleanupAbort = this.abortHandler.setup();
      
      // Send prompt via stdin
      if (this.process.stdin) {
        this.process.stdin.write(this.prompt);
        this.process.stdin.end();
      }
    } catch (error) {
      throw new CLIConnectionError(`Failed to start Claude Code CLI: ${error}`);
    }
  }

  async *receiveMessages(): AsyncGenerator<CLIOutput> {
    if (!this.process || !this.process.stdout) {
      throw new CLIConnectionError('Not connected to CLI');
    }

    try {
      // Handle stderr in background
      if (this.process.stderr) {
        const stderrRl = createInterface({
          input: this.process.stderr,
          crlfDelay: Infinity
        });
        
        stderrRl.on('line', (line) => {
          if (this.options.debug) {
            // eslint-disable-next-line no-console
            console.error('DEBUG stderr:', line);
          }
        });
      }

      const rl = createInterface({
        input: this.process.stdout,
        crlfDelay: Infinity
      });

      // Process stream-json format - each line is a JSON object
      for await (const line of rl) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;
        
        if (this.options.debug) {
          // eslint-disable-next-line no-console
          console.error('DEBUG stdout:', trimmedLine);
        }
        
        try {
          const parsed = JSON.parse(trimmedLine) as CLIOutput;
          yield parsed;
        } catch (error) {
          // Skip non-JSON lines (like Python SDK does)
          if (trimmedLine.startsWith('{') || trimmedLine.startsWith('[')) {
            throw new CLIJSONDecodeError(
              `Failed to parse CLI output: ${error}`,
              trimmedLine
            );
          }
          continue;
        }
      }

      // Wait for process to exit
      try {
        await this.process;
      } catch (error: unknown) {
        const err = error as Error & { isCanceled?: boolean; name?: string };
        // Check if the process was cancelled/aborted
        if (err.isCanceled || err.name === 'CancelError' || this.abortHandler?.wasAborted()) {
          // Throw a proper AbortError so it can be caught by the user
          throw new AbortError('Query was aborted via AbortSignal');
        }
        
        const execError = err as Error & { exitCode?: number; signal?: NodeJS.Signals };
        if (execError.exitCode !== 0) {
          throw new ProcessError(
            `Claude Code CLI exited with code ${execError.exitCode}`,
            execError.exitCode,
            execError.signal
          );
        }
      }
    } finally {
      // Clean up abort handler
      if (this.cleanupAbort) {
        this.cleanupAbort();
      }
    }
  }

  async disconnect(): Promise<void> {
    // Clean up abort handler first
    if (this.cleanupAbort) {
      this.cleanupAbort();
      this.cleanupAbort = undefined;
    }
    
    if (this.process) {
      // Kill the process if it's still running
      if (!this.process.killed) {
        this.process.kill();
      }
      this.process = undefined;
    }
    
    this.abortHandler = undefined;
  }
}