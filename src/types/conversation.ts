export type ConversationLevel = 'beginner' | 'intermediate' | 'advanced';

export type ScenarioId =
  | 'free-talk'
  | 'daily-life'
  | 'job-interview'
  | 'travel'
  | 'cafe'
  | 'office';

export type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

export interface VocabularyTip {
  word: string;
  meaning: string;
}

export interface GrammarFeedback {
  hasCorrection: boolean;
  correctedSentence?: string;
  explanation?: string;
  betterAlternative?: string;
  vocabularyTip?: VocabularyTip;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
  feedback?: GrammarFeedback;
  error?: string;
}

export interface AppSettings {
  apiKey: string;
  model: string;
  level: ConversationLevel;
  scenario: ScenarioId;
  sttLang: string;
  ttsVoiceURI: string;
  ttsRate: number;
  autoListen: boolean;
  autoSendOnSilence: boolean;
}

export interface GeminiModelOption {
  id: string;
  label: string;
  description: string;
}
