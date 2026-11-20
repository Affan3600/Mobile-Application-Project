import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Screen from '../components/Screen';
import DeviceCard, { isActive } from '../components/DeviceCard';
import { useAuth } from '../context/AuthContext';
import { useHome } from '../context/HomeContext';
import { useOrientation } from '../hooks/useOrientation';
import { Device } from '../types';
import { colors, radius, spacing } from '../theme';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
const PIN_ICONS: Record<Device['type'], IconName> = {
  light: 'lightbulb',
  plug: 'power-plug',
  thermostat: 'thermostat',
  lock: 'lock',
  camera: 'cctv',
  router: 'router-wireless',
};
const PIN = 36;

export default function FloorPlanScreen() {
  const navigation = useNavigation<any>();
  const { rooms, devices, updateDevice } = useHome();
  const { canControl } = useAuth();
  const { width, height, isLandscape } = useOrientation();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const planW = isLandscape ? Math.max(240, Math.min(width * 0.55, (height - 150) / 0.8)) : width - spacing.lg * 2;
  const planH = planW * 0.8;
  const selected = devices.find((d) => d.id === selectedId) ?? null;

  const plan = (
    <View style={[styles.plan, { width: planW, height: planH }]}>
      {rooms.map((r) => (
        <View
          key={r.id}
          style={[styles.room, { left: (r.x / 100) * planW, top: (r.y / 100) * planH, width: (r.w / 100) * planW, height: (r.h / 100) * planH }]}
        >
          <Text style={styles.roomLabel}>{r.name}</Text>
        </View>
      ))}
      {rooms.map((r) => {
        const inRoom = devices.filter((d) => d.roomId === r.id);
        return inRoom.map((d, i) => {
          const cx = ((r.x + (r.w * (i + 1)) / (inRoom.length + 1)) / 100) * planW;
          const cy = ((r.y + r.h * 0.62) / 100) * planH;
          const active = isActive(d);
          return (
            <Pressable
              key={d.id}
              onPress={() => setSelectedId(d.id === selectedId ? null : d.id)}
              style={[
                styles.pin,
                { left: cx - PIN / 2, top: cy - PIN / 2 },
                active && styles.pinActive,
                !d.online && styles.pinOffline,
                d.id === selectedId && styles.pinSelected,
              ]}
              accessibilityLabel={d.name}
            >
              <MaterialCommunityIcons name={PIN_ICONS[d.type]} size={20} color={active ? '#fff' : colors.textDim} />
            </Pressable>
          );
        });
      })}
    </View>
  );

  const panel = selected ? (
    <DeviceCard
      device={selected}
      roomName={rooms.find((r) => r.id === selected.roomId)?.name}
      canControl={canControl}
      onChange={(patch) => updateDevice(selected.id, patch).catch(() => {})}
      onOpenCamera={() => navigation.navigate('Cameras')}
    />
  ) : (
    <Text style={styles.hint}>Tap a device on the plan to control it.</Text>
  );

  return (
    <Screen title="Floor plan" subtitle="Blue = on or locked, grey = off, red outline = offline">
      <ScrollView contentContainerStyle={[styles.content, isLandscape && styles.contentLandscape]}>
        {plan}
        <View style={isLandscape ? { flex: 1 } : { width: '100%' }}>{panel}</View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  contentLandscape: { flexDirection: 'row', alignItems: 'flex-start' },
  plan: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 2, borderColor: colors.primary, overflow: 'hidden' },
  room: { position: 'absolute', borderWidth: 1, borderColor: colors.border, padding: 6 },
  roomLabel: { fontSize: 11, fontWeight: '700', color: colors.textDim },
  pin: { position: 'absolute', width: PIN, height: PIN, borderRadius: PIN / 2, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  pinActive: { backgroundColor: colors.accent },
  pinOffline: { borderColor: colors.danger },
  pinSelected: { borderColor: colors.primary, transform: [{ scale: 1.15 }] },
  hint: { color: colors.textDim, fontSize: 14, paddingTop: spacing.sm },
});
