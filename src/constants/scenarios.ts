import type {
  AppSettings,
  ConversationLevel,
  GeminiModelOption,
  ScenarioId,
} from '../types/conversation';

export interface ScenarioDefinition {
  id: ScenarioId;
  label: string;
  description: string;
  starterPrompt: string;
  personaInstruction: string;
}

export interface LevelDefinition {
  id: ConversationLevel;
  label: string;
  description: string;
  instruction: string;
}

export interface AccentOption {
  code: string;
  label: string;
}

export const SCENARIOS: ScenarioDefinition[] = [
  {
    id: 'free-talk',
    label: 'Free Talk',
    description: 'Open, friendly chat about hobbies, life, or anything on your mind.',
    starterPrompt: "Hey there! I'm really glad we're practicing together today. How has your day been going so far?",
    personaInstruction:
      'Act as a warm, encouraging everyday English friend. Chat naturally about daily life, hobbies, goals, or whatever topic the learner brings up.',
  },
  {
    id: 'daily-life',
    label: 'Daily Routine',
    description: 'Practice talking about mornings, habits, family, and weekend plans.',
    starterPrompt: "Good to see you! Let's talk about everyday routines. What does a typical morning look like for you?",
    personaInstruction:
      'Act as a friendly neighbor or conversation partner asking natural follow-ups about daily habits, meals, errands, and weekend plans.',
  },
  {
    id: 'job-interview',
    label: 'Job Interview',
    description: 'Rehearse introducing yourself, strengths, and work experience.',
    starterPrompt: "Welcome! Thanks for joining today. To start off, could you tell me a little about yourself and what kind of work you're interested in?",
    personaInstruction:
      'Act as a supportive, professional hiring manager conducting a realistic yet friendly practice job interview. Ask one clear interview question at a time.',
  },
  {
    id: 'travel',
    label: 'Travel & Airport',
    description: 'Navigate check-in, directions, hotels, and sightseeing in English.',
    starterPrompt: "Hello and welcome! Imagine you've just arrived at the airport information desk. Where are you flying to today, and how can I help?",
    personaInstruction:
      'Act as a helpful travel assistant, airport agent, or local guide helping the traveler check in, find directions, and plan their trip.',
  },
  {
    id: 'cafe',
    label: 'Café & Ordering',
    description: 'Order drinks, ask about menu items, and make casual small talk.',
    starterPrompt: "Hi! Welcome to Sunny Bean Café. What can I get started for you today—coffee, tea, or something to eat?",
    personaInstruction:
      'Act as a cheerful barista or server at a cozy café. Keep the ordering flow realistic with polite questions about size, preferences, or food.',
  },
  {
    id: 'office',
    label: 'Office & Meetings',
    description: 'Discuss project updates, teamwork, deadlines, and polite requests.',
    starterPrompt: "Hey! Thanks for hopping on a quick catch-up call. How is your current project progressing, and is there anything you need help with?",
    personaInstruction:
      'Act as a friendly coworker during a casual stand-up or team catch-up meeting. Focus on clear workplace English and polite collaboration.',
  },
];

export const LEVELS: LevelDefinition[] = [
  {
    id: 'beginner',
    label: 'Beginner',
    description: 'Simple words, short sentences, extra gentle encouragement.',
    instruction:
      'Use simple, clear everyday English words and short sentences. Be extra encouraging and keep questions easy to answer.',
  },
  {
    id: 'intermediate',
    label: 'Intermediate',
    description: 'Natural everyday English with helpful phrasing upgrades.',
    instruction:
      'Use natural conversational English at a comfortable pace. Gently polish grammar mistakes and suggest smoother phrasing.',
  },
  {
    id: 'advanced',
    label: 'Advanced',
    description: 'Nuanced vocabulary, idioms, and executive/native-like flow.',
    instruction:
      'Speak like an articulate native speaker, introduce subtle idioms when appropriate, and refine the learner toward natural precision.',
  },
];

export const STT_ACCENTS: AccentOption[] = [
  { code: 'en-US', label: 'English (United States)' },
  { code: 'en-IN', label: 'English (India)' },
  { code: 'en-GB', label: 'English (United Kingdom)' },
  { code: 'en-AU', label: 'English (Australia)' },
];

export const DEFAULT_GEMINI_MODELS: GeminiModelOption[] = [
  {
    id: 'gemini-3.8-flash',
    label: 'Gemini 3.8 Flash (Recommended)',
    description: 'Fast, expressive free-tier default for natural tutoring.',
  },
  {
    id: 'gemini-3.5-flash-lite',
    label: 'Gemini 3.5 Flash-Lite',
    description: 'Ultra-lightweight and fast with generous throughput.',
  },
  {
    id: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    description: 'Previous-generation Flash fallback if needed.',
  },
];

export const DEFAULT_SETTINGS: AppSettings = {
  apiKey: '',
  model: 'gemini-3.8-flash',
  level: 'intermediate',
  scenario: 'free-talk',
  sttMode: 'auto',
  sttLang: 'en-US',
  ttsVoiceURI: '',
  ttsRate: 1.0,
  autoListen: false,
  autoSendOnSilence: true,
};

export function getScenarioById(id: ScenarioId): ScenarioDefinition {
  return SCENARIOS.find((scenario) => scenario.id === id) ?? SCENARIOS[0];
}

export function getLevelById(id: ConversationLevel): LevelDefinition {
  return LEVELS.find((level) => level.id === id) ?? LEVELS[1];
}
