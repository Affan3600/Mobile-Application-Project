import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Speech from 'expo-speech';
import { useAuth } from '../context/AuthContext';
import { useHome } from '../context/HomeContext';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { parseCommand } from '../services/voiceCommands';
import { colors, radius, spacing } from '../theme';

interface Props {
  value?: string;
  onChangeText?: (text: string) => void;
}

/**
 * Search field with a microphone. Typing filters whatever list the screen shows (via onChangeText);
 * pressing return or speaking runs a command ("turn on the kitchen light", "open cameras").
 * Results are confirmed with spoken audio.
 */
export default function VoiceSearchBar({ value, onChangeText }: Props) {
  const navigation = useNavigation<any>();
  const { devices, updateDevice } = useHome();
  const { canControl } = useAuth();
  const { status, start, stopAndTranscribe } = useVoiceRecorder();
  const [inner, setInner] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const text = value ?? inner;
  const setText = onChangeText ?? setInner;

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const feedback = useCallback((display: string, spoken?: string) => {
    setMessage(display);
    if (spoken) {
      Speech.stop();
      Speech.speak(spoken);
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), 6000);
  }, []);

  const run = useCallback(
    async (utterance: string, source: 'typed' | 'voice') => {
      const intent = parseCommand(utterance, devices);
      const prefix = source === 'voice' ? `“${utterance}” → ` : '';

      if (intent.kind === 'unknown') {
        if (source === 'voice') feedback(prefix + intent.spoken, intent.spoken);
        return; // typed text that is not a command simply stays a filter
      }
      if (intent.kind === 'navigate') {
        navigation.navigate(intent.screen);
        feedback(prefix + intent.spoken, intent.spoken);
        return;
      }
      if (!canControl) {
        feedback('Your account is view-only, so devices cannot be changed.', 'Your account is view only.');
        return;
      }
      const online = intent.targets.filter((d) => d.online);
      if (!online.length) {
        feedback(`${prefix}That device is offline.`, 'That device is offline.');
        return;
      }
      try {
        await Promise.all(online.map((d) => updateDevice(d.id, intent.patch)));
        feedback(prefix + intent.spoken, intent.spoken);
      } catch {
        feedback('Could not reach the device. Try again.', 'Could not reach the device.');
      }
    },
    [devices, canControl, navigation, updateDevice, feedback],
  );

  const onMic = async () => {
    try {
      if (status === 'idle') {
        await start();
      } else if (status === 'recording') {
        const heard = await stopAndTranscribe();
        if (!heard) return feedback('No speech detected.');
        await run(heard, 'voice');
      }
    } catch (e: any) {
      feedback(e?.message ?? 'Voice input failed.');
    }
  };

  return (
    <View>
      <View style={styles.bar}>
        <MaterialCommunityIcons name="magnify" size={20} color={colors.textDim} />
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          onSubmitEditing={() => text.trim() && run(text, 'typed')}
          placeholder={status === 'recording' ? 'Listening… tap the mic to finish' : 'Search or say a command'}
          placeholderTextColor={colors.textDim}
          returnKeyType="search"
          autoCorrect={false}
        />
        {text.length > 0 && status === 'idle' ? (
          <Pressable onPress={() => setText('')} hitSlop={8}>
            <MaterialCommunityIcons name="close-circle" size={18} color={colors.textDim} />
          </Pressable>
        ) : null}
        <Pressable
          onPress={onMic}
          disabled={status === 'processing'}
          style={[styles.mic, status === 'recording' && styles.micActive]}
          accessibilityLabel={status === 'recording' ? 'Stop listening' : 'Start voice command'}
        >
          {status === 'processing' ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <MaterialCommunityIcons name={status === 'recording' ? 'stop' : 'microphone'} size={20} color="#fff" />
          )}
        </Pressable>
      </View>
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingLeft: spacing.md,
    paddingRight: 6,
    height: 48,
  },
  input: { flex: 1, color: colors.text, fontSize: 15 },
  mic: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  micActive: { backgroundColor: colors.warn },
  message: { marginTop: spacing.sm, color: colors.primary, fontSize: 13, fontWeight: '600' },
});
