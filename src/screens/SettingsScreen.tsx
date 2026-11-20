import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Screen from '../components/Screen';
import { useAuth } from '../context/AuthContext';
import { useHome } from '../context/HomeContext';
import { api } from '../services';
import { Role, SessionUser } from '../types';
import { colors, radius, spacing } from '../theme';

const ROLES: Role[] = ['admin', 'member', 'guest'];
const ROLE_HELP: Record<Role, string> = {
  admin: 'Full control, adds devices, manages family',
  member: 'Controls devices and watches cameras',
  guest: 'Views device status only',
};

export default function SettingsScreen() {
  const navigation = useNavigation<any>();
  const { user, logout, canManage } = useAuth();
  const { refresh } = useHome();
  const [members, setMembers] = useState<SessionUser[]>([]);

  const load = useCallback(() => api.listUsers().then(setMembers), []);
  useEffect(() => {
    load();
  }, [load]);

  const setRole = async (id: string, role: Role) => {
    await api.setUserRole(id, role);
    await load();
  };

  const reset = () =>
    Alert.alert('Reset demo data?', 'Devices, automations and the home location go back to their starting values.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          await api.resetDemoData();
          await refresh();
          await load();
        },
      },
    ]);

  return (
    <Screen title="Settings" subtitle={user ? `${user.name} · ${user.email}` : undefined} showSearch={false}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.section}>Family access</Text>
        {members.map((m) => (
          <View key={m.id} style={styles.card}>
            <Text style={styles.name}>{m.name}{m.id === user?.id ? ' (you)' : ''}</Text>
            <Text style={styles.help}>{ROLE_HELP[m.role]}</Text>
            <View style={styles.roles}>
              {ROLES.map((r) => {
                const locked = !canManage || m.id === user?.id;
                return (
                  <Pressable
                    key={r}
                    disabled={locked}
                    onPress={() => setRole(m.id, r)}
                    style={[styles.role, m.role === r && styles.roleActive, locked && m.role !== r && styles.dim]}
                  >
                    <Text style={[styles.roleText, m.role === r && styles.roleTextActive]}>{r}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
        {!canManage ? <Text style={styles.help}>Only admins can change roles.</Text> : null}

        {canManage ? (
          <>
            <Text style={styles.section}>Devices</Text>
            <Pressable style={styles.button} onPress={() => navigation.navigate('Scanner')}>
              <Text style={styles.buttonText}>Scan for new devices</Text>
            </Pressable>
            <Pressable style={styles.buttonSecondary} onPress={reset}>
              <Text style={styles.buttonSecondaryText}>Reset demo data</Text>
            </Pressable>
          </>
        ) : null}

        <Pressable style={[styles.button, { backgroundColor: colors.danger, marginTop: spacing.xl }]} onPress={logout}>
          <Text style={styles.buttonText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  section: { fontSize: 14, fontWeight: '800', color: colors.primary, marginTop: spacing.sm },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.sm },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  help: { fontSize: 12, color: colors.textDim },
  roles: { flexDirection: 'row', gap: spacing.sm },
  role: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.surfaceAlt },
  roleActive: { backgroundColor: colors.primary },
  roleText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  roleTextActive: { color: '#fff' },
  dim: { opacity: 0.4 },
  button: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  buttonSecondary: { backgroundColor: colors.accentSoft, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center' },
  buttonSecondaryText: { color: colors.primary, fontWeight: '700', fontSize: 15 },
});
