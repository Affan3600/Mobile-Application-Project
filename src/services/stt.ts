import { config } from '../config';

export interface SpeechToText {
  transcribe(audioUri: string): Promise<string>;
}

/** OpenAI Whisper, either directly (dev) or through your own proxy (production). */
class WhisperStt implements SpeechToText {
  async transcribe(audioUri: string) {
    const viaProxy = !!config.sttProxyUrl;
    if (!viaProxy && !config.openAiKey) {
      throw new Error('Set EXPO_PUBLIC_OPENAI_API_KEY (dev) or EXPO_PUBLIC_STT_PROXY_URL in .env.');
    }
    const form = new FormData();
    form.append('file', { uri: audioUri, name: 'speech.m4a', type: 'audio/m4a' } as any);
    form.append('model', 'whisper-1');
    form.append('language', 'en');

    const res = await fetch(viaProxy ? config.sttProxyUrl : 'https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: viaProxy ? {} : { Authorization: `Bearer ${config.openAiKey}` },
      body: form,
    });
    if (!res.ok) throw new Error(`Transcription failed (HTTP ${res.status}).`);
    const json = await res.json();
    return String(json.text ?? '').trim();
  }
}

/**
 * Placeholder. Google Speech-to-Text does not accept the AAC/.m4a files that both platforms record by default,
 * so it needs a different recording format (LINEAR16/FLAC/OGG_OPUS) or a server-side transcoding step.
 */
class GoogleStt implements SpeechToText {
  async transcribe(_audioUri: string): Promise<string> {
    throw new Error('Google speech-to-text is not implemented yet. Use the whisper provider.');
  }
}

export const stt: SpeechToText = config.sttProvider === 'google' ? new GoogleStt() : new WhisperStt();
