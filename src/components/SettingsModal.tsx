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
import type { AppSettings, GeminiModelOption, SttMode } from '../types/conversation';

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-5 text-slate-100 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 id="settings-modal-title" className="text-base font-semibold text-white">
            SpeakMe Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
            aria-label="Close settings"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-5 text-sm">
          {/* API Key Section */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="gemini-api-key" className="font-medium text-slate-200">
                Google Gemini API Key
              </label>
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-cyan-400 hover:text-cyan-300"
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
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 pr-9 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((prev) => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
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
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isTestingKey ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  'Test Key'
                )}
              </button>
            </div>

            <p className="text-[11px] leading-relaxed text-slate-400">
              Your key is stored only in your browser&apos;s localStorage and sent directly to
              Google&apos;s Gemini API.
            </p>

            {keyStatus && (
              <div
                className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-xs ${
                  keyStatus.type === 'success'
                    ? 'border-emerald-500/30 bg-emerald-950/40 text-emerald-200'
                    : 'border-rose-500/30 bg-rose-950/40 text-rose-200'
                }`}
              >
                {keyStatus.type === 'success' && (
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                )}
                <span>{keyStatus.message}</span>
              </div>
            )}
          </section>

          {/* Model Selection */}
          <section className="space-y-1.5">
            <label htmlFor="gemini-model" className="block font-medium text-slate-200">
              AI Model
            </label>
            <select
              id="gemini-model"
              value={draft.model}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, model: e.target.value }))
              }
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 outline-none focus:border-indigo-500"
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
            <label htmlFor="stt-mode" className="block font-medium text-slate-200">
              Voice Input Mode
            </label>
            <select
              id="stt-mode"
              value={draft.sttMode}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, sttMode: e.target.value as SttMode }))
              }
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 outline-none focus:border-indigo-500"
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
            <p className="text-[11px] text-slate-400">
              Auto seamlessly switches to Gemini Voice Mic if your browser blocks Web Speech servers.
            </p>
          </section>

          {/* Speech Recognition Accent */}
          <section className="space-y-1.5">
            <label htmlFor="stt-accent" className="block font-medium text-slate-200">
              Your Speaking Accent (Speech-to-Text)
            </label>
            <select
              id="stt-accent"
              value={draft.sttLang}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, sttLang: e.target.value }))
              }
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 outline-none focus:border-indigo-500"
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
              <label htmlFor="tts-voice" className="font-medium text-slate-200">
                AI Voice (Text-to-Speech)
              </label>
              <button
                type="button"
                onClick={() =>
                  onTestVoice(draft.ttsVoiceURI, draft.ttsRate, draft.sttLang)
                }
                className="inline-flex items-center gap-1 text-xs font-medium text-cyan-400 hover:text-cyan-300"
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
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 outline-none focus:border-indigo-500"
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
              <label htmlFor="tts-rate" className="font-medium text-slate-200">
                Speaking Speed
              </label>
              <span className="text-xs font-semibold text-cyan-300">
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
          <section className="space-y-2.5 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <label className="flex cursor-pointer items-center justify-between gap-3">
              <div>
                <div className="text-xs font-medium text-slate-200">
                  Auto-send after short pause
                </div>
                <div className="text-[11px] text-slate-400">
                  Automatically sends your spoken sentence after ~1.7s of silence.
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

            <label className="flex cursor-pointer items-center justify-between gap-3 border-t border-slate-800/80 pt-2.5">
              <div>
                <div className="text-xs font-medium text-slate-200">
                  Hands-free auto-continue
                </div>
                <div className="text-[11px] text-slate-400">
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

        <div className="mt-5 flex justify-end gap-2 border-t border-slate-800 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-medium text-slate-300 transition hover:bg-slate-800"
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
