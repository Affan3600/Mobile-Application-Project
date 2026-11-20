import { useRef, useState } from 'react';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';

export type VoiceStatus = 'idle' | 'recording' | 'processing';

const END_TIMEOUT_MS = 8000;

/**
 * On-device / OS speech recognition (Google on Android, Apple on iOS) via expo-speech-recognition.
 * No API key required. Same shape as the old Whisper-based hook so callers do not change.
 * Requires a development build (not Expo Go).
 */
export function useVoiceRecorder() {
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const transcript = useRef('');
  const lastError = useRef<string | null>(null);
  const endWaiter = useRef<(() => void) | null>(null);

  useSpeechRecognitionEvent('result', (e) => {
    const text = e.results[0]?.transcript;
    if (text) transcript.current = text;
  });

  useSpeechRecognitionEvent('error', (e) => {
    // "no-speech" and "aborted" are normal outcomes, not failures worth surfacing.
    if (e.error !== 'no-speech' && e.error !== 'aborted') lastError.current = e.message || e.error;
    endWaiter.current?.();
  });

  useSpeechRecognitionEvent('end', () => {
    endWaiter.current?.();
  });

  const start = async () => {
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) throw new Error('Microphone or speech recognition permission was denied.');
    if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
      throw new Error('Speech recognition is not available on this device.');
    }
    transcript.current = '';
    lastError.current = null;
    ExpoSpeechRecognitionModule.start({
      lang: 'en-US',
      interimResults: true,
      continuous: false,
      addsPunctuation: false,
    });
    setStatus('recording');
  };

  const stopAndTranscribe = async (): Promise<string> => {
    setStatus('processing');
    try {
      // stop() asks the recognizer to deliver a final result, then emits "end".
      const ended = new Promise<void>((resolve) => {
        endWaiter.current = resolve;
        setTimeout(resolve, END_TIMEOUT_MS);
      });
      ExpoSpeechRecognitionModule.stop();
      await ended;
      if (lastError.current && !transcript.current) throw new Error(`Voice input failed: ${lastError.current}`);
      return transcript.current.trim();
    } finally {
      endWaiter.current = null;
      setStatus('idle');
    }
  };

  return { status, start, stopAndTranscribe };
}
