import { useEffect } from 'react';
import * as Location from 'expo-location';
import { useHome } from '../context/HomeContext';
import { distanceMeters, evaluateFix, isEnabled, isGeofenceRunning } from '../tasks/geofence';

/**
 * Backup for the native geofence: while the app is open and monitoring is on, watch the position directly.
 * Android's own geofence events can be slow or never arrive (especially on the emulator); this does not depend on them.
 */
export default function ForegroundGeofence() {
  const { home } = useHome();

  useEffect(() => {
    if (!home) return;
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;
    let starting = false;

    const stop = () => {
      sub?.remove();
      sub = null;
    };

    const start = async () => {
      if (sub || starting) return;
      starting = true;
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (!perm.granted) return;
        const s = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 2000, distanceInterval: 0, mayShowUserSettingsDialog: true },
          (loc) => {
            const d = distanceMeters(loc.coords.latitude, loc.coords.longitude, home.latitude, home.longitude);
            evaluateFix(d, home.radius).catch(() => {});
          },
        );
        if (cancelled) s.remove();
        else sub = s;
      } finally {
        starting = false;
      }
    };

    const tick = async () => {
      // also covers monitoring that was switched on before this watcher existed
      if ((await isEnabled()) || (await isGeofenceRunning().catch(() => false))) await start();
      else stop();
    };

    tick();
    const id = setInterval(tick, 4000);
    return () => {
      cancelled = true;
      clearInterval(id);
      stop();
    };
  }, [home?.latitude, home?.longitude, home?.radius]);

  return null;
}
