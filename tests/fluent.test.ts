import { describe, it, expect, vi, beforeEach } from 'vitest';
import { claude, QueryBuilder } from '../src/fluent.js';
import { ResponseParser } from '../src/parser.js';
import { ConsoleLogger } from '../src/logger.js';
import * as baseModule from '../src/index.js';

// Mock the base query function
vi.mock('../src/index.js', async () => {
  const actual = await vi.importActual('../src/index.js');
  return {
    ...actual,
    query: vi.fn()
  };
});

describe('QueryBuilder', () => {
  let mockQuery: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery = vi.mocked(baseModule.query);
  });

  describe('Basic Configuration', () => {
    it('should create QueryBuilder instance using factory function', () => {
      const builder = claude();
      expect(builder).toBeInstanceOf(QueryBuilder);
    });

    it('should create QueryBuilder using static method', () => {
      const builder = QueryBuilder.create();
      expect(builder).toBeInstanceOf(QueryBuilder);
    });

    it('should set model', () => {
      mockQuery.mockImplementation(async function* () {
        yield { type: 'result', content: 'done' };
      });

      const builder = claude().withModel('opus');
      builder.query('test');

      expect(mockQuery).toHaveBeenCalledWith(
        'test',
        expect.objectContaining({
          model: 'opus'
        })
      );
    });

    it('should chain multiple configurations', () => {
      mockQuery.mockImplementation(async function* () {
        yield { type: 'result', content: 'done' };
      });

      claude().withModel('sonnet').withTimeout(5000).debug(true).inDirectory('/test/dir').query('test');

      expect(mockQuery).toHaveBeenCalledWith(
        'test',
        expect.objectContaining({
          model: 'sonnet',
          timeout: 5000,
          debug: true,
          cwd: '/test/dir'
        })
      );
    });
  });

  describe('Tool Management', () => {
    it('should set allowed tools', () => {
      mockQuery.mockImplementation(async function* () {
        yield { type: 'result', content: 'done' };
      });

      claude().allowTools('Read', 'Write', 'Edit').query('test');

      expect(mockQuery).toHaveBeenCalledWith(
        'test',
        expect.objectContaining({
          allowedTools: ['Read', 'Write', 'Edit']
        })
      );
    });

    it('should set denied tools', () => {
      mockQuery.mockImplementation(async function* () {
        yield { type: 'result', content: 'done' };
      });

      claude().denyTools('Bash', 'WebSearch').query('test');

      expect(mockQuery).toHaveBeenCalledWith(
        'test',
        expect.objectContaining({
          deniedTools: ['Bash', 'WebSearch']
        })
      );
    });

    it('should handle both allowed and denied tools', () => {
      mockQuery.mockImplementation(async function* () {
        yield { type: 'result', content: 'done' };
      });

      claude().allowTools('Read').denyTools('Write').query('test');

      expect(mockQuery).toHaveBeenCalledWith(
        'test',
        expect.objectContaining({
          allowedTools: ['Read'],
          deniedTools: ['Write']
        })
      );
    });
  });

  describe('Permission Modes', () => {
    it('should set skip permissions', () => {
      mockQuery.mockImplementation(async function* () {
        yield { type: 'result', content: 'done' };
      });

      claude().skipPermissions().query('test');

      expect(mockQuery).toHaveBeenCalledWith(
        'test',
        expect.objectContaining({
          permissionMode: 'bypassPermissions'
        })
      );
    });

    it('should set accept edits', () => {
      mockQuery.mockImplementation(async function* () {
        yield { type: 'result', content: 'done' };
      });

      claude().acceptEdits().query('test');

      expect(mockQuery).toHaveBeenCalledWith(
        'test',
        expect.objectContaining({
          permissionMode: 'acceptEdits'
        })
      );
    });

    it('should set custom permission mode', () => {
      mockQuery.mockImplementation(async function* () {
        yield { type: 'result', content: 'done' };
      });

      claude().withPermissions('default').query('test');

      expect(mockQuery).toHaveBeenCalledWith(
        'test',
        expect.objectContaining({
          permissionMode: 'default'
        })
      );
    });
  });

  describe('Environment Configuration', () => {
    it('should set environment variables', () => {
      mockQuery.mockImplementation(async function* () {
        yield { type: 'result', content: 'done' };
      });

      claude().withEnv({ NODE_ENV: 'test', API_KEY: 'secret' }).query('test');

      expect(mockQuery).toHaveBeenCalledWith(
        'test',
        expect.objectContaining({
          env: { NODE_ENV: 'test', API_KEY: 'secret' }
        })
      );
    });

    it('should merge multiple env calls', () => {
      mockQuery.mockImplementation(async function* () {
        yield { type: 'result', content: 'done' };
      });

      claude().withEnv({ NODE_ENV: 'test' }).withEnv({ API_KEY: 'secret' }).query('test');

      expect(mockQuery).toHaveBeenCalledWith(
        'test',
        expect.objectContaining({
          env: { NODE_ENV: 'test', API_KEY: 'secret' }
        })
      );
    });
  });

  describe('MCP Servers', () => {
    it('should add MCP servers', () => {
      mockQuery.mockImplementation(async function* () {
        yield { type: 'result', content: 'done' };
      });

      claude()
        .withMCP({ command: 'mcp-server-1' }, { command: 'mcp-server-2', args: ['--flag'] })
        .query('test');

      expect(mockQuery).toHaveBeenCalledWith(
        'test',
        expect.objectContaining({
          mcpServers: [{ command: 'mcp-server-1' }, { command: 'mcp-server-2', args: ['--flag'] }]
        })
      );
    });

    it('should accumulate MCP servers from multiple calls', () => {
      mockQuery.mockImplementation(async function* () {
        yield { type: 'result', content: 'done' };
      });

      claude().withMCP({ command: 'server1' }).withMCP({ command: 'server2' }).query('test');

      expect(mockQuery).toHaveBeenCalledWith(
        'test',
        expect.objectContaining({
          mcpServers: [{ command: 'server1' }, { command: 'server2' }]
        })
      );
    });
  });

  describe('Add Directories', () => {
    it('should add a single directory as string', () => {
      mockQuery.mockImplementation(async function* () {
        yield { type: 'result', content: 'done' };
      });

      claude().addDirectory('/path/to/dir').query('test');

      expect(mockQuery).toHaveBeenCalledWith(
        'test',
        expect.objectContaining({
          addDirectories: ['/path/to/dir']
        })
      );
    });

    it('should add multiple directories as array', () => {
      mockQuery.mockImplementation(async function* () {
        yield { type: 'result', content: 'done' };
      });

      claude().addDirectory(['/path/to/dir1', '/path/to/dir2']).query('test');

      expect(mockQuery).toHaveBeenCalledWith(
        'test',
        expect.objectContaining({
          addDirectories: ['/path/to/dir1', '/path/to/dir2']
        })
      );
    });

    it('should accumulate directories from multiple calls', () => {
      mockQuery.mockImplementation(async function* () {
        yield { type: 'result', content: 'done' };
      });

      claude()
        .addDirectory('/first/dir')
        .addDirectory(['/second/dir', '/third/dir'])
        .addDirectory('/fourth/dir')
        .query('test');

      expect(mockQuery).toHaveBeenCalledWith(
        'test',
        expect.objectContaining({
          addDirectories: ['/first/dir', '/second/dir', '/third/dir', '/fourth/dir']
        })
      );
    });
  });

  describe('Event Handlers', () => {
    it('should call message handlers', async () => {
      const handler = vi.fn();

      mockQuery.mockImplementation(async function* () {
        yield { type: 'user', content: 'Hello' };
        yield { type: 'assistant', content: [{ type: 'text', text: 'Hi!' }] };
        yield { type: 'result', content: 'done' };
      });

      const messages = [];
      for await (const msg of claude().onMessage(handler).queryRaw('test')) {
        messages.push(msg);
      }

      expect(handler).toHaveBeenCalledTimes(3);
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ type: 'user' }));
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ type: 'assistant' }));
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ type: 'result' }));
    });

    it('should call assistant handlers', async () => {
      const handler = vi.fn();

      mockQuery.mockImplementation(async function* () {
        yield { type: 'user', content: 'Hello' };
        yield { type: 'assistant', content: [{ type: 'text', text: 'Hi!' }] };
        yield { type: 'result', content: 'done' };
      });

      for await (const _ of claude().onAssistant(handler).queryRaw('test')) {
        // Process
      }

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith([{ type: 'text', text: 'Hi!' }]);
    });

    it('should call tool use handlers', async () => {
      const handler = vi.fn();

      mockQuery.mockImplementation(async function* () {
        yield {
          type: 'assistant',
          content: [
            { type: 'text', text: 'Let me read that file' },
            {
              type: 'tool_use',
              id: '1',
              name: 'Read',
              input: { path: 'test.txt' }
            }
          ]
        };
      });

      for await (const _ of claude().onToolUse(handler).queryRaw('test')) {
        // Process
      }

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({
        name: 'Read',
        input: { path: 'test.txt' }
      });
    });

    it('should handle errors in message handlers gracefully', async () => {
      const errorHandler = vi.fn(() => {
        throw new Error('Handler error');
      });
      const logger = new ConsoleLogger();
      const logSpy = vi.spyOn(logger, 'error');

      mockQuery.mockImplementation(async function* () {
        yield { type: 'result', content: 'done' };
      });

      for await (const _ of claude().withLogger(logger).onMessage(errorHandler).queryRaw('test')) {
        // Process
      }

      expect(logSpy).toHaveBeenCalledWith('Message handler error', expect.any(Object));
    });
  });

  describe('Logger Integration', () => {
    it('should log query lifecycle', async () => {
      const logger = new ConsoleLogger();
      const infoSpy = vi.spyOn(logger, 'info');
      const debugSpy = vi.spyOn(logger, 'debug');

      mockQuery.mockImplementation(async function* () {
        yield { type: 'user', content: 'test' };
        yield { type: 'result', content: 'done' };
      });

      for await (const _ of claude().withLogger(logger).queryRaw('test prompt')) {
        // Process
      }

      expect(infoSpy).toHaveBeenCalledWith(
        'Starting query',
        expect.objectContaining({
          prompt: 'test prompt'
        })
      );
      expect(debugSpy).toHaveBeenCalledWith('Received message', {
        type: 'user'
      });
      expect(debugSpy).toHaveBeenCalledWith('Received message', {
        type: 'result'
      });
      expect(infoSpy).toHaveBeenCalledWith('Query completed');
    });
  });

  describe('Response Parser Integration', () => {
    it('should return ResponseParser from query method', () => {
      mockQuery.mockImplementation(async function* () {
        yield { type: 'result', content: 'done' };
      });

      const parser = claude().query('test');
      expect(parser).toBeInstanceOf(ResponseParser);
    });

    it('should pass handlers to ResponseParser', async () => {
      const handler = vi.fn();

      mockQuery.mockImplementation(async function* () {
        yield { type: 'assistant', content: [{ type: 'text', text: 'Hello' }] };
      });

      await claude().onMessage(handler).query('test').asText();

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'assistant'
        })
      );
    });
  });
});
