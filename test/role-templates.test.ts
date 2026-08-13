import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { claude } from '../src/index.js';

const MOCK = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'mock-cli.mjs');

async function capturePrompt(build: () => ReturnType<typeof claude>['query'] extends never ? never : any) {
  const stdinFile = join(tmpdir(), `claude-sdk-stdin-${randomUUID()}.txt`);
  const prevMode = process.env.MOCK_CLI_MODE;
  const prevFile = process.env.MOCK_STDIN_FILE;
  process.env.MOCK_CLI_MODE = 'basic';
  process.env.MOCK_STDIN_FILE = stdinFile;
  try {
    await build();
    return await readFile(stdinFile, 'utf8');
  } finally {
    process.env.MOCK_CLI_MODE = prevMode;
    process.env.MOCK_STDIN_FILE = prevFile;
    await rm(stdinFile, { force: true });
  }
}

describe('role prompting templates (#core-20 / #docs-15)', () => {
  it('interpolates template variables for the string-name withRole overload', async () => {
    const role = {
      name: 'translator',
      model: 'sonnet',
      promptingTemplate: 'Translate to ${language}. Be ${tone}.'
    };
    const prompt = await capturePrompt(() =>
      claude()
        .withExecutable(MOCK)
        .withRole(role)                       // register the role definition
        .withRole('translator', { language: 'French', tone: 'formal' }) // string overload + vars
        .query('Hello world')
        .asText()
    );
    // The template must be interpolated (no literal ${...}) and prepended.
    expect(prompt).toContain('Translate to French. Be formal.');
    expect(prompt).not.toContain('${language}');
    expect(prompt).toContain('Hello world');
  });
});
