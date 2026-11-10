import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  GeminiApiError,
  parseTutorJsonResponse,
  sendConversationTurn,
} from '../services/gemini';
import type { ChatMessage } from '../types/conversation';

describe('parseTutorJsonResponse', () => {
  it('parses clean structured JSON responses', () => {
    const raw = JSON.stringify({
      reply: 'That sounds fun! What kind of movies do you like?',
      hasCorrection: true,
      correctedSentence: 'I went to the cinema yesterday.',
      explanation: 'Use the past tense "went" with "yesterday".',
      betterAlternative: 'I caught a movie yesterday.',
      vocabularyTip: {
        word: 'catch a movie',
        meaning: 'informal way to say watch a movie at a theater',
      },
    });

    const result = parseTutorJsonResponse(raw);
    expect(result.reply).toBe('That sounds fun! What kind of movies do you like?');
    expect(result.feedback.hasCorrection).toBe(true);
    expect(result.feedback.correctedSentence).toBe('I went to the cinema yesterday.');
    expect(result.feedback.vocabularyTip?.word).toBe('catch a movie');
  });

  it('strips markdown json fences if included by a model', () => {
    const raw = '```json\n{"reply": "Great job!", "hasCorrection": false}\n```';
    const result = parseTutorJsonResponse(raw);
    expect(result.reply).toBe('Great job!');
    expect(result.feedback.hasCorrection).toBe(false);
    expect(result.feedback.correctedSentence).toBeUndefined();
  });

  it('throws bad-response when reply is empty or invalid JSON', () => {
    expect(() => parseTutorJsonResponse('not json')).toThrow(GeminiApiError);
    expect(() => parseTutorJsonResponse('{"reply": "", "hasCorrection": false}')).toThrow(
      GeminiApiError
    );
  });
});

describe('sendConversationTurn', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws missing-key before calling fetch when API key is blank', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await expect(
      sendConversationTurn({
        apiKey: '   ',
        model: 'gemini-3.8-flash',
        history: [],
        userMessage: 'Hello',
        level: 'intermediate',
        scenario: 'free-talk',
      })
    ).rejects.toMatchObject({ code: 'missing-key' });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sends systemInstruction, bounded multi-turn contents, and responseSchema', async () => {
    const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      reply: 'Nice! What did you cook?',
                      hasCorrection: false,
                    }),
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const history: ChatMessage[] = [
      { id: '1', role: 'assistant', text: 'Hi! How are you?', timestamp: 1 },
      { id: '2', role: 'user', text: 'I am good!', timestamp: 2 },
      { id: '3', role: 'user', text: 'Failed message', timestamp: 3, error: 'Network' },
    ];

    const result = await sendConversationTurn({
      apiKey: 'test-key-123',
      model: 'gemini-3.8-flash',
      history,
      userMessage: 'I cooked dinner today.',
      level: 'beginner',
      scenario: 'daily-life',
    });

    expect(result.reply).toBe('Nice! What did you cook?');
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).toContain('/models/gemini-3.8-flash:generateContent');
    expect((init?.headers as Record<string, string>)['x-goog-api-key']).toBe('test-key-123');

    const body = JSON.parse(String(init?.body));
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.generationConfig.responseSchema.required).toEqual([
      'reply',
      'hasCorrection',
    ]);
    // Excludes failed message (id: 3), keeps prior 2 + new user message.
    expect(body.contents).toHaveLength(3);
    expect(body.contents[0].role).toBe('model');
    expect(body.contents[2].parts[0].text).toBe('I cooked dinner today.');
  });

  it('maps 401 and 429 HTTP responses to clear typed errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: 'API key invalid' } }), {
        status: 401,
      })
    );

    await expect(
      sendConversationTurn({
        apiKey: 'bad-key',
        model: 'gemini-3.8-flash',
        history: [],
        userMessage: 'Hi',
        level: 'intermediate',
        scenario: 'free-talk',
      })
    ).rejects.toMatchObject({ code: 'invalid-key', status: 401 });

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: 'Quota exceeded' } }), {
        status: 429,
      })
    );

    await expect(
      sendConversationTurn({
        apiKey: 'valid-key',
        model: 'gemini-3.8-flash',
        history: [],
        userMessage: 'Hi',
        level: 'intermediate',
        scenario: 'free-talk',
      })
    ).rejects.toMatchObject({ code: 'rate-limit', status: 429 });
  });
});
