import { useCallback, useEffect, useRef, useState } from 'react';
import {
  pickPreferredEnglishVoice,
  splitIntoSpeakableChunks,
} from '../utils/speechUtils';

export interface SpeakOptions {
  id?: string;
  rate?: number;
  preferredVoiceURI?: string;
  preferredLang?: string;
  onEnd?: () => void;
}

export function useSpeechSynthesis() {
  const isSupported =
    typeof window !== 'undefined' && 'speechSynthesis' in window;

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Generation counter prevents canceled utterance callbacks from resetting new speech.
  const generationRef = useRef(0);
  const unlockedRef = useRef(false);

  /**
   * Synchronously prime iOS Safari / Chrome iOS speechSynthesis during a user tap
   * so async AI replies can still play aloud once the network request completes.
   */
  const unlock = useCallback(() => {
    if (
      !isSupported ||
      unlockedRef.current ||
      typeof SpeechSynthesisUtterance === 'undefined'
    ) {
      return;
    }
    try {
      const primer = new SpeechSynthesisUtterance('');
      primer.volume = 0;
      window.speechSynthesis.speak(primer);
      unlockedRef.current = true;
    } catch {
      // Ignore unlock failures on restricted devices.
    }
  }, [isSupported]);

  useEffect(() => {
    if (!isSupported) return;

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
      window.speechSynthesis.cancel();
    };
  }, [isSupported]);

  const stop = useCallback(() => {
    generationRef.current += 1;
    if (isSupported) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setActiveId(null);
  }, [isSupported]);

  const speak = useCallback(
    (text: string, options: SpeakOptions = {}) => {
      if (!isSupported) {
        options.onEnd?.();
        return;
      }

      const chunks = splitIntoSpeakableChunks(text);
      if (chunks.length === 0) {
        options.onEnd?.();
        return;
      }

      generationRef.current += 1;
      const currentGen = generationRef.current;

      window.speechSynthesis.cancel();
      setIsSpeaking(true);
      setActiveId(options.id ?? null);

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
    [isSupported, voices]
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
