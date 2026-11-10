import { useCallback, useEffect, useRef, useState } from 'react';
import {
  blobToBase64,
  normalizeAudioMimeType,
  pickSupportedRecorderMimeType,
} from '../utils/audioUtils';

const MAX_RECORDING_SECONDS = 90;
const MIN_RECORDING_MS = 350;

function mapMediaError(err: unknown): string {
  const name = err instanceof DOMException ? err.name : '';
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return 'Microphone permission was denied. Please allow mic access in your browser.';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No microphone was found on this device. Connect a mic or type below.';
    case 'NotReadableError':
    case 'TrackStartError':
      return 'Your microphone is being used by another app. Close it and try again.';
    default:
      return 'Could not start microphone recording. Check your mic permissions or type below.';
  }
}

export interface UseAudioRecorderOptions {
  onAudioReady: (audioBase64: string, mimeType: string) => void;
}

export function useAudioRecorder(options: UseAudioRecorderOptions) {
  const isSupported =
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== 'undefined';

  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);
  const submitOnStopRef = useRef(false);
  const cancelledRef = useRef(false);

  const onAudioReadyRef = useRef(options.onAudioReady);
  onAudioReadyRef.current = options.onAudioReady;

  const cleanupMedia = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    recorderRef.current = null;
    setIsRecording(false);
    setElapsedSeconds(0);
  }, []);

  const abort = useCallback(() => {
    cancelledRef.current = true;
    submitOnStopRef.current = false;
    chunksRef.current = [];
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch {
        // Ignore stop errors during cleanup.
      }
    }
    cleanupMedia();
  }, [cleanupMedia]);

  const stopAndSubmit = useCallback(() => {
    submitOnStopRef.current = true;
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch {
        cleanupMedia();
      }
    }
  }, [cleanupMedia]);

  const start = useCallback(async () => {
    if (!isSupported) {
      setError('Microphone recording is not supported in this browser. Please type below.');
      return;
    }

    abort();
    setError(null);
    cancelledRef.current = false;
    submitOnStopRef.current = false;
    chunksRef.current = [];

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      setError(mapMediaError(err));
      return;
    }

    if (cancelledRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    streamRef.current = stream;
    const preferredMimeType = pickSupportedRecorderMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = preferredMimeType
        ? new MediaRecorder(stream, { mimeType: preferredMimeType })
        : new MediaRecorder(stream);
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setError('Could not initialize audio recorder in this browser.');
      return;
    }

    recorderRef.current = recorder;
    startedAtRef.current = Date.now();
    setIsRecording(true);
    setElapsedSeconds(0);

    recorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    recorder.onstop = async () => {
      const durationMs = Date.now() - startedAtRef.current;
      const shouldSubmit = submitOnStopRef.current && !cancelledRef.current;
      const recordedChunks = chunksRef.current;
      const mimeType = normalizeAudioMimeType(
        recorder.mimeType || recordedChunks[0]?.type
      );

      chunksRef.current = [];
      submitOnStopRef.current = false;
      cleanupMedia();

      if (!shouldSubmit) return;

      const audioBlob = new Blob(recordedChunks, { type: mimeType });
      if (durationMs < MIN_RECORDING_MS || audioBlob.size === 0) {
        setError('Recording was too short. Speak a sentence before tapping send.');
        return;
      }

      try {
        const base64 = await blobToBase64(audioBlob);
        onAudioReadyRef.current(base64, mimeType);
      } catch {
        setError('Could not process the recorded audio. Please try again.');
      }
    };

    recorder.start(250);

    timerRef.current = window.setInterval(() => {
      const secs = Math.floor((Date.now() - startedAtRef.current) / 1000);
      setElapsedSeconds(secs);
      if (secs >= MAX_RECORDING_SECONDS) {
        stopAndSubmit();
      }
    }, 500);
  }, [abort, cleanupMedia, isSupported, stopAndSubmit]);

  useEffect(() => {
    return () => {
      abort();
    };
  }, [abort]);

  return {
    isSupported,
    isRecording,
    elapsedSeconds,
    error,
    clearError: () => setError(null),
    start,
    stopAndSubmit,
    abort,
  };
}
