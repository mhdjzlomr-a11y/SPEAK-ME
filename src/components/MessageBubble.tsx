import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Lightbulb,
  Sparkles,
  Square,
  Volume2,
} from 'lucide-react';
import type { ChatMessage } from '../types/conversation';

interface MessageBubbleProps {
  message: ChatMessage;
  activeSpeechId: string | null;
  ttsRate: number;
  onSpeakText: (text: string, speechId: string, rate?: number) => void;
  onStopSpeaking: () => void;
}

export function MessageBubble({
  message,
  activeSpeechId,
  ttsRate,
  onSpeakText,
  onStopSpeaking,
}: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const feedback = message.feedback;

  const isMainPlaying = activeSpeechId === message.id;
  const isSlowPlaying = activeSpeechId === `${message.id}-slow`;
  const correctionSpeechId = `${message.id}-correction`;
  const isCorrectionPlaying = activeSpeechId === correctionSpeechId;

  if (isUser) {
    return (
      <div className="flex flex-col items-end gap-2">
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-indigo-600 px-4 py-2.5 text-sm leading-relaxed text-white shadow-md sm:max-w-[75%]">
          <p>{message.text}</p>
        </div>

        {message.error && (
          <div className="flex max-w-[85%] items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-950/50 px-3 py-2 text-xs text-rose-200 sm:max-w-[75%]">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
            <span>{message.error}</span>
          </div>
        )}

        {feedback && !feedback.hasCorrection && (
          <div className="flex max-w-[85%] flex-col items-end gap-1.5 sm:max-w-[75%]">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-950/40 px-2.5 py-1 text-xs text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span>Natural &amp; clear!</span>
            </div>
            {feedback.betterAlternative && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-xs text-slate-300">
                <span className="font-medium text-cyan-300">Another native way: </span>
                &ldquo;{feedback.betterAlternative}&rdquo;
              </div>
            )}
          </div>
        )}

        {feedback && feedback.hasCorrection && (
          <div className="w-full max-w-[90%] rounded-xl border border-amber-500/25 bg-slate-900/90 p-3 text-xs text-slate-200 shadow-sm sm:max-w-[78%]">
            <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
              <span className="inline-flex items-center gap-1.5 font-semibold text-amber-300">
                <Lightbulb className="h-3.5 w-3.5" />
                Grammar &amp; Phrasing Tip
              </span>

              {feedback.correctedSentence && (
                <button
                  type="button"
                  onClick={() =>
                    isCorrectionPlaying
                      ? onStopSpeaking()
                      : onSpeakText(
                          feedback.correctedSentence!,
                          correctionSpeechId,
                          ttsRate
                        )
                  }
                  className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-200 transition hover:border-slate-600 hover:bg-slate-700"
                >
                  {isCorrectionPlaying ? (
                    <>
                      <Square className="h-3 w-3 fill-current" />
                      Stop
                    </>
                  ) : (
                    <>
                      <Volume2 className="h-3 w-3 text-cyan-400" />
                      Listen
                    </>
                  )}
                </button>
              )}
            </div>

            <div className="mt-2 space-y-1.5 leading-relaxed">
              {feedback.correctedSentence && (
                <p className="text-emerald-300 font-medium">
                  Try: &ldquo;{feedback.correctedSentence}&rdquo;
                </p>
              )}
              {feedback.explanation && (
                <p className="text-slate-300">{feedback.explanation}</p>
              )}
              {feedback.betterAlternative && (
                <p className="text-cyan-300/90">
                  <span className="font-medium">More natural: </span>
                  &ldquo;{feedback.betterAlternative}&rdquo;
                </p>
              )}
              {feedback.vocabularyTip && (
                <div className="mt-1 flex items-start gap-1.5 rounded-lg bg-slate-950/70 px-2.5 py-1.5 text-slate-300">
                  <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-400" />
                  <span>
                    <strong className="text-indigo-300">
                      {feedback.vocabularyTip.word}:
                    </strong>{' '}
                    {feedback.vocabularyTip.meaning}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-indigo-500/30 bg-indigo-500/15 text-indigo-300">
        <Sparkles className="h-4 w-4" />
      </div>

      <div className="flex max-w-[85%] flex-col gap-1.5 sm:max-w-[75%]">
        <div className="rounded-2xl rounded-tl-sm border border-slate-800 bg-slate-900 px-4 py-3 text-sm leading-relaxed text-slate-100 shadow-sm">
          <p>{message.text}</p>

          <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-slate-800/80 pt-2">
            <button
              type="button"
              onClick={() =>
                isMainPlaying
                  ? onStopSpeaking()
                  : onSpeakText(message.text, message.id, ttsRate)
              }
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800/90 px-2.5 py-1 text-xs font-medium text-slate-200 transition hover:bg-slate-700"
            >
              {isMainPlaying ? (
                <>
                  <Square className="h-3 w-3 fill-current text-cyan-400" />
                  Stop
                </>
              ) : (
                <>
                  <Volume2 className="h-3.5 w-3.5 text-cyan-400" />
                  Listen
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() =>
                isSlowPlaying
                  ? onStopSpeaking()
                  : onSpeakText(message.text, `${message.id}-slow`, 0.78)
              }
              className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition ${
                isSlowPlaying
                  ? 'bg-cyan-500/20 text-cyan-300'
                  : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
              title="Play slowly at 0.78x speed"
            >
              {isSlowPlaying ? 'Playing 0.8x...' : '0.8x Slow'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
