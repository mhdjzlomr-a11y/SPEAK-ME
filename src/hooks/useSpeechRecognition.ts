import { useCallback, useEffect, useRef, useState } from 'react';
import {
  extractTranscriptParts,
  type TranscriptResultItem,
} from '../utils/speechUtils';

interface SpeechRecognitionErrorEventLike {
  error: string;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<TranscriptResultItem>;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
}

function mapRecognitionError(code: string): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone permission was denied. Please allow mic access in browser settings.';
    case 'no-speech':
      return 'No speech was detected. Try speaking a bit louder or closer to the mic.';
    case 'audio-capture':
      return 'No microphone was found. Check your audio input or use text input below.';
    case 'network':
      return 'Speech recognition needs an internet connection in this browser.';
    default:
      return `Microphone error (${code}). Please try again or type your message.`;
  }
}

export interface UseSpeechRecognitionOptions {
  lang: string;
  autoSendOnSilence: boolean;
  silenceDelayMs?: number;
  onFinalTranscript: (transcript: string) => void;
}

export function useSpeechRecognition(options: UseSpeechRecognitionOptions) {
  const {
    lang,
    autoSendOnSilence,
    silenceDelayMs = 1700,
    onFinalTranscript,
  } = options;

  const isSupported = getSpeechRecognitionConstructor() !== null;
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [finalText, setFinalText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const latestTranscriptRef = useRef('');
  const submitOnEndRef = useRef(false);
  const abortedIntentionallyRef = useRef(false);

  const onFinalTranscriptRef = useRef(onFinalTranscript);
  onFinalTranscriptRef.current = onFinalTranscript;

  const autoSendRef = useRef(autoSendOnSilence);
  autoSendRef.current = autoSendOnSilence;

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current !== null) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const stopAndSubmit = useCallback(() => {
    clearSilenceTimer();
    submitOnEndRef.current = true;
    try {
      recognitionRef.current?.stop();
    } catch {
      // Recognition may already be stopping.
    }
  }, [clearSilenceTimer]);

  const abort = useCallback(() => {
    clearSilenceTimer();
    submitOnEndRef.current = false;
    abortedIntentionallyRef.current = true;
    latestTranscriptRef.current = '';
    setInterimText('');
    setFinalText('');
    setIsListening(false);
    try {
      recognitionRef.current?.abort();
    } catch {
      // Ignore abort errors when already stopped.
    }
    recognitionRef.current = null;
  }, [clearSilenceTimer]);

  const start = useCallback(() => {
    const RecognitionCtor = getSpeechRecognitionConstructor();
    if (!RecognitionCtor) {
      setError('Speech recognition is not supported in this browser. Use Chrome or Edge, or type below.');
      return;
    }

    abort();
    setError(null);
    abortedIntentionallyRef.current = false;
    submitOnEndRef.current = false;
    latestTranscriptRef.current = '';

    const recognition = new RecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      const extracted = extractTranscriptParts(event.results);
      setFinalText(extracted.finalText);
      setInterimText(extracted.interimText);

      const combined = [extracted.finalText, extracted.interimText]
        .filter(Boolean)
        .join(' ')
        .trim();
      latestTranscriptRef.current = combined;

      clearSilenceTimer();
      if (autoSendRef.current && extracted.finalText.length > 0 && !extracted.interimText) {
        silenceTimerRef.current = window.setTimeout(() => {
          stopAndSubmit();
        }, silenceDelayMs);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
      if (abortedIntentionallyRef.current || event.error === 'aborted') {
        return;
      }
      clearSilenceTimer();
      submitOnEndRef.current = false;
      setIsListening(false);
      setError(mapRecognitionError(event.error));
    };

    recognition.onend = () => {
      clearSilenceTimer();
      setIsListening(false);
      recognitionRef.current = null;

      const transcriptToSend = latestTranscriptRef.current.trim();
      const shouldSubmit = submitOnEndRef.current && transcriptToSend.length > 0;

      submitOnEndRef.current = false;
      latestTranscriptRef.current = '';
      setInterimText('');
      setFinalText('');

      if (shouldSubmit && !abortedIntentionallyRef.current) {
        onFinalTranscriptRef.current(transcriptToSend);
      }
    };

    try {
      recognition.start();
    } catch {
      setIsListening(false);
      setError('Could not start microphone listening. Please try again.');
    }
  }, [abort, clearSilenceTimer, lang, silenceDelayMs, stopAndSubmit]);

  useEffect(() => {
    return () => {
      abort();
    };
  }, [abort]);

  return {
    isSupported,
    isListening,
    interimText,
    finalText,
    error,
    clearError: () => setError(null),
    start,
    stopAndSubmit,
    abort,
  };
}
