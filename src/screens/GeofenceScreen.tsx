import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import * as Location from 'expo-location';
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import Screen from '../components/Screen';
import { useAuth } from '../context/AuthContext';
import { useHome } from '../context/HomeContext';
import { useOrientation } from '../hooks/useOrientation';
import { runAutomations } from '../services/automations';
import { distanceMeters, isGeofenceRunning, startHomeGeofence, stopHomeGeofence } from '../tasks/geofence';
import { AutomationTrigger, HomeConfig } from '../types';
import { colors, radius, spacing } from '../theme';

const MIN_RADIUS = 100; // Android geofences below ~100 m are unreliable
const MAX_RADIUS = 500;

export default function GeofenceScreen() {
  const { home, automations, setHome, setAutomationEnabled } = useHome();
  const { canControl, canManage } = useAuth();
  const { isLandscape } = useOrientation();
  const mapRef = useRef<MapView>(null);
  const [monitoring, setMonitoring] = useState(false);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string | null>(null);
  const [me, setMe] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    isGeofenceRunning().then(setMonitoring).catch(() => {});
  }, []);

  // Follow the device's position so it can be drawn on the map.
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;
    (async () => {
      const perm = await Location.getForegroundPermissionsAsync();
      if (!perm.granted) return;
      const s = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 2000, distanceInterval: 0 },
        (loc) => setMe({ latitude: loc.coords.latitude, longitude: loc.coords.longitude }),
      );
      if (cancelled) s.remove();
      else sub = s;
    })().catch(() => {});
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, []);

  useEffect(() => {
    if (!home) return;
    mapRef.current?.animateToRegion(
      { latitude: home.latitude, longitude: home.longitude, latitudeDelta: 0.006, longitudeDelta: 0.006 },
      400,
    );
  }, [home?.latitude, home?.longitude]);

  if (!home) {
    return (
      <Screen title="Geofence" showSearch={false}>
        <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.primary} />
      </Screen>
    );
  }

  const saveHome = async (next: HomeConfig) => {
    await setHome(next);
    if (monitoring) await startHomeGeofence(next); // re-register with the new region
  };

  const toggleMonitoring = async (on: boolean) => {
    setBusy(true);
    try {
      if (on) await startHomeGeofence(home);
      else await stopHomeGeofence();
      setMonitoring(on);
    } catch (e: any) {
      Alert.alert('Geofence', e?.message ?? 'Could not change geofence monitoring.');
    } finally {
      setBusy(false);
    }
  };

  // Waits for a real position. watchPositionAsync keeps asking the OS until a fix arrives, which is far more
  // reliable than a single getCurrentPositionAsync call (especially on the emulator).
  const getFix = (timeoutMs: number) =>
    new Promise<Location.LocationObject>((resolve, reject) => {
      let done = false;
      let sub: Location.LocationSubscription | null = null;
      const finish = (fn: () => void) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        sub?.remove();
        fn();
      };
      const timer = setTimeout(() => finish(() => reject(new Error('timeout'))), timeoutMs);
      Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 1000, distanceInterval: 0, mayShowUserSettingsDialog: true },
        (loc) => finish(() => resolve(loc)),
      )
        .then((s) => {
          sub = s;
          if (done) s.remove();
        })
        .catch((e) => finish(() => reject(e)));
    });

  const useMyLocation = async () => {
    setBusy(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') throw new Error('Location permission is required.');
      if (!(await Location.hasServicesEnabledAsync())) {
        throw new Error('Location is turned off. Turn it on in Android quick settings, then try again.');
      }
      let pos: Location.LocationObject | null = null;
      try {
        pos = await getFix(30000);
      } catch {
        pos = await Location.getLastKnownPositionAsync();
      }
      if (!pos) {
        throw new Error(
          'Still no GPS fix. On the emulator, send a location (Extended controls > Location > Set Location) and tap again.',
        );
      }
      await saveHome({ ...home, latitude: pos.coords.latitude, longitude: pos.coords.longitude });
    } catch (e: any) {
      Alert.alert('Home location', e?.message ?? 'Could not read your location.');
    } finally {
      setBusy(false);
    }
  };

  const changeRadius = (delta: number) => {
    const next = Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, home.radius + delta));
    saveHome({ ...home, radius: next }).catch((e) => Alert.alert('Geofence', e?.message ?? 'Could not update the radius.'));
  };

  const simulate = async (trigger: AutomationTrigger) => {
    const n = await runAutomations(trigger);
    setLog(`${trigger === 'arrive' ? 'Arrived' : 'Left'}: ran ${n} automation${n === 1 ? '' : 's'}.`);
  };

  const map = (
    <View style={[styles.mapWrap, isLandscape ? { flex: 1.1 } : { height: 260 }]}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        initialRegion={{ latitude: home.latitude, longitude: home.longitude, latitudeDelta: 0.006, longitudeDelta: 0.006 }}
      >
        <Marker coordinate={{ latitude: home.latitude, longitude: home.longitude }} title={home.name} />
        {me ? <Marker coordinate={me} title="You are here" pinColor="#1E88E5" /> : null}
        <Circle
          center={{ latitude: home.latitude, longitude: home.longitude }}
          radius={home.radius}
          strokeColor={colors.primary}
          fillColor="rgba(18,164,219,0.22)"
          strokeWidth={2}
        />
      </MapView>
    </View>
  );

  const controls = (
    <ScrollView style={isLandscape ? { flex: 1 } : undefined} contentContainerStyle={styles.controls} keyboardShouldPersistTaps="handled">
      <Text style={styles.help}>
        {me
          ? `You are ${Math.round(distanceMeters(me.latitude, me.longitude, home.latitude, home.longitude))} m from home (${
              distanceMeters(me.latitude, me.longitude, home.latitude, home.longitude) <= home.radius ? 'inside' : 'outside'
            } the circle). Blue pin = you, red pin = home.`
          : 'Waiting for your position… send a location from the emulator.'}
      </Text>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Run automations automatically</Text>
          <Text style={styles.help}>Needs “Allow all the time” location access.</Text>
        </View>
        <Switch value={monitoring} onValueChange={toggleMonitoring} disabled={busy} trackColor={{ true: colors.accent, false: colors.border }} />
      </View>

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Radius: {home.radius} m</Text>
        </View>
        <Pressable style={[styles.small, !canManage && styles.dim]} disabled={!canManage} onPress={() => changeRadius(-50)}>
          <Text style={styles.smallText}>−50</Text>
        </Pressable>
        <Pressable style={[styles.small, !canManage && styles.dim]} disabled={!canManage} onPress={() => changeRadius(50)}>
          <Text style={styles.smallText}>+50</Text>
        </Pressable>
      </View>

      {canManage ? (
        <Pressable style={[styles.secondary, busy && styles.dim]} onPress={useMyLocation} disabled={busy}>
          {busy ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.secondaryText}>Set home to my current location</Text>}
        </Pressable>
      ) : null}

      <Text style={styles.section}>Automations</Text>
      {automations.map((a) => (
        <View key={a.id} style={styles.card}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>{a.name}</Text>
            <Text style={styles.help}>{a.trigger === 'arrive' ? 'When you arrive: ' : 'When you leave: '}{a.description}</Text>
          </View>
          <Switch
            value={a.enabled}
            disabled={!canControl}
            onValueChange={(v) => setAutomationEnabled(a.id, v)}
            trackColor={{ true: colors.accent, false: colors.border }}
          />
        </View>
      ))}

      {canControl ? (
        <>
          <Text style={styles.section}>Test without leaving the house</Text>
          <View style={styles.row}>
            <Pressable style={[styles.secondary, { flex: 1 }]} onPress={() => simulate('arrive')}>
              <Text style={styles.secondaryText}>Simulate arriving</Text>
            </Pressable>
            <Pressable style={[styles.secondary, { flex: 1 }]} onPress={() => simulate('leave')}>
              <Text style={styles.secondaryText}>Simulate leaving</Text>
            </Pressable>
          </View>
          {log ? <Text style={styles.help}>{log}</Text> : null}
        </>
      ) : null}
    </ScrollView>
  );

  return (
    <Screen title="Geofence" subtitle="Automations that follow you to and from home" showSearch={false}>
      <View style={[styles.layout, isLandscape && { flexDirection: 'row' }]}>
        {map}
        {controls}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  layout: { flex: 1, paddingHorizontal: spacing.lg, gap: spacing.md },
  mapWrap: { borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceAlt },
  controls: { gap: spacing.md, paddingBottom: spacing.xl },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  label: { fontSize: 15, fontWeight: '700', color: colors.text },
  help: { fontSize: 12, color: colors.textDim, marginTop: 2 },
  section: { fontSize: 14, fontWeight: '800', color: colors.primary, marginTop: spacing.sm },
  small: { backgroundColor: colors.surfaceAlt, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 8 },
  smallText: { color: colors.primary, fontWeight: '700' },
  secondary: { backgroundColor: colors.accentSoft, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center', paddingHorizontal: spacing.md },
  secondaryText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  dim: { opacity: 0.4 },
});
