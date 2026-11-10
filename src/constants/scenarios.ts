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
  starterPromptMl: string;
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
    starterPromptMl: 'ഹായ്! നമ്മൾ ഇന്ന് ഒരുമിച്ച് പ്രാക്ടീസ് ചെയ്യുന്നതിൽ എനിക്ക് വലിയ സന്തോഷമുണ്ട്. ഇന്നത്തെ നിങ്ങളുടെ ദിവസം എങ്ങനെ പോകുന്നു?',
    personaInstruction:
      'Act as a warm, encouraging everyday English friend. Chat naturally about daily life, hobbies, goals, or whatever topic the learner brings up.',
  },
  {
    id: 'daily-life',
    label: 'Daily Routine',
    description: 'Practice talking about mornings, habits, family, and weekend plans.',
    starterPrompt: "Good to see you! Let's talk about everyday routines. What does a typical morning look like for you?",
    starterPromptMl: 'കണ്ടതിൽ സന്തോഷം! നമുക്ക് ദൈനംദിന കാര്യങ്ങളെക്കുറിച്ച് സംസാരിക്കാം. സാധാരണയായി നിങ്ങളുടെ രാവിലത്തെ സമയം എങ്ങനെയാണ്?',
    personaInstruction:
      'Act as a friendly neighbor or conversation partner asking natural follow-ups about daily habits, meals, errands, and weekend plans.',
  },
  {
    id: 'job-interview',
    label: 'Job Interview',
    description: 'Rehearse introducing yourself, strengths, and work experience.',
    starterPrompt: "Welcome! Thanks for joining today. To start off, could you tell me a little about yourself and what kind of work you're interested in?",
    starterPromptMl: 'സ്വാഗതം! ഇന്ന് ജോയിൻ ചെയ്തതിന് നന്ദി. തുടക്കത്തിൽ, നിങ്ങളെക്കുറിച്ചും നിങ്ങൾക്ക് താല്പര്യമുള്ള ജോലിയെക്കുറിച്ചും അല്പം പറയാമോ?',
    personaInstruction:
      'Act as a supportive, professional hiring manager conducting a realistic yet friendly practice job interview. Ask one clear interview question at a time.',
  },
  {
    id: 'travel',
    label: 'Travel & Airport',
    description: 'Navigate check-in, directions, hotels, and sightseeing in English.',
    starterPrompt: "Hello and welcome! Imagine you've just arrived at the airport information desk. Where are you flying to today, and how can I help?",
    starterPromptMl: 'ഹലോ, സ്വാഗതം! നിങ്ങൾ ഇപ്പോൾ എയർപോർട്ട് ഇൻഫർമേഷൻ ഡെസ്കിൽ എത്തിയതായി സങ്കൽപ്പിക്കുക. ഇന്ന് എവിടേക്കാണ് യാത്ര, എനിക്ക് എങ്ങനെ സഹായിക്കാനാകും?',
    personaInstruction:
      'Act as a helpful travel assistant, airport agent, or local guide helping the traveler check in, find directions, and plan their trip.',
  },
  {
    id: 'cafe',
    label: 'Café & Ordering',
    description: 'Order drinks, ask about menu items, and make casual small talk.',
    starterPrompt: "Hi! Welcome to Sunny Bean Café. What can I get started for you today—coffee, tea, or something to eat?",
    starterPromptMl: 'ഹായ്! സണ്ണി ബീൻ കഫേയിലേക്ക് സ്വാഗതം. ഇന്ന് നിങ്ങൾക്ക് എന്താണ് വേണ്ടത് — കാപ്പിയോ ചായയോ അതോ കഴിക്കാൻ എന്തെങ്കിലും വേണോ?',
    personaInstruction:
      'Act as a cheerful barista or server at a cozy café. Keep the ordering flow realistic with polite questions about size, preferences, or food.',
  },
  {
    id: 'office',
    label: 'Office & Meetings',
    description: 'Discuss project updates, teamwork, deadlines, and polite requests.',
    starterPrompt: "Hey! Thanks for hopping on a quick catch-up call. How is your current project progressing, and is there anything you need help with?",
    starterPromptMl: 'ഹായ്! ചെറിയൊരു മീറ്റിംഗിനായി വന്നതിന് നന്ദി. ഇപ്പോഴത്തെ പ്രോജക്റ്റ് എങ്ങനെ പുരോഗമിക്കുന്നു, എന്തെങ്കിലും സഹായം ആവശ്യമുണ്ടോ?',
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
    id: 'gemini-3.5-flash-lite',
    label: 'Gemini 3.5 Flash-Lite (Fastest — Recommended)',
    description: 'Ultra-low-latency model built for instant voice replies.',
  },
  {
    id: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash (Fast Fallback)',
    description: 'Reliable low-latency Flash model with thinking off.',
  },
  {
    id: 'gemini-3.8-flash',
    label: 'Gemini 3.8 Flash',
    description: 'Expressive model (slightly slower under heavy server load).',
  },
];

export const DEFAULT_SETTINGS: AppSettings = {
  settingsVersion: 2,
  apiKey: '',
  model: 'gemini-3.5-flash-lite',
  level: 'intermediate',
  scenario: 'free-talk',
  theme: 'dark',
  showMalayalamTranslation: true,
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
