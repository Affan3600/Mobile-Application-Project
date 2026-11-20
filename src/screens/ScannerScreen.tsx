import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHome } from '../context/HomeContext';
import { api } from '../services';
import { NewDevice } from '../types';
import { colors, radius, spacing } from '../theme';

export default function ScannerScreen() {
  const navigation = useNavigation();
  const { rooms, addDevice } = useHome();
  const [scanning, setScanning] = useState(false);
  const [found, setFound] = useState<NewDevice[] | null>(null);
  const [added, setAdded] = useState<string[]>([]);

  const scan = async () => {
    setScanning(true);
    try {
      setFound(await api.scanForDevices());
    } finally {
      setScanning(false);
    }
  };

  const add = async (d: NewDevice) => {
    await addDevice(d);
    setAdded((prev) => [...prev, d.name]);
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Add devices</Text>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Text style={styles.done}>Done</Text>
        </Pressable>
      </View>

      <Pressable style={[styles.scan, scanning && { opacity: 0.6 }]} onPress={scan} disabled={scanning}>
        {scanning ? <ActivityIndicator color="#fff" /> : <MaterialCommunityIcons name="radar" size={20} color="#fff" />}
        <Text style={styles.scanText}>{scanning ? 'Scanning your network…' : found ? 'Scan again' : 'Scan for devices'}</Text>
      </Pressable>

      <FlatList
        data={found ?? []}
        keyExtractor={(d) => d.name}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {found ? 'No new devices found. Make sure they are powered on and on the same Wi-Fi.' : 'Scan to find smart devices on your Wi-Fi.'}
          </Text>
        }
        renderItem={({ item }) => {
          const done = added.includes(item.name);
          return (
            <View style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>{item.vendor} · {rooms.find((r) => r.id === item.roomId)?.name ?? 'Unassigned'}</Text>
              </View>
              <Pressable style={[styles.add, done && styles.addDone]} disabled={done} onPress={() => add(item)}>
                <Text style={[styles.addText, done && { color: colors.ok }]}>{done ? 'Added' : 'Add'}</Text>
              </Pressable>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg },
  title: { fontSize: 24, fontWeight: '800', color: colors.primary },
  done: { fontSize: 16, fontWeight: '700', color: colors.accent },
  scan: { marginHorizontal: spacing.lg, flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: radius.md, height: 50 },
  scanText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  empty: { textAlign: 'center', color: colors.textDim, marginTop: spacing.xl, paddingHorizontal: spacing.xl },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  meta: { fontSize: 12, color: colors.textDim, marginTop: 2 },
  add: { backgroundColor: colors.primary, borderRadius: 999, paddingHorizontal: spacing.lg, paddingVertical: 8 },
  addDone: { backgroundColor: colors.surfaceAlt },
  addText: { color: '#fff', fontWeight: '700' },
});
