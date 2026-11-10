import { useState } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  Volume2,
  X,
} from 'lucide-react';
import {
  DEFAULT_GEMINI_MODELS,
  STT_ACCENTS,
} from '../constants/scenarios';
import { fetchAvailableModels } from '../services/gemini';
import type {
  AppSettings,
  GeminiModelOption,
  SttMode,
  ThemeMode,
} from '../types/conversation';

interface SettingsModalProps {
  isOpen: boolean;
  settings: AppSettings;
  voices: SpeechSynthesisVoice[];
  onClose: () => void;
  onSave: (updated: AppSettings) => void;
  onTestVoice: (voiceURI: string, rate: number, lang: string) => void;
}

export function SettingsModal({
  isOpen,
  settings,
  voices,
  onClose,
  onSave,
  onTestVoice,
}: SettingsModalProps) {
  const [draft, setDraft] = useState<AppSettings>(settings);
  const [showKey, setShowKey] = useState(false);
  const [availableModels, setAvailableModels] = useState<GeminiModelOption[]>(
    DEFAULT_GEMINI_MODELS
  );
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  if (!isOpen) return null;

  const englishVoices = voices.filter((voice) =>
    voice.lang.toLowerCase().startsWith('en')
  );

  const handleTestConnection = async () => {
    setIsTestingKey(true);
    setKeyStatus(null);
    try {
      const models = await fetchAvailableModels(draft.apiKey);
      if (models.length > 0) {
        // Merge defaults + live fetched models without duplicating IDs.
        const mergedMap = new Map<string, GeminiModelOption>();
        for (const preset of DEFAULT_GEMINI_MODELS) {
          mergedMap.set(preset.id, preset);
        }
        for (const live of models) {
          if (!mergedMap.has(live.id)) {
            mergedMap.set(live.id, live);
          }
        }
        setAvailableModels(Array.from(mergedMap.values()));
      }
      setKeyStatus({
        type: 'success',
        message: `Connected! Found ${models.length} Gemini models available for your key.`,
      });
    } catch (err) {
      setKeyStatus({
        type: 'error',
        message:
          err instanceof Error ? err.message : 'Failed to verify Gemini API key.',
      });
    } finally {
      setIsTestingKey(false);
    }
  };

  const handleSave = () => {
    onSave({
      ...draft,
      apiKey: draft.apiKey.trim(),
    });
    onClose();
  };

  const labelClasses = 'block font-medium text-slate-800 dark:text-slate-200';
  const inputClasses =
    'w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-base sm:text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-500 focus:bg-white dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:bg-slate-950';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm dark:bg-slate-950/80"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
          <h2 id="settings-modal-title" className="text-base font-semibold text-slate-900 dark:text-white">
            SpeakMe Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
            aria-label="Close settings"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-5 text-sm">
          {/* API Key Section */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="gemini-api-key" className="font-medium text-slate-800 dark:text-slate-200">
                Google Gemini API Key
              </label>
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-cyan-600 hover:text-cyan-500 dark:text-cyan-400 dark:hover:text-cyan-300"
              >
                Get free key
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  id="gemini-api-key"
                  type={showKey ? 'text' : 'password'}
                  value={draft.apiKey}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, apiKey: e.target.value }))
                  }
                  placeholder="AIza..."
                  className={`${inputClasses} pr-9`}
                />
                <button
                  type="button"
                  onClick={() => setShowKey((prev) => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  aria-label={showKey ? 'Hide API key' : 'Show API key'}
                >
                  {showKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>

              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTestingKey || !draft.apiKey.trim()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-xs font-medium text-slate-800 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                {isTestingKey ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  'Test Key'
                )}
              </button>
            </div>

            <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              Your key is stored only in your browser&apos;s localStorage and sent directly to
              Google&apos;s Gemini API.
            </p>

            {keyStatus && (
              <div
                className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-xs ${
                  keyStatus.type === 'success'
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-200'
                    : 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-200'
                }`}
              >
                {keyStatus.type === 'success' && (
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                )}
                <span>{keyStatus.message}</span>
              </div>
            )}
          </section>

          {/* Appearance Theme */}
          <section className="space-y-1.5">
            <label htmlFor="theme-mode" className={labelClasses}>
              Appearance Theme
            </label>
            <select
              id="theme-mode"
              value={draft.theme}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, theme: e.target.value as ThemeMode }))
              }
              className={inputClasses}
            >
              <option value="dark">Dark Theme</option>
              <option value="light">White (Light) Theme</option>
            </select>
          </section>

          {/* Model Selection */}
          <section className="space-y-1.5">
            <label htmlFor="gemini-model" className={labelClasses}>
              AI Model
            </label>
            <select
              id="gemini-model"
              value={draft.model}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, model: e.target.value }))
              }
              className={inputClasses}
            >
              {availableModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label} ({model.id})
                </option>
              ))}
            </select>
          </section>

          {/* Voice Input Mode */}
          <section className="space-y-1.5">
            <label htmlFor="stt-mode" className={labelClasses}>
              Voice Input Mode
            </label>
            <select
              id="stt-mode"
              value={draft.sttMode}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, sttMode: e.target.value as SttMode }))
              }
              className={inputClasses}
            >
              <option value="auto">
                Auto (Browser Live Captions + Gemini Voice Mic Fallback)
              </option>
              <option value="gemini-audio">
                Gemini Voice Mic (Works in all browsers)
              </option>
              <option value="browser">
                Browser Live Captions only (Chrome/Edge)
              </option>
            </select>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Auto seamlessly switches to Gemini Voice Mic if your browser blocks Web Speech servers.
            </p>
          </section>

          {/* Speech Recognition Accent */}
          <section className="space-y-1.5">
            <label htmlFor="stt-accent" className={labelClasses}>
              Your Speaking Accent (Speech-to-Text)
            </label>
            <select
              id="stt-accent"
              value={draft.sttLang}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, sttLang: e.target.value }))
              }
              className={inputClasses}
            >
              {STT_ACCENTS.map((accent) => (
                <option key={accent.code} value={accent.code}>
                  {accent.label}
                </option>
              ))}
            </select>
          </section>

          {/* Text-to-Speech Voice */}
          <section className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="tts-voice" className="font-medium text-slate-800 dark:text-slate-200">
                AI Voice (Text-to-Speech)
              </label>
              <button
                type="button"
                onClick={() =>
                  onTestVoice(draft.ttsVoiceURI, draft.ttsRate, draft.sttLang)
                }
                className="inline-flex items-center gap-1 text-xs font-medium text-cyan-600 hover:text-cyan-500 dark:text-cyan-400 dark:hover:text-cyan-300"
              >
                <Volume2 className="h-3.5 w-3.5" />
                Test Voice
              </button>
            </div>
            <select
              id="tts-voice"
              value={draft.ttsVoiceURI}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, ttsVoiceURI: e.target.value }))
              }
              className={inputClasses}
            >
              <option value="">Auto (Best Available English Voice)</option>
              {englishVoices.map((voice) => (
                <option key={voice.voiceURI} value={voice.voiceURI}>
                  {voice.name} ({voice.lang})
                </option>
              ))}
            </select>
          </section>

          {/* Speech Speed */}
          <section className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="tts-rate" className="font-medium text-slate-800 dark:text-slate-200">
                Speaking Speed
              </label>
              <span className="text-xs font-semibold text-cyan-700 dark:text-cyan-300">
                {draft.ttsRate.toFixed(2)}x
              </span>
            </div>
            <input
              id="tts-rate"
              type="range"
              min="0.75"
              max="1.25"
              step="0.05"
              value={draft.ttsRate}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  ttsRate: Number(e.target.value),
                }))
              }
              className="w-full accent-indigo-500"
            />
          </section>

          {/* Conversation Behavior Toggles */}
          <section className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/60">
            <label className="flex cursor-pointer items-center justify-between gap-3">
              <div>
                <div className="text-xs font-medium text-slate-800 dark:text-slate-200">
                  Auto-send after short pause
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Automatically sends your spoken sentence after ~1s of silence.
                </div>
              </div>
              <input
                type="checkbox"
                checked={draft.autoSendOnSilence}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    autoSendOnSilence: e.target.checked,
                  }))
                }
                className="h-4 w-4 accent-indigo-500"
              />
            </label>

            <label className="flex cursor-pointer items-center justify-between gap-3 border-t border-slate-200 pt-2.5 dark:border-slate-800/80">
              <div>
                <div className="text-xs font-medium text-slate-800 dark:text-slate-200">
                  Show Malayalam meaning below AI text
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Displays Malayalam translation right underneath every AI English reply.
                </div>
              </div>
              <input
                type="checkbox"
                checked={draft.showMalayalamTranslation}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    showMalayalamTranslation: e.target.checked,
                  }))
                }
                className="h-4 w-4 accent-indigo-500"
              />
            </label>

            <label className="flex cursor-pointer items-center justify-between gap-3 border-t border-slate-200 pt-2.5 dark:border-slate-800/80">
              <div>
                <div className="text-xs font-medium text-slate-800 dark:text-slate-200">
                  Hands-free auto-continue
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Re-opens the mic automatically right after AI finishes speaking.
                </div>
              </div>
              <input
                type="checkbox"
                checked={draft.autoListen}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    autoListen: e.target.checked,
                  }))
                }
                className="h-4 w-4 accent-indigo-500"
              />
            </label>
          </section>
        </div>

        <div className="mt-5 flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
