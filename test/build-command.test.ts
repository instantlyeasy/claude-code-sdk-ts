import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFile, rm } from 'node:fs/promises';
import { SubprocessCLITransport } from '../src/_internal/transport/subprocess-cli.js';
import type { ClaudeCodeOptions } from '../src/types.js';

// buildCommand() is private; exercise it directly via a typed escape hatch.
function build(options: ClaudeCodeOptions): string[] {
  const t = new SubprocessCLITransport('prompt', options);
  return (t as unknown as { buildCommand(): string[] }).buildCommand();
}

describe('buildCommand — supported flags', () => {
  it('always requests stream-json + verbose + print', () => {
    const args = build({});
    expect(args).toEqual(expect.arrayContaining(['--output-format', 'stream-json', '--verbose', '--print']));
  });

  it('maps model, session resume, and tool lists', () => {
    const args = build({ model: 'opus', sessionId: 'abc', allowedTools: ['Read', 'Write'], deniedTools: ['Bash'] });
    expect(args).toEqual(expect.arrayContaining(['--model', 'opus', '--resume', 'abc', '--allowedTools', 'Read,Write', '--disallowedTools', 'Bash']));
  });

  it('maps acceptEdits to --permission-mode (was a silent no-op) (#17)', () => {
    const args = build({ permissionMode: 'acceptEdits' });
    expect(args).toEqual(expect.arrayContaining(['--permission-mode', 'acceptEdits']));
  });

  it('maps bypassPermissions to --dangerously-skip-permissions', () => {
    expect(build({ permissionMode: 'bypassPermissions' })).toContain('--dangerously-skip-permissions');
  });

  it('emits NO --permission-mode for default (CLI has no such choice)', () => {
    expect(build({ permissionMode: 'default' })).not.toContain('--permission-mode');
  });

  it('wires systemPrompt to --append-system-prompt (#17)', () => {
    const args = build({ systemPrompt: 'Be terse.' });
    const i = args.indexOf('--append-system-prompt');
    expect(i).toBeGreaterThan(-1);
    expect(args[i + 1]).toBe('Be terse.');
  });

  it('passes each additional directory as its own token (#19)', () => {
    const args = build({ addDirectories: ['/a', '/b'] });
    const i = args.indexOf('--add-dir');
    expect(args.slice(i + 1, i + 3)).toEqual(['/a', '/b']);
  });
});

describe('buildCommand — unsupported options are ignored, not emitted (#16)', () => {
  it('never emits invented flags for temperature/maxTokens/context/role/configFile/mcpServerPermissions', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const args = build({
      temperature: 0.5, maxTokens: 100, context: ['x'], role: 'dev',
      configFile: './c.yaml', mcpServerPermissions: { srv: { permissions: 'allowAll' } } as never
    });
    for (const flag of ['--temperature', '--max-tokens', '--context', '--role', '--config-file', '--mcp-server-permissions']) {
      expect(args).not.toContain(flag);
    }
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('buildCommand — argument injection guard (#23a)', () => {
  it('rejects a model value that begins with "-"', () => {
    expect(() => build({ model: '--dangerously-skip-permissions' })).toThrow(/begins with/);
  });
  it('rejects a sessionId that begins with "-"', () => {
    expect(() => build({ sessionId: '--foo' })).toThrow(/begins with/);
  });
  it('rejects an add-dir path that begins with "-"', () => {
    expect(() => build({ addDirectories: ['-rf'] })).toThrow(/begins with/);
  });
});

describe('writeMcpConfig — name-keyed shape + secret hygiene (#17, #23b)', () => {
  let path: string | undefined;
  const transport = new SubprocessCLITransport('p', {});

  afterEach(async () => { if (path) await rm(path, { force: true }); path = undefined; });

  it('produces the CLI name-keyed object and keeps env secrets in a file, not argv', async () => {
    path = await (transport as unknown as { writeMcpConfig(s: unknown[]): Promise<string> })
      .writeMcpConfig([{ command: 'node', args: ['s.js'], env: { TOKEN: 'secret-123' } }]);
    const parsed = JSON.parse(await readFile(path, 'utf8'));
    // Keyed by synthesized name, not an array.
    expect(Array.isArray(parsed.mcpServers)).toBe(false);
    expect(parsed.mcpServers.server0).toMatchObject({ command: 'node', env: { TOKEN: 'secret-123' } });
  });

  it('honors an explicit server name', async () => {
    path = await (transport as unknown as { writeMcpConfig(s: unknown[]): Promise<string> })
      .writeMcpConfig([{ name: 'fs', command: 'node' }]);
    const parsed = JSON.parse(await readFile(path, 'utf8'));
    expect(parsed.mcpServers.fs).toBeDefined();
  });
});
