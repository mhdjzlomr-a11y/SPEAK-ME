import { describe, expect, it } from 'vitest';
import {
  blobToBase64,
  formatRecordingDuration,
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
});
