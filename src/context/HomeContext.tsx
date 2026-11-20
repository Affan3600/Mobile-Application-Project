import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../services';
import { Automation, Device, HomeConfig, NewDevice, Room } from '../types';
import { useAuth } from './AuthContext';

interface HomeState {
  loading: boolean;
  devices: Device[];
  rooms: Room[];
  home: HomeConfig | null;
  automations: Automation[];
  refresh: () => Promise<void>;
  updateDevice: (id: string, patch: Partial<Device>) => Promise<void>;
  addDevice: (device: NewDevice) => Promise<void>;
  setHome: (home: HomeConfig) => Promise<void>;
  setAutomationEnabled: (id: string, enabled: boolean) => Promise<void>;
}

const Ctx = createContext<HomeState | null>(null);

export function HomeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [home, setHomeState] = useState<HomeConfig | null>(null);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [d, r, h, a] = await Promise.all([api.getDevices(), api.getRooms(), api.getHome(), api.getAutomations()]);
    setDevices(d);
    setRooms(r);
    setHomeState(h);
    setAutomations(a);
    setLoading(false);
  }, []);

  // Load once signed in (a real backend returns nothing to anonymous users).
  useEffect(() => {
    if (user) refresh().catch(() => setLoading(false));
  }, [user?.id, refresh]);

  // Live sync: the api notifies us whenever state changes (another user, a geofence automation, ...).
  useEffect(
    () =>
      api.subscribe(() => {
        refresh().catch(() => {});
      }),
    [refresh],
  );

  const updateDevice = useCallback(
    async (id: string, patch: Partial<Device>) => {
      setDevices((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d))); // optimistic
      try {
        await api.updateDevice(id, patch);
      } catch (e) {
        await refresh(); // roll back to server truth
        throw e;
      }
    },
    [refresh],
  );

  const value = useMemo<HomeState>(
    () => ({
      loading,
      devices,
      rooms,
      home,
      automations,
      refresh,
      updateDevice,
      addDevice: async (device) => {
        await api.addDevice(device);
      },
      setHome: async (h) => {
        await api.setHome(h);
      },
      setAutomationEnabled: async (id, enabled) => {
        await api.setAutomationEnabled(id, enabled);
      },
    }),
    [loading, devices, rooms, home, automations, refresh, updateDevice],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useHome() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useHome must be used inside HomeProvider');
  return v;
}
