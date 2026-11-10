import { describe, expect, it } from 'vitest';
import {
  blobToBase64,
  formatRecordingDuration,
  inlineAudioToPlayableBlob,
  normalizeAudioMimeType,
} from '../utils/audioUtils';

describe('audioUtils', () => {
  it('strips codec parameters from recorded audio MIME types', () => {
    expect(normalizeAudioMimeType('audio/webm;codecs=opus')).toBe('audio/webm');
    expect(normalizeAudioMimeType('AUDIO/OGG;codecs=opus')).toBe('audio/ogg');
    expect(normalizeAudioMimeType('')).toBe('audio/webm');
    expect(normalizeAudioMimeType('application/octet-stream')).toBe('audio/webm');
  });

  it('converts an audio Blob into a raw Base64 string', async () => {
    const blob = new Blob([new Uint8Array([72, 101, 108, 108, 111])], {
      type: 'audio/webm',
    });
    const base64 = await blobToBase64(blob);
    expect(base64).toBe(btoa('Hello'));
  });

  it('formats elapsed recording seconds cleanly', () => {
    expect(formatRecordingDuration(0)).toBe('0:00');
    expect(formatRecordingDuration(9)).toBe('0:09');
    expect(formatRecordingDuration(65)).toBe('1:05');
  });

  it('prepends a RIFF/WAVE header when Gemini TTS returns raw PCM audio', async () => {
    const pcmBase64 = btoa('\x01\x00\x02\x00');
    const wavBlob = inlineAudioToPlayableBlob(
      pcmBase64,
      'audio/L16;codec=pcm;rate=24000'
    );

    expect(wavBlob.type).toBe('audio/wav');
    expect(wavBlob.size).toBe(48);

    const bytes = new Uint8Array(await wavBlob.arrayBuffer());
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('RIFF');
    expect(String.fromCharCode(...bytes.slice(8, 12))).toBe('WAVE');
    expect(new DataView(bytes.buffer).getUint32(24, true)).toBe(24000);
  });
});
