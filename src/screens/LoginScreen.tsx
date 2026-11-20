import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { config } from '../config';
import { useAuth } from '../context/AuthContext';
import { useOrientation } from '../hooks/useOrientation';
import { colors, radius, spacing } from '../theme';

const DEMO = [
  { label: 'Admin', email: 'admin@smarthome.app', password: 'admin123' },
  { label: 'Family member', email: 'member@smarthome.app', password: 'member123' },
  { label: 'Guest', email: 'guest@smarthome.app', password: 'guest123' },
];

export default function LoginScreen() {
  const { login, register } = useAuth();
  const { isLandscape } = useOrientation();
  const [signUp, setSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (signUp) {
        if (password.length < 6) throw new Error('Use a password of at least 6 characters.');
        await register(name || email.split('@')[0], email, password);
      } else {
        await login(email, password);
      }
    } catch (e: any) {
      setError(e?.message ?? 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[styles.scroll, isLandscape && styles.scrollLandscape]} keyboardShouldPersistTaps="handled">
          <View style={[styles.brand, isLandscape && { flex: 1 }]}>
            <MaterialCommunityIcons name="home-automation" size={56} color={colors.primary} />
            <Text style={styles.title}>SmartHome</Text>
            <Text style={styles.tagline}>Every device in your home, one app.</Text>
          </View>

          <View style={[styles.form, isLandscape && { flex: 1 }]}>
            {signUp ? (
              <TextInput
                style={styles.input}
                placeholder="Your name"
                placeholderTextColor={colors.textDim}
                autoCapitalize="words"
                value={name}
                onChangeText={setName}
              />
            ) : null}
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={colors.textDim}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={colors.textDim}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={submit}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable style={[styles.button, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy || !email || !password}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{signUp ? 'Create account' : 'Sign in'}</Text>}
            </Pressable>

            <Pressable
              onPress={() => {
                setSignUp(!signUp);
                setError(null);
              }}
              hitSlop={8}
            >
              <Text style={styles.switchText}>{signUp ? 'Already have an account? Sign in' : 'New here? Create an account'}</Text>
            </Pressable>
            {signUp ? <Text style={styles.demoTitle}>New accounts start as guests until an admin changes their role. On a brand-new backend the first account becomes the admin.</Text> : null}

            {!config.useSupabase ? (
              <>
                <Text style={styles.demoTitle}>Demo accounts</Text>
                <View style={styles.demoRow}>
                  {DEMO.map((d) => (
                    <Pressable
                      key={d.label}
                      style={styles.chip}
                      onPress={() => {
                        setEmail(d.email);
                        setPassword(d.password);
                      }}
                    >
                      <Text style={styles.chipText}>{d.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, padding: spacing.xl, justifyContent: 'center', gap: spacing.xl },
  scrollLandscape: { flexDirection: 'row', alignItems: 'center' },
  brand: { alignItems: 'center', gap: spacing.sm },
  title: { fontSize: 34, fontWeight: '800', color: colors.primary },
  tagline: { fontSize: 15, color: colors.textDim },
  form: { gap: spacing.md },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.lg, height: 52, fontSize: 16, color: colors.text },
  error: { color: colors.danger, fontSize: 14 },
  button: { backgroundColor: colors.primary, borderRadius: radius.md, height: 52, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  switchText: { color: colors.accent, fontWeight: '700', fontSize: 14, textAlign: 'center', marginTop: spacing.sm },
  demoTitle: { marginTop: spacing.md, color: colors.textDim, fontSize: 13 },
  demoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { backgroundColor: colors.accentSoft, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  chipText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
});
