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
