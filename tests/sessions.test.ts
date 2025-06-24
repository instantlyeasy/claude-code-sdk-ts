import { describe, it, expect, vi, beforeEach } from 'vitest';
import { claude } from '../src/fluent.js';
import { ResponseParser } from '../src/parser.js';
import { query } from '../src/index.js';
import * as baseModule from '../src/index.js';
import type { ToolName } from '../src/types.js';

// Extended types for session functionality (will be moved to types.ts when implemented)
interface SessionResponseParser extends ResponseParser {
  getSessionId(): Promise<string | null>;
}

// Mock the base query function
vi.mock('../src/index.js', async () => {
  const actual = await vi.importActual('../src/index.js');
  return {
    ...actual,
    query: vi.fn()
  };
});

describe('Session Management', () => {
  let mockQuery: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery = vi.mocked(baseModule.query);
  });

  describe('Direct ClaudeCodeOptions sessionId usage', () => {
    it('should pass sessionId to the base query function when provided in options', async () => {
      mockQuery.mockImplementation(async function* () {
        yield {
          type: 'assistant',
          content: [{ type: 'text', text: 'Hello from session' }],
          session_id: 'existing-session-123'
        };
        yield {
          type: 'result',
          content: 'done',
          session_id: 'existing-session-123'
        };
      });

      const options = {
        model: 'sonnet',
        sessionId: 'existing-session-123',
        permissionMode: 'bypassPermissions' as const
      };

      // Direct usage of query function with sessionId in options
      const generator = query('Continue our conversation', options);
      const messages = [];
      for await (const message of generator) {
        messages.push(message);
      }

      expect(mockQuery).toHaveBeenCalledWith(
        'Continue our conversation',
        expect.objectContaining({
          sessionId: 'existing-session-123'
        })
      );

      expect(messages).toHaveLength(2);
      expect(messages[0]?.type).toBe('assistant');
      expect(messages[1]?.type).toBe('result');
      expect(messages[0]?.session_id).toBe('existing-session-123');
      expect(messages[1]?.session_id).toBe('existing-session-123');
    });

    it('should work with all other options when sessionId is provided', async () => {
      mockQuery.mockImplementation(async function* () {
        yield {
          type: 'assistant',
          content: [{ type: 'text', text: 'Complex query response' }],
          session_id: 'complex-session-456'
        };
        yield {
          type: 'result',
          content: 'done',
          session_id: 'complex-session-456'
        };
      });

      const allowedTools: ToolName[] = ['Read', 'Write'];
      const options = {
        model: 'opus',
        sessionId: 'complex-session-456',
        permissionMode: 'acceptEdits' as const,
        allowedTools,
        timeout: 30000,
        cwd: '/tmp/test',
        env: { TEST_VAR: 'value' },
        debug: true
      };

      const generator = query('Complex query with session', options);
      const messages = [];
      for await (const message of generator) {
        messages.push(message);
      }

      expect(mockQuery).toHaveBeenCalledWith(
        'Complex query with session',
        expect.objectContaining({
          model: 'opus',
          sessionId: 'complex-session-456',
          permissionMode: 'acceptEdits',
          allowedTools: ['Read', 'Write'],
          timeout: 30000,
          cwd: '/tmp/test',
          env: { TEST_VAR: 'value' },
          debug: true
        })
      );
    });

    it('should handle case when sessionId is null or undefined', async () => {
      mockQuery.mockImplementation(async function* () {
        yield {
          type: 'assistant',
          content: [{ type: 'text', text: 'New session started' }]
        };
        yield { type: 'result', content: 'done' };
      });

      const optionsWithNull = {
        model: 'sonnet',
        sessionId: null as any,
        permissionMode: 'bypassPermissions' as const
      };

      const optionsWithUndefined = {
        model: 'sonnet',
        sessionId: undefined,
        permissionMode: 'bypassPermissions' as const
      };

      // Test with null sessionId
      const generator1 = query('Start new session', optionsWithNull);
      const messages1 = [];
      for await (const message of generator1) {
        messages1.push(message);
      }

      // Test with undefined sessionId
      const generator2 = query('Start another session', optionsWithUndefined);
      const messages2 = [];
      for await (const message of generator2) {
        messages2.push(message);
      }

      expect(mockQuery).toHaveBeenCalledTimes(2);
      expect(mockQuery).toHaveBeenNthCalledWith(1, 'Start new session', optionsWithNull);
      expect(mockQuery).toHaveBeenNthCalledWith(2, 'Start another session', optionsWithUndefined);
    });

    it('should pass sessionId through ResponseParser when using fluent API', async () => {
      mockQuery.mockImplementation(async function* () {
        yield {
          type: 'assistant',
          content: [{ type: 'text', text: 'Fluent API with session' }],
          session_id: 'fluent-session-789'
        };
        yield {
          type: 'result',
          content: 'done',
          session_id: 'fluent-session-789'
        };
      });

      const result = await claude()
        .withModel('sonnet')
        .skipPermissions()
        .withSessionId('fluent-session-789')
        .query('Use fluent API with session')
        .asText();

      expect(mockQuery).toHaveBeenCalledWith(
        'Use fluent API with session',
        expect.objectContaining({
          sessionId: 'fluent-session-789'
        })
      );

      expect(result).toBe('Fluent API with session');
    });

    it('should validate sessionId is properly passed to CLI transport layer', async () => {
      // This test verifies the options structure matches what transport expects
      mockQuery.mockImplementation(async function* () {
        yield {
          type: 'system',
          subtype: 'session',
          data: { session_id: 'transport-test-session' },
          session_id: 'transport-test-session'
        };
        yield {
          type: 'assistant',
          content: [{ type: 'text', text: 'Transport layer test' }],
          session_id: 'transport-test-session'
        };
        yield {
          type: 'result',
          content: 'done',
          session_id: 'transport-test-session'
        };
      });

      const options = {
        sessionId: 'transport-test-session',
        model: 'sonnet',
        permissionMode: 'bypassPermissions' as const
      };

      const generator = query('Test transport layer sessionId', options);
      const messages = [];
      for await (const message of generator) {
        messages.push(message);
      }

      // Verify the mockQuery was called with sessionId
      expect(mockQuery).toHaveBeenCalledWith(
        'Test transport layer sessionId',
        expect.objectContaining({
          sessionId: 'transport-test-session'
        })
      );

      // Verify all messages contain session_id
      expect(messages).toHaveLength(3);
      messages.forEach(message => {
        if (message.session_id) {
          expect(message.session_id).toBe('transport-test-session');
        }
      });
    });

    it('should handle invalid sessionId gracefully', async () => {
      // Mock the query to throw an error like the CLI transport would for invalid session
      mockQuery.mockImplementation(async function* () {
        yield; // Add yield to satisfy generator requirement
        throw new Error('Invalid session ID: session-does-not-exist');
      });

      const options = {
        sessionId: 'session-does-not-exist',
        model: 'sonnet',
        permissionMode: 'bypassPermissions' as const
      };

      const generator = query('Test invalid session', options);

      await expect(async () => {
        for await (const _message of generator) {
          // This should not execute
        }
      }).rejects.toThrow('Invalid session ID: session-does-not-exist');

      expect(mockQuery).toHaveBeenCalledWith(
        'Test invalid session',
        expect.objectContaining({
          sessionId: 'session-does-not-exist'
        })
      );
    });
  });

  describe('getSessionId method', () => {
    it('should return a session ID from ResponseParser', async () => {
      // Mock a response that would contain session info
      mockQuery.mockImplementation(async function* () {
        yield {
          type: 'system',
          subtype: 'session',
          data: { session_id: 'test-session-123' },
          session_id: 'test-session-123'
        };
        yield {
          type: 'assistant',
          content: [
            {
              type: 'text',
              text: 'Hello in English, Hola in Spanish, Bonjour in French'
            }
          ],
          session_id: 'test-session-123'
        };
        yield {
          type: 'result',
          content: 'done',
          session_id: 'test-session-123'
        };
      });

      const parser = claude().withModel('sonnet').skipPermissions().query('Say hello in 3 different languages');

      const sessionId = await (parser as SessionResponseParser).getSessionId();
      expect(sessionId).toBe('test-session-123');
    });

    it('should handle case when no session ID is available', async () => {
      mockQuery.mockImplementation(async function* () {
        yield {
          type: 'assistant',
          content: [{ type: 'text', text: 'Hello' }]
        };
        yield { type: 'result', content: 'done' };
      });

      const parser = claude().withModel('sonnet').skipPermissions().query('Say hello');

      const sessionId = await (parser as SessionResponseParser).getSessionId();
      expect(sessionId).toBeNull();
    });
  });

  describe('withSessionId method', () => {
    it('should allow continuing conversation with existing session ID', async () => {
      // First query to get session ID
      mockQuery
        .mockImplementationOnce(async function* () {
          yield {
            type: 'system',
            subtype: 'init',
            data: { session_id: 'session-123' }
          };
          yield {
            type: 'assistant',
            content: [{ type: 'text', text: '42' }]
          };
          yield { type: 'result', content: 'done' };
        })
        .mockImplementationOnce(async function* () {
          yield {
            type: 'assistant',
            content: [{ type: 'text', text: 'You picked 42' }]
          };
          yield { type: 'result', content: 'done' };
        });

      const builder = claude().withModel('sonnet').skipPermissions();

      const parser = builder.query('Tell me a number between 1 and 100');

      const sessionId = await (parser as SessionResponseParser).getSessionId();
      const firstNumber = await parser.asText();

      if (sessionId) {
        const secondNumber = await builder.withSessionId(sessionId).query('Which number did you pick?').asText();

        expect(sessionId).toBe('session-123');
        expect(firstNumber).toBe('42');
        expect(secondNumber).toBe('You picked 42');
      } else {
        expect.fail('Session ID should not be null');
      }

      // Verify the second query was called with session context
      expect(mockQuery).toHaveBeenCalledTimes(2);
      expect(mockQuery).toHaveBeenNthCalledWith(
        2,
        'Which number did you pick?',
        expect.objectContaining({
          sessionId: 'session-123'
        })
      );
    });

    it('should pass session ID in query options', () => {
      mockQuery.mockImplementation(async function* () {
        yield { type: 'result', content: 'done' };
      });

      const builder = claude().withModel('sonnet').skipPermissions();

      builder.withSessionId('existing-session-456').query('Continue our conversation');

      expect(mockQuery).toHaveBeenCalledWith(
        'Continue our conversation',
        expect.objectContaining({
          sessionId: 'existing-session-456'
        })
      );
    });

    it('should chain with other fluent methods', () => {
      mockQuery.mockImplementation(async function* () {
        yield { type: 'result', content: 'done' };
      });

      const builder = claude().withModel('sonnet').skipPermissions().withTimeout(30000);

      builder.withSessionId('session-789').query('test');

      expect(mockQuery).toHaveBeenCalledWith(
        'test',
        expect.objectContaining({
          model: 'sonnet',
          permissionMode: 'bypassPermissions',
          timeout: 30000,
          sessionId: 'session-789'
        })
      );
    });
  });

  describe('Session Types', () => {
    it('should add session ID to ClaudeCodeOptions type', () => {
      // This test verifies that the types are properly extended
      const options = {
        model: 'sonnet',
        sessionId: 'test-session',
        permissionMode: 'bypassPermissions' as const
      };

      // This should compile without errors once sessionId is added to ClaudeCodeOptions
      expect(options.sessionId).toBe('test-session');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid session ID gracefully', async () => {
      // Mock the query to throw a ProcessError like the CLI transport would
      mockQuery.mockImplementation(async function* () {
        yield; // Add yield to satisfy generator requirement
        throw new Error('Claude Code CLI exited with code 1');
      });

      const builder = claude().withModel('sonnet').skipPermissions();

      const parser = builder.withSessionId('invalid-session').query('test');

      await expect(parser.asText()).rejects.toThrow('Claude Code CLI exited with code 1');
    });
  });
});
