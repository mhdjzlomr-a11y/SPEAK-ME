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
const FALLBACK_FLASH_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.5-flash-lite',
  'gemini-2.5-flash',
];
const RETRYABLE_STATUS_CODES = new Set([404, 429, 500, 502, 503, 504]);

export class GeminiApiError extends Error {
  status?: number;
  code:
    | 'missing-key'
    | 'invalid-key'
    | 'rate-limit'
    | 'overloaded'
    | 'model-not-found'
    | 'bad-response'
    | 'network';

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
  replyMalayalam?: string;
  feedback: GrammarFeedback;
}

export interface GeminiAudioTutorResult extends GeminiTutorResult {
  transcript: string;
}

type GeminiContentPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

interface GeminiContentTurn {
  role: 'user' | 'model';
  parts: GeminiContentPart[];
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

const TUTOR_BASE_PROPERTIES = {
  reply: {
    type: 'STRING',
    description: 'Natural, warm conversational response in English (2-4 concise spoken sentences ending with a follow-up prompt or question).',
  },
  replyMalayalam: {
    type: 'STRING',
    description: 'Accurate, natural Malayalam translation (in Malayalam script) of the exact "reply" text so a Malayalam speaker can easily understand it.',
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
  explanationMalayalam: {
    type: 'STRING',
    description: 'Brief Malayalam translation/explanation (in Malayalam script) of the grammar tip when hasCorrection is true.',
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
};

const TUTOR_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: TUTOR_BASE_PROPERTIES,
  required: ['reply', 'replyMalayalam', 'hasCorrection'],
};

const TUTOR_AUDIO_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    transcript: {
      type: 'STRING',
      description: 'Accurate verbatim English transcription of what the learner spoke in the audio clip. Return an empty string if completely silent or unintelligible.',
    },
    ...TUTOR_BASE_PROPERTIES,
  },
  required: ['transcript', 'reply', 'replyMalayalam', 'hasCorrection'],
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
    '- Always provide "replyMalayalam" as a natural, easy-to-understand Malayalam translation of your English "reply" (written in Malayalam script).',
    '- Ignore minor speech-to-text punctuation quirks (missing periods or capitalization). Only set hasCorrection=true when there is an actual grammar, verb tense, article, preposition, or phrasing issue.',
    '- When hasCorrection=true, provide correctedSentence, a kind concise explanation, and explanationMalayalam in Malayalam script (and optionally betterAlternative or one useful vocabularyTip).',
  ].join('\n');
}

/**
 * Strip optional markdown code fences before parsing JSON returned by LLMs.
 */
function parseRawTutorObject(rawText: string): Record<string, unknown> {
  const cleaned = rawText
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    throw new GeminiApiError(
      'AI returned an unexpected format. Please try sending your message again.',
      'bad-response'
    );
  }
}

export function parseTutorJsonResponse(rawText: string): GeminiTutorResult {
  const parsed = parseRawTutorObject(rawText);

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

  const replyMalayalam =
    typeof parsed.replyMalayalam === 'string' && parsed.replyMalayalam.trim()
      ? parsed.replyMalayalam.trim()
      : undefined;

  return {
    reply,
    replyMalayalam,
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
      explanationMalayalam:
        hasCorrection &&
        typeof parsed.explanationMalayalam === 'string' &&
        parsed.explanationMalayalam.trim()
          ? parsed.explanationMalayalam.trim()
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

function parseAudioTutorJsonResponse(rawText: string): GeminiAudioTutorResult {
  const parsed = parseRawTutorObject(rawText);
  const transcript =
    typeof parsed.transcript === 'string' ? parsed.transcript.trim() : '';

  if (!transcript) {
    throw new GeminiApiError(
      'Could not hear English speech clearly in that recording. Please speak closer to your mic and try again.',
      'bad-response'
    );
  }

  const baseResult = parseTutorJsonResponse(rawText);
  return {
    transcript,
    ...baseResult,
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
      'Free-tier rate limit reached. Wait a few seconds and tap Retry.',
      'rate-limit',
      status
    );
  }
  if (status === 500 || status === 502 || status === 503 || status === 504) {
    return new GeminiApiError(
      'Gemini servers are temporarily busy with high demand. Wait a moment and tap Retry.',
      'overloaded',
      status
    );
  }

  return new GeminiApiError(
    `Gemini API error (${status})${detail}.`,
    'network',
    status
  );
}

function waitWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(new DOMException('Aborted', 'AbortError'));
  }
  return new Promise((resolve, reject) => {
    const timer = globalThis.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      globalThis.clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function buildModelAttemptOrder(primaryModel: string): string[] {
  const seen = new Set<string>([primaryModel]);
  const ordered = [primaryModel];
  for (const fallback of FALLBACK_FLASH_MODELS) {
    if (!seen.has(fallback)) {
      seen.add(fallback);
      ordered.push(fallback);
    }
  }
  return ordered;
}

function buildHistoryContents(history: ChatMessage[]): GeminiContentTurn[] {
  return history
    .filter((msg) => !msg.error && msg.text.trim().length > 0)
    .slice(-MAX_HISTORY_MESSAGES)
    .map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.text }],
    }));
}

async function executeSingleModelRequest(params: {
  apiKey: string;
  model: string;
  level: ConversationLevel;
  scenario: ScenarioId;
  contents: GeminiContentTurn[];
  responseSchema: Record<string, unknown>;
  signal?: AbortSignal;
}): Promise<string> {
  let response: Response;
  try {
    response = await fetch(
      `${GEMINI_API_BASE}/models/${encodeURIComponent(params.model)}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': params.apiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: buildSystemInstruction(params.level, params.scenario) }],
          },
          contents: params.contents,
          generationConfig: {
            temperature: 0.7,
            responseMimeType: 'application/json',
            responseSchema: params.responseSchema,
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

  return rawText;
}

async function executeGenerateContent(params: {
  apiKey: string;
  model: string;
  level: ConversationLevel;
  scenario: ScenarioId;
  contents: GeminiContentTurn[];
  responseSchema: Record<string, unknown>;
  signal?: AbortSignal;
}): Promise<string> {
  const trimmedKey = params.apiKey.trim();
  if (!trimmedKey) {
    throw new GeminiApiError(
      'Please add your free Google Gemini API key in Settings to start.',
      'missing-key'
    );
  }

  const candidates = buildModelAttemptOrder(params.model);
  let lastError: unknown;

  for (let i = 0; i < candidates.length; i++) {
    const modelId = candidates[i];
    try {
      return await executeSingleModelRequest({
        ...params,
        apiKey: trimmedKey,
        model: modelId,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw err;
      }
      lastError = err;

      const isRetryable =
        err instanceof GeminiApiError &&
        err.status !== undefined &&
        RETRYABLE_STATUS_CODES.has(err.status);

      const hasNextCandidate = i < candidates.length - 1;
      if (!isRetryable || !hasNextCandidate) {
        throw err;
      }

      await waitWithAbort(200, params.signal);
    }
  }

  throw lastError;
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
  const contents: GeminiContentTurn[] = [
    ...buildHistoryContents(params.history),
    {
      role: 'user',
      parts: [{ text: params.userMessage }],
    },
  ];

  const rawText = await executeGenerateContent({
    apiKey: params.apiKey,
    model: params.model,
    level: params.level,
    scenario: params.scenario,
    contents,
    responseSchema: TUTOR_RESPONSE_SCHEMA,
    signal: params.signal,
  });

  return parseTutorJsonResponse(rawText);
}

/**
 * Send recorded microphone audio directly to Gemini when browser Web Speech STT
 * is unavailable or blocked (e.g., Brave/Firefox/Chromium without Google Speech keys).
 */
export async function sendAudioConversationTurn(params: {
  apiKey: string;
  model: string;
  history: ChatMessage[];
  audioBase64: string;
  mimeType: string;
  level: ConversationLevel;
  scenario: ScenarioId;
  signal?: AbortSignal;
}): Promise<GeminiAudioTutorResult> {
  const contents: GeminiContentTurn[] = [
    ...buildHistoryContents(params.history),
    {
      role: 'user',
      parts: [
        {
          text: 'Listen to the learner speaking English in this audio clip. Write an exact transcription in "transcript", provide helpful grammar feedback if needed, and continue the conversation in "reply".',
        },
        {
          inlineData: {
            mimeType: params.mimeType,
            data: params.audioBase64,
          },
        },
      ],
    },
  ];

  const rawText = await executeGenerateContent({
    apiKey: params.apiKey,
    model: params.model,
    level: params.level,
    scenario: params.scenario,
    contents,
    responseSchema: TUTOR_AUDIO_RESPONSE_SCHEMA,
    signal: params.signal,
  });

  return parseAudioTutorJsonResponse(rawText);
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
