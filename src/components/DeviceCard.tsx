import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Device } from '../types';
import { colors, radius, spacing } from '../theme';

interface Props {
  device: Device;
  roomName?: string;
  canControl: boolean;
  onChange: (patch: Partial<Device>) => void;
  onOpenCamera?: () => void;
}

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

function iconFor(d: Device): IconName {
  switch (d.type) {
    case 'light': return d.on ? 'lightbulb-on' : 'lightbulb-outline';
    case 'plug': return 'power-plug';
    case 'thermostat': return 'thermostat';
    case 'lock': return d.locked ? 'lock' : 'lock-open-variant';
    case 'camera': return 'cctv';
    case 'router': return 'router-wireless';
  }
}

export function isActive(d: Device) {
  if (!d.online) return false;
  switch (d.type) {
    case 'lock': return !!d.locked;
    case 'camera':
    case 'router': return true;
    default: return !!d.on;
  }
}

function statusText(d: Device) {
  if (!d.online) return 'Offline';
  switch (d.type) {
    case 'light': return d.on ? `On · ${d.brightness ?? 100}%` : 'Off';
    case 'plug': return d.on ? 'On' : 'Off';
    case 'thermostat': return d.on ? `Heating to ${d.targetTemp}° · now ${d.currentTemp}°` : `Off · now ${d.currentTemp}°`;
    case 'lock': return d.locked ? 'Locked' : 'Unlocked';
    case 'camera': return 'Live';
    case 'router': return `Online · ${d.clients ?? 0} connected`;
  }
}

function Stepper({ label, onMinus, onPlus, disabled }: { label: string; onMinus: () => void; onPlus: () => void; disabled: boolean }) {
  return (
    <View style={[styles.stepper, disabled && styles.dim]}>
      <Pressable onPress={onMinus} disabled={disabled} style={styles.stepBtn} hitSlop={6}>
        <MaterialCommunityIcons name="minus" size={18} color={colors.primary} />
      </Pressable>
      <Text style={styles.stepLabel}>{label}</Text>
      <Pressable onPress={onPlus} disabled={disabled} style={styles.stepBtn} hitSlop={6}>
        <MaterialCommunityIcons name="plus" size={18} color={colors.primary} />
      </Pressable>
    </View>
  );
}

export default function DeviceCard({ device: d, roomName, canControl, onChange, onOpenCamera }: Props) {
  const active = isActive(d);
  const disabled = !canControl || !d.online;

  return (
    <View style={[styles.card, active && styles.cardActive, !d.online && styles.cardOffline]}>
      <View style={styles.top}>
        <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
          <MaterialCommunityIcons name={iconFor(d)} size={24} color={active ? '#fff' : colors.textDim} />
        </View>
        <View style={styles.titles}>
          <Text style={styles.name} numberOfLines={1}>{d.name}</Text>
          <Text style={styles.meta} numberOfLines={1}>
            {[roomName, d.vendor].filter(Boolean).join(' · ')}
          </Text>
        </View>
        {(d.type === 'light' || d.type === 'plug' || d.type === 'thermostat') && (
          <Switch
            value={!!d.on}
            disabled={disabled}
            onValueChange={(v) => onChange({ on: v })}
            trackColor={{ true: colors.accent, false: colors.border }}
          />
        )}
      </View>

      <Text style={[styles.status, !d.online && { color: colors.danger }]}>{statusText(d)}</Text>

      {d.type === 'light' && d.on && d.online ? (
        <Stepper
          label={`Brightness ${d.brightness ?? 100}%`}
          disabled={disabled}
          onMinus={() => onChange({ brightness: Math.max(0, (d.brightness ?? 100) - 10) })}
          onPlus={() => onChange({ brightness: Math.min(100, (d.brightness ?? 100) + 10) })}
        />
      ) : null}

      {d.type === 'thermostat' && d.on && d.online ? (
        <Stepper
          label={`Target ${d.targetTemp}°C`}
          disabled={disabled}
          onMinus={() => onChange({ targetTemp: (d.targetTemp ?? 21) - 1 })}
          onPlus={() => onChange({ targetTemp: (d.targetTemp ?? 21) + 1 })}
        />
      ) : null}

      {d.type === 'lock' ? (
        <Pressable
          disabled={disabled}
          onPress={() => onChange({ locked: !d.locked })}
          style={[styles.action, disabled && styles.dim]}
        >
          <Text style={styles.actionText}>{d.locked ? 'Unlock' : 'Lock'}</Text>
        </Pressable>
      ) : null}

      {d.type === 'camera' && onOpenCamera ? (
        <Pressable disabled={!d.online || !canControl} onPress={onOpenCamera} style={[styles.action, (!d.online || !canControl) && styles.dim]}>
          <Text style={styles.actionText}>Watch live</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardActive: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  cardOffline: { opacity: 0.75 },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  iconWrapActive: { backgroundColor: colors.primary },
  titles: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  meta: { fontSize: 12, color: colors.textDim, marginTop: 1 },
  status: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 6, paddingVertical: 4 },
  stepBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  stepLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  action: { backgroundColor: colors.primary, borderRadius: radius.sm, paddingVertical: 10, alignItems: 'center' },
  actionText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  dim: { opacity: 0.45 },
});
