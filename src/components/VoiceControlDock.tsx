import { useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  Headphones,
  Loader2,
  Mic,
  Send,
  Square,
  VolumeX,
  X,
} from 'lucide-react';
import type { VoiceState } from '../types/conversation';
import { formatRecordingDuration } from '../utils/audioUtils';

interface VoiceControlDockProps {
  voiceState: VoiceState;
  isVoiceSupported: boolean;
  isAudioRecorderActive: boolean;
  recordingSeconds: number;
  usingAudioFallback: boolean;
  interimText: string;
  finalText: string;
  autoListen: boolean;
  errorMessage: string | null;
  onDismissError: () => void;
  onMicAction: () => void;
  onCancelListening: () => void;
  onToggleAutoListen: () => void;
  onSendText: (text: string) => void;
}

export function VoiceControlDock({
  voiceState,
  isVoiceSupported,
  isAudioRecorderActive,
  recordingSeconds,
  usingAudioFallback,
  interimText,
  finalText,
  autoListen,
  errorMessage,
  onDismissError,
  onMicAction,
  onCancelListening,
  onToggleAutoListen,
  onSendText,
}: VoiceControlDockProps) {
  const [typedText, setTypedText] = useState('');

  const liveTranscript = [finalText, interimText].filter(Boolean).join(' ').trim();

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const cleaned = typedText.trim();
    if (!cleaned || voiceState === 'thinking') return;
    setTypedText('');
    onSendText(cleaned);
  };

  const stateLabel: Record<VoiceState, string> = {
    idle: isVoiceSupported ? 'Tap mic to speak English' : 'Mic unsupported in this browser',
    listening: isAudioRecorderActive
      ? `Recording ${formatRecordingDuration(recordingSeconds)}... tap mic to send`
      : 'Listening... tap mic to send',
    thinking: 'Thinking... tap to cancel',
    speaking: 'AI speaking... tap to interrupt',
  };

  return (
    <footer className="border-t border-slate-200 bg-white/95 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-950/95">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 pt-3.5 pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-3.5">
        {errorMessage && (
          <div
            role="alert"
            className="flex items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-500/30 dark:bg-rose-950/50 dark:text-rose-200"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500 dark:text-rose-400" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={onDismissError}
              className="rounded p-1 text-rose-500 hover:bg-rose-100 dark:text-rose-300 dark:hover:bg-rose-900/50"
              aria-label="Dismiss error"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {!isVoiceSupported && (
          <p className="text-center text-xs text-amber-700 dark:text-amber-300/90">
            Microphone recording is unavailable in this browser. You can still type below and hear AI voice replies!
          </p>
        )}

        {usingAudioFallback && voiceState !== 'listening' && (
          <p className="text-center text-[11px] text-cyan-700 dark:text-cyan-300/80">
            Using Gemini Voice Mic mode — works directly across all browsers.
          </p>
        )}

        {voiceState === 'listening' && (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-center text-sm text-indigo-900 dark:border-indigo-500/30 dark:bg-indigo-950/35 dark:text-indigo-100">
            {isAudioRecorderActive ? (
              <span className="inline-flex items-center gap-2 text-rose-700 dark:text-rose-200">
                <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500 dark:bg-rose-400" />
                Recording voice ({formatRecordingDuration(recordingSeconds)}) — speak English and tap mic to send
              </span>
            ) : liveTranscript ? (
              <span>&ldquo;{liveTranscript}&rdquo;</span>
            ) : (
              <span className="text-indigo-700/80 dark:text-indigo-300/80">Listening... go ahead and speak</span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onToggleAutoListen}
            disabled={!isVoiceSupported}
            aria-pressed={autoListen}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
              autoListen
                ? 'border-cyan-500/50 bg-cyan-50 text-cyan-800 dark:bg-cyan-500/15 dark:text-cyan-200'
                : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:text-slate-200'
            }`}
            title="Automatically turn mic back on after AI finishes speaking"
          >
            <Headphones className="h-3.5 w-3.5" />
            <span>Hands-free</span>
          </button>

          <div className="flex flex-col items-center gap-1.5">
            <div className="relative flex items-center justify-center">
              {voiceState === 'listening' && (
                <span className="animate-voice-ring pointer-events-none absolute inset-0 rounded-full bg-rose-500/40" />
              )}

              <button
                type="button"
                onClick={onMicAction}
                disabled={voiceState === 'idle' && !isVoiceSupported}
                aria-label={stateLabel[voiceState]}
                className={`relative flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${
                  voiceState === 'listening'
                    ? 'bg-rose-600 shadow-rose-500/30 hover:bg-rose-500'
                    : voiceState === 'thinking'
                    ? 'bg-amber-600 shadow-amber-500/20 hover:bg-amber-500'
                    : voiceState === 'speaking'
                    ? 'bg-cyan-600 shadow-cyan-500/30 hover:bg-cyan-500'
                    : 'bg-gradient-to-br from-indigo-500 to-cyan-500 shadow-indigo-500/30 hover:brightness-110'
                }`}
              >
                {voiceState === 'idle' && <Mic className="h-6 w-6" />}
                {voiceState === 'listening' && <Square className="h-5 w-5 fill-current" />}
                {voiceState === 'thinking' && <Loader2 className="h-6 w-6 animate-spin" />}
                {voiceState === 'speaking' && <VolumeX className="h-6 w-6" />}
              </button>
            </div>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {stateLabel[voiceState]}
            </span>
          </div>

          <div className="flex w-24 justify-end">
            {voiceState === 'listening' && (
              <button
                type="button"
                onClick={onCancelListening}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <X className="h-3.5 w-3.5" />
                Cancel
              </button>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <label className="sr-only" htmlFor="fallback-text-input">
            Type an English message
          </label>
          <input
            id="fallback-text-input"
            type="text"
            value={typedText}
            onChange={(e) => setTypedText(e.target.value)}
            placeholder="Or type in English here and press Enter..."
            className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-base sm:text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-indigo-500 focus:bg-white dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:bg-slate-900"
          />
          <button
            type="submit"
            disabled={!typedText.trim() || voiceState === 'thinking'}
            aria-label="Send message"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>
      </div>
    </footer>
  );
}
