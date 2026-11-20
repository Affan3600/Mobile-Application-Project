import React, { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Screen from '../components/Screen';
import DeviceCard from '../components/DeviceCard';
import { useAuth } from '../context/AuthContext';
import { useHome } from '../context/HomeContext';
import { useOrientation } from '../hooks/useOrientation';
import { DeviceType } from '../types';
import { colors, spacing } from '../theme';

type Filter = DeviceType | 'all';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'light', label: 'Lights' },
  { key: 'plug', label: 'Plugs' },
  { key: 'thermostat', label: 'Climate' },
  { key: 'lock', label: 'Locks' },
  { key: 'camera', label: 'Cameras' },
  { key: 'router', label: 'Network' },
];

export default function DashboardScreen() {
  const navigation = useNavigation<any>();
  const { devices, rooms, loading, refresh, updateDevice } = useHome();
  const { user, canControl, canManage } = useAuth();
  const { width, isLandscape } = useOrientation();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [refreshing, setRefreshing] = useState(false);

  const roomName = (id: string) => rooms.find((r) => r.id === id)?.name;
  const cols = width > 900 ? 3 : isLandscape ? 2 : 1;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return devices.filter((d) => {
      if (filter !== 'all' && d.type !== filter) return false;
      if (!q) return true;
      return d.name.toLowerCase().includes(q) || (roomName(d.roomId) ?? '').toLowerCase().includes(q) || d.vendor.toLowerCase().includes(q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devices, rooms, query, filter]);

  const activeCount = devices.filter((d) => d.online && (d.on || d.type === 'camera')).length;
  const offlineCount = devices.filter((d) => !d.online).length;

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  return (
    <Screen
      title="My home"
      subtitle={`${devices.length} devices · ${activeCount} active · ${offlineCount} offline${user ? ` · ${user.role}` : ''}`}
      searchValue={query}
      onSearchChange={setQuery}
    >
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {FILTERS.map((f) => (
            <Pressable key={f.key} onPress={() => setFilter(f.key)} style={[styles.chip, filter === f.key && styles.chipActive]}>
              <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>{f.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.primary} />
      ) : (
        <FlatList
          key={`cols-${cols}`}
          data={visible}
          keyExtractor={(d) => d.id}
          numColumns={cols}
          {...(cols > 1 ? { columnWrapperStyle: { gap: spacing.md } } : {})}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<Text style={styles.empty}>No devices match “{query}”. Clear the search or pick another filter.</Text>}
          renderItem={({ item }) => (
            <View style={{ flex: 1 }}>
              <DeviceCard
                device={item}
                roomName={roomName(item.roomId)}
                canControl={canControl}
                onChange={(patch) => updateDevice(item.id, patch).catch(() => {})}
                onOpenCamera={() => navigation.navigate('Cameras')}
              />
            </View>
          )}
        />
      )}

      {canManage ? (
        <Pressable style={styles.fab} onPress={() => navigation.navigate('Scanner')} accessibilityLabel="Scan for devices">
          <MaterialCommunityIcons name="radar" size={22} color="#fff" />
          <Text style={styles.fabText}>Add device</Text>
        </Pressable>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.md },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.surfaceAlt },
  chipActive: { backgroundColor: colors.primary },
  chipText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  chipTextActive: { color: '#fff' },
  list: { paddingHorizontal: spacing.lg, paddingBottom: 96 },
  empty: { textAlign: 'center', color: colors.textDim, marginTop: spacing.xl, paddingHorizontal: spacing.xl },
  fab: { position: 'absolute', right: spacing.lg, bottom: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.warn, borderRadius: 999, paddingHorizontal: spacing.lg, height: 48 },
  fabText: { color: '#fff', fontWeight: '700' },
});
