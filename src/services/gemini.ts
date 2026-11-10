import { getLevelById, getScenarioById } from '../constants/scenarios';
import type {
  ChatMessage,
  ConversationLevel,
  GeminiModelOption,
  GrammarFeedback,
  ScenarioId,
} from '../types/conversation';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const MAX_HISTORY_MESSAGES = 20;

export class GeminiApiError extends Error {
  status?: number;
  code: 'missing-key' | 'invalid-key' | 'rate-limit' | 'model-not-found' | 'bad-response' | 'network';

  constructor(
    message: string,
    code: GeminiApiError['code'],
    status?: number
  ) {
    super(message);
    this.name = 'GeminiApiError';
    this.code = code;
    this.status = status;
  }
}

export interface GeminiTutorResult {
  reply: string;
  feedback: GrammarFeedback;
}

interface GeminiResponsePayload {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: {
    message?: string;
  };
}

interface RawModelsListResponse {
  models?: Array<{
    name?: string;
    displayName?: string;
    description?: string;
    supportedGenerationMethods?: string[];
  }>;
}

const TUTOR_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    reply: {
      type: 'STRING',
      description: 'Natural, warm conversational response in English (2-4 concise spoken sentences ending with a follow-up prompt or question).',
    },
    hasCorrection: {
      type: 'BOOLEAN',
      description: 'True only if the learner had a noticeable grammar, tense, preposition, or unnatural phrasing mistake worth gently improving.',
    },
    correctedSentence: {
      type: 'STRING',
      description: 'A grammatically correct version of the learner sentence when hasCorrection is true.',
    },
    explanation: {
      type: 'STRING',
      description: 'A brief, friendly 1-2 sentence explanation of the grammar or phrasing tip.',
    },
    betterAlternative: {
      type: 'STRING',
      description: 'Optional natural or idiomatic way a native speaker might express the same idea.',
    },
    vocabularyTip: {
      type: 'OBJECT',
      properties: {
        word: { type: 'STRING' },
        meaning: { type: 'STRING' },
      },
      required: ['word', 'meaning'],
    },
  },
  required: ['reply', 'hasCorrection'],
};

export function buildSystemInstruction(
  level: ConversationLevel,
  scenarioId: ScenarioId
): string {
  const scenario = getScenarioById(scenarioId);
  const levelInfo = getLevelById(level);

  return [
    'You are SpeakMe, a warm, patient, and encouraging AI English speaking partner.',
    `Scenario: ${scenario.label}. ${scenario.personaInstruction}`,
    `Learner level: ${levelInfo.label}. ${levelInfo.instruction}`,
    'Conversation guidelines:',
    '- Keep your spoken "reply" natural and concise (2 to 4 sentences) so Text-to-Speech sounds conversational.',
    '- Almost always end your "reply" with an inviting open-ended follow-up question to keep the learner speaking.',
    '- Do not lecture inside "reply"; keep grammar corrections strictly inside the structured feedback fields.',
    '- Ignore minor speech-to-text punctuation quirks (missing periods or capitalization). Only set hasCorrection=true when there is an actual grammar, verb tense, article, preposition, or phrasing issue.',
    '- When hasCorrection=true, provide correctedSentence and a kind, concise explanation (and optionally betterAlternative or one useful vocabularyTip).',
  ].join('\n');
}

/**
 * Strip optional markdown code fences before parsing JSON returned by LLMs.
 */
export function parseTutorJsonResponse(rawText: string): GeminiTutorResult {
  const cleaned = rawText
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    throw new GeminiApiError(
      'AI returned an unexpected format. Please try sending your message again.',
      'bad-response'
    );
  }

  const reply = typeof parsed.reply === 'string' ? parsed.reply.trim() : '';
  if (!reply) {
    throw new GeminiApiError(
      'AI returned an empty reply. Please try again.',
      'bad-response'
    );
  }

  const hasCorrection = Boolean(parsed.hasCorrection);
  const rawTip = parsed.vocabularyTip as Record<string, unknown> | undefined;
  const vocabularyTip =
    rawTip && typeof rawTip.word === 'string' && typeof rawTip.meaning === 'string'
      ? { word: rawTip.word.trim(), meaning: rawTip.meaning.trim() }
      : undefined;

  return {
    reply,
    feedback: {
      hasCorrection,
      correctedSentence:
        hasCorrection && typeof parsed.correctedSentence === 'string'
          ? parsed.correctedSentence.trim()
          : undefined,
      explanation:
        hasCorrection && typeof parsed.explanation === 'string'
          ? parsed.explanation.trim()
          : undefined,
      betterAlternative:
        typeof parsed.betterAlternative === 'string' && parsed.betterAlternative.trim()
          ? parsed.betterAlternative.trim()
          : undefined,
      vocabularyTip:
        vocabularyTip?.word && vocabularyTip?.meaning ? vocabularyTip : undefined,
    },
  };
}

function mapHttpError(status: number, serverMessage?: string): GeminiApiError {
  const detail = serverMessage ? ` (${serverMessage})` : '';

  if (status === 400 || status === 401 || status === 403) {
    return new GeminiApiError(
      `Invalid or unauthorized Gemini API key. Check your key in Settings${detail}.`,
      'invalid-key',
      status
    );
  }
  if (status === 404) {
    return new GeminiApiError(
      `Selected Gemini model was not found. Open Settings and pick another model or test your key${detail}.`,
      'model-not-found',
      status
    );
  }
  if (status === 429) {
    return new GeminiApiError(
      'Free-tier rate limit reached. Wait a few seconds or switch to Gemini 3.5 Flash-Lite in Settings.',
      'rate-limit',
      status
    );
  }

  return new GeminiApiError(
    `Gemini API error (${status})${detail}.`,
    'network',
    status
  );
}

export async function sendConversationTurn(params: {
  apiKey: string;
  model: string;
  history: ChatMessage[];
  userMessage: string;
  level: ConversationLevel;
  scenario: ScenarioId;
  signal?: AbortSignal;
}): Promise<GeminiTutorResult> {
  const trimmedKey = params.apiKey.trim();
  if (!trimmedKey) {
    throw new GeminiApiError(
      'Please add your free Google Gemini API key in Settings to start.',
      'missing-key'
    );
  }

  const recentHistory = params.history
    .filter((msg) => !msg.error && msg.text.trim().length > 0)
    .slice(-MAX_HISTORY_MESSAGES);

  const contents = [
    ...recentHistory.map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.text }],
    })),
    {
      role: 'user',
      parts: [{ text: params.userMessage }],
    },
  ];

  let response: Response;
  try {
    response = await fetch(
      `${GEMINI_API_BASE}/models/${encodeURIComponent(params.model)}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': trimmedKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: buildSystemInstruction(params.level, params.scenario) }],
          },
          contents,
          generationConfig: {
            temperature: 0.7,
            responseMimeType: 'application/json',
            responseSchema: TUTOR_RESPONSE_SCHEMA,
          },
        }),
        signal: params.signal,
      }
    );
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err;
    }
    throw new GeminiApiError(
      'Network error while reaching Gemini API. Check your internet connection.',
      'network'
    );
  }

  const data = (await response.json().catch(() => ({}))) as GeminiResponsePayload;

  if (!response.ok) {
    throw mapHttpError(response.status, data.error?.message);
  }

  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  if (!rawText) {
    throw new GeminiApiError(
      'Gemini did not return any text. Please try speaking again.',
      'bad-response'
    );
  }

  return parseTutorJsonResponse(rawText);
}

/**
 * Verify the provided Gemini API key and list available generateContent Gemini models.
 */
export async function fetchAvailableModels(
  apiKey: string,
  signal?: AbortSignal
): Promise<GeminiModelOption[]> {
  const trimmedKey = apiKey.trim();
  if (!trimmedKey) {
    throw new GeminiApiError('Enter a Gemini API key first.', 'missing-key');
  }

  let response: Response;
  try {
    response = await fetch(`${GEMINI_API_BASE}/models`, {
      method: 'GET',
      headers: {
        'x-goog-api-key': trimmedKey,
      },
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err;
    }
    throw new GeminiApiError(
      'Could not reach Gemini API to test the key.',
      'network'
    );
  }

  const payload = (await response.json().catch(() => ({}))) as RawModelsListResponse & {
    error?: { message?: string };
  };

  if (!response.ok) {
    throw mapHttpError(response.status, payload.error?.message);
  }

  const models = (payload.models ?? [])
    .filter(
      (item) =>
        item.name?.startsWith('models/gemini-') &&
        item.supportedGenerationMethods?.includes('generateContent') &&
        !item.name.includes('embedding') &&
        !item.name.includes('image')
    )
    .map((item) => {
      const id = (item.name ?? '').replace(/^models\//, '');
      return {
        id,
        label: item.displayName || id,
        description: item.description || '',
      };
    });

  return models;
}
