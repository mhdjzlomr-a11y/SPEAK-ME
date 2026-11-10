import { DEFAULT_SETTINGS } from '../constants/scenarios';
import type { AppSettings, ChatMessage } from '../types/conversation';

const SETTINGS_STORAGE_KEY = 'speakme_settings_v1';
const MESSAGES_STORAGE_KEY = 'speakme_messages_v1';

/**
 * Safely read persisted app settings from localStorage, merging with defaults
 * so newly introduced settings fields always have valid fallback values.
 */
export function loadSettings(): AppSettings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    const needsSpeedUpgrade =
      (parsed.settingsVersion ?? 1) < 2 && parsed.model === 'gemini-3.8-flash';
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      settingsVersion: 2,
      model: needsSpeedUpgrade ? DEFAULT_SETTINGS.model : parsed.model ?? DEFAULT_SETTINGS.model,
      ttsRate:
        typeof parsed.ttsRate === 'number' && parsed.ttsRate >= 0.6 && parsed.ttsRate <= 1.5
          ? parsed.ttsRate
          : DEFAULT_SETTINGS.ttsRate,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage quota / private mode failures gracefully.
  }
}

export function loadMessages(): ChatMessage[] {
  try {
    const raw = window.localStorage.getItem(MESSAGES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

export function saveMessages(messages: ChatMessage[]): void {
  try {
    window.localStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(messages.slice(-60)));
  } catch {
    // Ignore storage quota failures gracefully.
  }
}

export function clearMessages(): void {
  try {
    window.localStorage.removeItem(MESSAGES_STORAGE_KEY);
  } catch {
    // Ignore storage failures gracefully.
  }
}
