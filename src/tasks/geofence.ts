import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { runAutomations } from '../services/automations';
import { HomeConfig } from '../types';

export const GEOFENCE_TASK = 'smarthome-geofence';

const K_STATE = 'smarthome.geo.state';
const K_ENABLED = 'smarthome.geo.enabled';
const K_LOG = 'smarthome.geo.log';
const MARGIN_M = 15; // hysteresis so GPS jitter at the edge does not cause repeated triggers

export type GeoState = 'inside' | 'outside';
export interface GeoLogEntry {
  at: string;
  text: string;
}

export async function getLog(): Promise<GeoLogEntry[]> {
  try {
    return JSON.parse((await AsyncStorage.getItem(K_LOG)) ?? '[]');
  } catch {
    return [];
  }
}

export async function addLog(text: string) {
  const log = await getLog();
  log.unshift({ at: new Date().toISOString(), text });
  await AsyncStorage.setItem(K_LOG, JSON.stringify(log.slice(0, 15)));
}

export const isEnabled = async () => (await AsyncStorage.getItem(K_ENABLED)) === '1';

/**
 * Single place where "inside/outside" changes are decided. Both the native Android geofence and the
 * foreground location watcher call this, and automations only run when the state actually changes.
 * The first reading after monitoring starts just records where you are.
 */
export async function handleTransition(next: GeoState, source: 'native' | 'foreground', detail?: string) {
  const prev = (await AsyncStorage.getItem(K_STATE)) as GeoState | null;
  if (prev === next) return;
  await AsyncStorage.setItem(K_STATE, next);
  const where = `${source}${detail ? `, ${detail}` : ''}`;
  if (!prev) {
    await addLog(`Starting position: ${next} (${where})`);
    return;
  }
  const n = await runAutomations(next === 'inside' ? 'arrive' : 'leave');
  await addLog(`${next === 'inside' ? 'Arrived' : 'Left'} (${where}): ran ${n} automation${n === 1 ? '' : 's'}`);
}

/** Decides inside/outside from a distance, with a small margin around the edge. */
export async function evaluateFix(distanceM: number, radiusM: number) {
  const prev = (await AsyncStorage.getItem(K_STATE)) as GeoState | null;
  let next: GeoState;
  if (!prev) next = distanceM <= radiusM ? 'inside' : 'outside';
  else if (prev === 'inside') next = distanceM > radiusM + MARGIN_M ? 'outside' : 'inside';
  else next = distanceM < radiusM - MARGIN_M ? 'inside' : 'outside';
  await handleTransition(next, 'foreground', `${Math.round(distanceM)} m from home`);
}

export function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Must be defined at module scope so it is registered when the app (or its headless background task) starts.
TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }) => {
  if (error) return;
  const { eventType } = data as { eventType: Location.GeofencingEventType };
  if (eventType === Location.GeofencingEventType.Enter) await handleTransition('inside', 'native');
  else if (eventType === Location.GeofencingEventType.Exit) await handleTransition('outside', 'native');
});

export async function startHomeGeofence(home: HomeConfig) {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') throw new Error('Location permission is required.');
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== 'granted') throw new Error('Background location ("Allow all the time") is required for geofencing.');
  await AsyncStorage.removeItem(K_STATE); // forget the old position so the next reading is a fresh start
  await AsyncStorage.setItem(K_ENABLED, '1');
  await Location.startGeofencingAsync(GEOFENCE_TASK, [
    {
      identifier: 'home',
      latitude: home.latitude,
      longitude: home.longitude,
      radius: home.radius,
      notifyOnEnter: true,
      notifyOnExit: true,
    },
  ]);
  await addLog('Monitoring started');
}

export async function stopHomeGeofence() {
  await AsyncStorage.setItem(K_ENABLED, '0');
  if (await Location.hasStartedGeofencingAsync(GEOFENCE_TASK)) {
    await Location.stopGeofencingAsync(GEOFENCE_TASK);
  }
  await addLog('Monitoring stopped');
}

export const isGeofenceRunning = () => Location.hasStartedGeofencingAsync(GEOFENCE_TASK);
