const PREFERRED_RECORDING_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/mp4',
];

/**
 * Strip codec parameters (e.g. "audio/webm;codecs=opus" -> "audio/webm")
 * so Gemini inlineData receives a clean standard audio MIME type.
 */
export function normalizeAudioMimeType(rawType?: string): string {
  const base = rawType?.split(';')[0]?.trim().toLowerCase();
  if (!base || !base.startsWith('audio/')) {
    return 'audio/webm';
  }
  return base;
}

/**
 * Pick the best supported MediaRecorder MIME type in the current browser.
 */
export function pickSupportedRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return undefined;
  }
  return PREFERRED_RECORDING_MIME_TYPES.find((mime) =>
    MediaRecorder.isTypeSupported(mime)
  );
}

/**
 * Convert an audio Blob into a raw Base64 string (without data-URI prefix)
 * using chunked conversion to avoid stack overflows on longer recordings.
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  const binaryParts: string[] = [];

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binaryParts.push(String.fromCharCode(...slice));
  }

  return btoa(binaryParts.join(''));
}

export function formatRecordingDuration(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.max(0, Math.floor(totalSeconds % 60));
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function createWavHeader(pcmByteLength: number, sampleRate: number): Uint8Array {
  const buffer = new ArrayBuffer(44);
  const view = new DataView(buffer);
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);

  const writeAscii = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + pcmByteLength, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM subchunk size
  view.setUint16(20, 1, true); // AudioFormat = 1 (PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeAscii(36, 'data');
  view.setUint32(40, pcmByteLength, true);

  return new Uint8Array(buffer);
}

/**
 * Convert Gemini TTS inlineData audio into a browser-playable audio Blob.
 * Preview TTS models return raw headerless 24kHz 16-bit PCM (audio/L16;codec=pcm;rate=24000),
 * which needs a standard 44-byte WAV header for universal HTMLAudioElement playback.
 */
export function inlineAudioToPlayableBlob(
  base64Data: string,
  mimeType = 'audio/L16;codec=pcm;rate=24000'
): Blob {
  const bytes = base64ToUint8Array(base64Data);
  const lowerMime = mimeType.toLowerCase();
  const baseMime = lowerMime.split(';')[0]?.trim() || 'audio/wav';

  const isRawPcm =
    lowerMime.includes('pcm') ||
    lowerMime.includes('l16') ||
    (!baseMime.includes('wav') &&
      !baseMime.includes('mp3') &&
      !baseMime.includes('mpeg') &&
      !baseMime.includes('ogg') &&
      !baseMime.includes('mp4') &&
      !baseMime.includes('aac') &&
      !baseMime.includes('webm'));

  if (!isRawPcm) {
    const copy = new Uint8Array(bytes.length);
    copy.set(bytes);
    return new Blob([copy.buffer], { type: baseMime });
  }

  const rateMatch = lowerMime.match(/rate=(\d+)/);
  const sampleRate = rateMatch ? Number(rateMatch[1]) || 24000 : 24000;
  const header = createWavHeader(bytes.byteLength, sampleRate);
  const combined = new Uint8Array(header.byteLength + bytes.byteLength);
  combined.set(header, 0);
  combined.set(bytes, header.byteLength);
  return new Blob([combined.buffer], { type: 'audio/wav' });
}
