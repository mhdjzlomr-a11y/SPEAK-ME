export type ConversationLevel = 'beginner' | 'intermediate' | 'advanced';

export type ScenarioId =
  | 'free-talk'
  | 'daily-life'
  | 'job-interview'
  | 'travel'
  | 'cafe'
  | 'office';

export type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

export type SttMode = 'auto' | 'browser' | 'gemini-audio';

export type ThemeMode = 'dark' | 'light';

export type VoiceEngine = 'gemini' | 'browser';

export interface GeminiVoiceOption {
  id: string;
  label: string;
}

export interface VocabularyTip {
  word: string;
  meaning: string;
}

export interface GrammarFeedback {
  hasCorrection: boolean;
  correctedSentence?: string;
  explanation?: string;
  explanationMalayalam?: string;
  betterAlternative?: string;
  vocabularyTip?: VocabularyTip;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  malayalamText?: string;
  timestamp: number;
  feedback?: GrammarFeedback;
  error?: string;
}

export interface AppSettings {
  settingsVersion?: number;
  apiKey: string;
  model: string;
  level: ConversationLevel;
  scenario: ScenarioId;
  theme: ThemeMode;
  showMalayalamTranslation: boolean;
  sttMode: SttMode;
  sttLang: string;
  voiceEngine: VoiceEngine;
  geminiVoiceName: string;
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
