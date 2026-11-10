import { useCallback, useEffect, useRef, useState } from 'react';
import { synthesizeSpeechWithGemini } from '../services/gemini';
import type { VoiceEngine } from '../types/conversation';
import { inlineAudioToPlayableBlob } from '../utils/audioUtils';
import {
  pickPreferredEnglishVoice,
  splitIntoSpeakableChunks,
} from '../utils/speechUtils';

const SILENT_WAV_DATA_URI =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
const MAX_CACHED_AUDIO_CLIPS = 25;

export interface SpeakOptions {
  id?: string;
  rate?: number;
  voiceEngine?: VoiceEngine;
  apiKey?: string;
  geminiVoiceName?: string;
  preferredVoiceURI?: string;
  preferredLang?: string;
  onEnd?: () => void;
}

export function useSpeechSynthesis() {
  const isBrowserTtsSupported =
    typeof window !== 'undefined' && 'speechSynthesis' in window;
  const isAudioElementSupported = typeof Audio !== 'undefined';
  const isSupported = isBrowserTtsSupported || isAudioElementSupported;

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Generation counter prevents canceled audio callbacks from clobbering new speech.
  const generationRef = useRef(0);
  const unlockedRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ttsAbortRef = useRef<AbortController | null>(null);
  const audioCacheRef = useRef<Map<string, string>>(new Map());

  const getOrCreateAudio = useCallback((): HTMLAudioElement | null => {
    if (!isAudioElementSupported) return null;
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    return audioRef.current;
  }, [isAudioElementSupported]);

  /**
   * Synchronously prime both HTMLAudioElement and speechSynthesis inside a user tap
   * so async AI voice replies play aloud reliably on iPhone Safari and Chrome iOS.
   */
  const unlock = useCallback(() => {
    if (unlockedRef.current) return;
    unlockedRef.current = true;

    const audio = getOrCreateAudio();
    if (audio) {
      try {
        audio.src = SILENT_WAV_DATA_URI;
        audio.volume = 0.01;
        const p = audio.play();
        if (p && typeof p.catch === 'function') {
          p.catch(() => {});
        }
      } catch {
        // Ignore primer restrictions on restricted devices.
      }
    }

    if (
      isBrowserTtsSupported &&
      typeof SpeechSynthesisUtterance !== 'undefined'
    ) {
      try {
        const primer = new SpeechSynthesisUtterance('');
        primer.volume = 0;
        window.speechSynthesis.speak(primer);
      } catch {
        // Ignore unlock failures on restricted devices.
      }
    }
  }, [getOrCreateAudio, isBrowserTtsSupported]);

  useEffect(() => {
    if (isBrowserTtsSupported) {
      const syncVoices = () => {
        const available = window.speechSynthesis.getVoices();
        if (available.length > 0) {
          setVoices(available);
        }
      };

      syncVoices();
      window.speechSynthesis.addEventListener?.('voiceschanged', syncVoices);

      return () => {
        window.speechSynthesis.removeEventListener?.('voiceschanged', syncVoices);
        generationRef.current += 1;
        ttsAbortRef.current?.abort();
        window.speechSynthesis.cancel();
      };
    }
    return undefined;
  }, [isBrowserTtsSupported]);

  useEffect(() => {
    const cache = audioCacheRef.current;
    return () => {
      ttsAbortRef.current?.abort();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
      }
      for (const objectUrl of cache.values()) {
        URL.revokeObjectURL(objectUrl);
      }
      cache.clear();
    };
  }, []);

  const stop = useCallback(() => {
    generationRef.current += 1;
    ttsAbortRef.current?.abort();
    ttsAbortRef.current = null;

    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.pause();
      try {
        audioRef.current.currentTime = 0;
      } catch {
        // Ignore currentTime reset errors if no media loaded.
      }
    }

    if (isBrowserTtsSupported) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setActiveId(null);
  }, [isBrowserTtsSupported]);

  const speakWithBrowser = useCallback(
    (text: string, currentGen: number, options: SpeakOptions) => {
      if (!isBrowserTtsSupported) {
        if (generationRef.current === currentGen) {
          setIsSpeaking(false);
          setActiveId(null);
          options.onEnd?.();
        }
        return;
      }

      const chunks = splitIntoSpeakableChunks(text);
      if (chunks.length === 0) {
        if (generationRef.current === currentGen) {
          setIsSpeaking(false);
          setActiveId(null);
          options.onEnd?.();
        }
        return;
      }

      window.speechSynthesis.cancel();
      const currentVoices =
        voices.length > 0 ? voices : window.speechSynthesis.getVoices();
      const selectedVoice = pickPreferredEnglishVoice(
        currentVoices,
        options.preferredVoiceURI,
        options.preferredLang
      );

      const speakChunkAt = (index: number) => {
        if (generationRef.current !== currentGen) return;
        if (index >= chunks.length) {
          setIsSpeaking(false);
          setActiveId(null);
          options.onEnd?.();
          return;
        }

        const utterance = new SpeechSynthesisUtterance(chunks[index]);
        if (selectedVoice) {
          utterance.voice = selectedVoice;
          utterance.lang = selectedVoice.lang;
        } else {
          utterance.lang = options.preferredLang || 'en-US';
        }
        utterance.rate = options.rate ?? 1.0;
        utterance.pitch = 1.0;

        utterance.onend = () => {
          if (generationRef.current !== currentGen) return;
          speakChunkAt(index + 1);
        };

        utterance.onerror = () => {
          if (generationRef.current !== currentGen) return;
          setIsSpeaking(false);
          setActiveId(null);
        };

        window.speechSynthesis.speak(utterance);
      };

      speakChunkAt(0);
    },
    [isBrowserTtsSupported, voices]
  );

  const speak = useCallback(
    (text: string, options: SpeakOptions = {}) => {
      const cleaned = text.trim();
      if (!cleaned) {
        options.onEnd?.();
        return;
      }

      stop();
      generationRef.current += 1;
      const currentGen = generationRef.current;

      setIsSpeaking(true);
      setActiveId(options.id ?? null);

      const useGeminiVoice =
        (options.voiceEngine ?? 'gemini') === 'gemini' &&
        Boolean(options.apiKey?.trim()) &&
        isAudioElementSupported &&
        typeof URL !== 'undefined' &&
        typeof URL.createObjectURL === 'function';

      if (!useGeminiVoice) {
        speakWithBrowser(cleaned, currentGen, options);
        return;
      }

      const voiceName = options.geminiVoiceName || 'Aoede';
      const cacheKey = `${voiceName}::${cleaned}`;
      const controller = new AbortController();
      ttsAbortRef.current = controller;

      const playBlobUrl = async (objectUrl: string) => {
        const audio = getOrCreateAudio();
        if (!audio || generationRef.current !== currentGen) return;

        audio.onended = () => {
          if (generationRef.current !== currentGen) return;
          setIsSpeaking(false);
          setActiveId(null);
          options.onEnd?.();
        };

        audio.onerror = () => {
          if (generationRef.current !== currentGen) return;
          speakWithBrowser(cleaned, currentGen, options);
        };

        audio.src = objectUrl;
        audio.volume = 1;
        audio.playbackRate = options.rate ?? 1.0;

        try {
          await audio.play();
        } catch {
          if (generationRef.current !== currentGen) return;
          speakWithBrowser(cleaned, currentGen, options);
        }
      };

      const cachedUrl = audioCacheRef.current.get(cacheKey);
      if (cachedUrl) {
        void playBlobUrl(cachedUrl);
        return;
      }

      void (async () => {
        try {
          const result = await synthesizeSpeechWithGemini({
            apiKey: options.apiKey!,
            text: cleaned,
            voiceName,
            signal: controller.signal,
          });

          if (generationRef.current !== currentGen) return;

          const wavBlob = inlineAudioToPlayableBlob(
            result.audioBase64,
            result.mimeType
          );
          const objectUrl = URL.createObjectURL(wavBlob);

          if (audioCacheRef.current.size >= MAX_CACHED_AUDIO_CLIPS) {
            const oldestKey = audioCacheRef.current.keys().next().value;
            if (oldestKey) {
              const oldUrl = audioCacheRef.current.get(oldestKey);
              if (oldUrl) URL.revokeObjectURL(oldUrl);
              audioCacheRef.current.delete(oldestKey);
            }
          }
          audioCacheRef.current.set(cacheKey, objectUrl);

          await playBlobUrl(objectUrl);
        } catch (err) {
          if (
            (err instanceof DOMException && err.name === 'AbortError') ||
            generationRef.current !== currentGen
          ) {
            return;
          }
          // Fall back seamlessly to browser TTS if Gemini TTS hits quota or network limits.
          speakWithBrowser(cleaned, currentGen, options);
        }
      })();
    },
    [getOrCreateAudio, isAudioElementSupported, speakWithBrowser, stop]
  );

  return {
    isSupported,
    voices,
    isSpeaking,
    activeId,
    speak,
    stop,
    unlock,
  };
}
