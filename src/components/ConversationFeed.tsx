import { useEffect, useRef } from 'react';
import { KeyRound, MessageSquarePlus, Sparkles } from 'lucide-react';
import { getScenarioById } from '../constants/scenarios';
import type { ChatMessage, ScenarioId } from '../types/conversation';
import { MessageBubble } from './MessageBubble';

interface ConversationFeedProps {
  messages: ChatMessage[];
  scenario: ScenarioId;
  hasApiKey: boolean;
  isThinking: boolean;
  activeSpeechId: string | null;
  ttsRate: number;
  onOpenSettings: () => void;
  onStartWithGreeting: () => void;
  onSpeakText: (text: string, speechId: string, rate?: number) => void;
  onStopSpeaking: () => void;
}

export function ConversationFeed({
  messages,
  scenario,
  hasApiKey,
  isThinking,
  activeSpeechId,
  ttsRate,
  onOpenSettings,
  onStartWithGreeting,
  onSpeakText,
  onStopSpeaking,
}: ConversationFeedProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const scenarioInfo = getScenarioById(scenario);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isThinking]);

  return (
    <main className="flex-1 overflow-y-auto px-4 py-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-5">
        {!hasApiKey && (
          <div className="flex flex-col justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-950/25 p-4 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-amber-500/15 p-2 text-amber-300">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-amber-200">
                  Add your free Google Gemini API key
                </h2>
                <p className="mt-0.5 text-xs leading-relaxed text-amber-100/80">
                  Speech-to-Text and Text-to-Speech run free in your browser. Add a free
                  Gemini key from Google AI Studio to power AI replies &amp; grammar feedback.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenSettings}
              className="shrink-0 rounded-xl bg-amber-400 px-3.5 py-2 text-xs font-semibold text-slate-950 transition hover:bg-amber-300"
            >
              Add API Key
            </button>
          </div>
        )}

        {messages.length === 0 ? (
          <div className="my-6 flex flex-col items-center rounded-3xl border border-slate-800/90 bg-slate-900/50 p-6 text-center sm:p-8">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/25 to-cyan-500/25 text-indigo-300 ring-1 ring-indigo-500/30">
              <Sparkles className="h-6 w-6" />
            </div>
            <span className="rounded-full border border-slate-700 bg-slate-800/80 px-3 py-0.5 text-[11px] font-medium text-cyan-300">
              Scenario: {scenarioInfo.label}
            </span>
            <h2 className="mt-3 text-lg font-semibold text-white">
              Ready to practice speaking English?
            </h2>
            <p className="mt-1.5 max-w-md text-sm text-slate-400">
              {scenarioInfo.description} Tap the microphone below to speak, or let your
              AI partner start the conversation aloud.
            </p>

            <button
              type="button"
              onClick={onStartWithGreeting}
              className="mt-5 inline-flex items-center gap-2 rounded-xl border border-indigo-500/40 bg-indigo-500/15 px-4 py-2.5 text-xs font-semibold text-indigo-200 transition hover:bg-indigo-500/25"
            >
              <MessageSquarePlus className="h-4 w-4" />
              Have AI Greet Me First
            </button>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              activeSpeechId={activeSpeechId}
              ttsRate={ttsRate}
              onSpeakText={onSpeakText}
              onStopSpeaking={onStopSpeaking}
            />
          ))
        )}

        {isThinking && (
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-indigo-500/30 bg-indigo-500/15 text-indigo-300">
              <Sparkles className="h-4 w-4 animate-pulse" />
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-2xl rounded-tl-sm border border-slate-800 bg-slate-900 px-4 py-3 text-xs text-slate-400">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400 [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400 [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400" />
              <span className="ml-1.5">Thinking &amp; checking grammar...</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </main>
  );
}
