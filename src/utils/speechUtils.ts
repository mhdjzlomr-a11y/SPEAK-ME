export interface TranscriptResultItem {
  isFinal: boolean;
  0?: { transcript?: string };
}

export interface ExtractedTranscript {
  finalText: string;
  interimText: string;
}

const MAX_CHUNK_CHARS = 180;

/**
 * Split AI speech output into natural sentence-sized chunks so Chromium's
 * speechSynthesis engine does not silently stall on long single utterances.
 */
export function splitIntoSpeakableChunks(text: string): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];

  const sentences = normalized.split(/(?<=[.!?])\s+/).filter(Boolean);
  const chunks: string[] = [];

  for (const sentence of sentences) {
    if (sentence.length <= MAX_CHUNK_CHARS) {
      chunks.push(sentence);
      continue;
    }

    // Sub-split unusually long sentences on clause punctuation while preserving words.
    const clauses = sentence.split(/(?<=[,;:])\s+/).filter(Boolean);
    let buffer = '';
    for (const clause of clauses) {
      if (!buffer) {
        buffer = clause;
      } else if (`${buffer} ${clause}`.length <= MAX_CHUNK_CHARS) {
        buffer = `${buffer} ${clause}`;
      } else {
        chunks.push(buffer);
        buffer = clause;
      }
    }
    if (buffer) chunks.push(buffer);
  }

  return chunks;
}

/**
 * Rank browser voices to pick the cleanest English voice when the user has
 * not explicitly chosen a saved voice URI.
 */
export function pickPreferredEnglishVoice(
  voices: SpeechSynthesisVoice[],
  savedURI?: string,
  preferredLang = 'en-US'
): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;

  if (savedURI) {
    const exactSaved = voices.find((voice) => voice.voiceURI === savedURI);
    if (exactSaved) return exactSaved;
  }

  const englishVoices = voices.filter((voice) =>
    voice.lang.toLowerCase().startsWith('en')
  );
  if (englishVoices.length === 0) return null;

  const targetLang = preferredLang.toLowerCase();

  const scoreVoice = (voice: SpeechSynthesisVoice): number => {
    let score = 0;
    const name = voice.name.toLowerCase();
    const lang = voice.lang.toLowerCase();

    if (name.includes('natural') || name.includes('neural')) score += 45;
    if (name.includes('google') || name.includes('online')) score += 35;
    if (name.includes('aria') || name.includes('jenny') || name.includes('samantha')) score += 15;
    if (lang === targetLang) score += 25;
    else if (lang === 'en-us' || lang === 'en-gb') score += 12;
    if (voice.default) score += 5;
    return score;
  };

  return [...englishVoices].sort((a, b) => scoreVoice(b) - scoreVoice(a))[0];
}

/**
 * Scan the cumulative SpeechRecognitionResultList to prevent duplicate words
 * across browsers (especially Android Chrome continuous mode).
 */
export function extractTranscriptParts(
  results: ArrayLike<TranscriptResultItem>
): ExtractedTranscript {
  const finalParts: string[] = [];
  const interimParts: string[] = [];

  for (let i = 0; i < results.length; i++) {
    const item = results[i];
    const segment = item?.[0]?.transcript?.trim() ?? '';
    if (!segment) continue;

    if (item.isFinal) {
      finalParts.push(segment);
    } else {
      interimParts.push(segment);
    }
  }

  return {
    finalText: finalParts.join(' ').trim(),
    interimText: interimParts.join(' ').trim(),
  };
}
