import { describe, expect, it } from 'vitest';
import {
  extractTranscriptParts,
  pickPreferredEnglishVoice,
  splitIntoSpeakableChunks,
} from '../utils/speechUtils';

describe('splitIntoSpeakableChunks', () => {
  it('splits multi-sentence replies on sentence boundaries', () => {
    const text = 'That is awesome! Tell me more about your weekend. Did you go anywhere?';
    expect(splitIntoSpeakableChunks(text)).toEqual([
      'That is awesome!',
      'Tell me more about your weekend.',
      'Did you go anywhere?',
    ]);
  });

  it('sub-splits very long single sentences at clauses to prevent Chrome TTS hangs', () => {
    const longClause =
      'First we practiced introducing ourselves clearly, then we talked about our favorite hobbies and weekend activities, and finally we reviewed a few helpful phrases for polite workplace requests and follow-up questions.';
    const chunks = splitIntoSpeakableChunks(longClause);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(180);
    }
  });

  it('returns an empty array for blank input', () => {
    expect(splitIntoSpeakableChunks('   \n  ')).toEqual([]);
  });
});

describe('pickPreferredEnglishVoice', () => {
  const mockVoice = (
    name: string,
    lang: string,
    isDefault = false
  ): SpeechSynthesisVoice =>
    ({
      voiceURI: name,
      name,
      lang,
      default: isDefault,
      localService: true,
    }) as SpeechSynthesisVoice;

  it('prefers saved voiceURI when present', () => {
    const voices = [
      mockVoice('Google US English', 'en-US'),
      mockVoice('Microsoft Zira', 'en-US'),
    ];
    expect(pickPreferredEnglishVoice(voices, 'Microsoft Zira')?.name).toBe(
      'Microsoft Zira'
    );
  });

  it('ranks natural/Google English voices ahead of generic ones', () => {
    const voices = [
      mockVoice('French Voice', 'fr-FR', true),
      mockVoice('Generic Desktop', 'en-US', true),
      mockVoice('Microsoft Aria Online (Natural)', 'en-US', false),
    ];
    expect(pickPreferredEnglishVoice(voices, undefined, 'en-US')?.name).toBe(
      'Microsoft Aria Online (Natural)'
    );
  });
});

describe('extractTranscriptParts', () => {
  it('separates final and interim transcripts without duplicating segments', () => {
    const results = [
      { isFinal: true, 0: { transcript: 'Yesterday I' } },
      { isFinal: true, 0: { transcript: 'went to' } },
      { isFinal: false, 0: { transcript: 'the market' } },
    ];
    expect(extractTranscriptParts(results)).toEqual({
      finalText: 'Yesterday I went to',
      interimText: 'the market',
    });
  });
});
