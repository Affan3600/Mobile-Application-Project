import {
  Automation,
  Device,
  HomeConfig,
  NewDevice,
  Role,
  Room,
  SessionUser,
} from '../types';

/**
 * Everything the app needs from a backend. Two implementations satisfy it: supabaseApi.ts (real, used when
 * EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY are set) and mockApi.ts (local, in-memory demo). The choice is made in
 * src/services/index.ts, and no screen code depends on which one is active.
 */
export interface SmartHomeApi {
  // auth + family members
  login(email: string, password: string): Promise<SessionUser>;
  /** Creates an account and signs it in. New accounts start as guests (the very first one on a fresh backend is admin). */
  register(name: string, email: string, password: string): Promise<SessionUser>;
  logout(): Promise<void>;
  /** The signed-in user with their current role, or null when signed out. Throws if the backend is unreachable. */
  getSessionUser(): Promise<SessionUser | null>;
  listUsers(): Promise<SessionUser[]>;
  setUserRole(userId: string, role: Role): Promise<void>;

  // home + devices
  getHome(): Promise<HomeConfig>;
  setHome(home: HomeConfig): Promise<void>;
  getRooms(): Promise<Room[]>;
  getDevices(): Promise<Device[]>;
  updateDevice(id: string, patch: Partial<Device>): Promise<Device>;
  addDevice(device: NewDevice): Promise<Device>;
  scanForDevices(): Promise<NewDevice[]>;

  // automations
  getAutomations(): Promise<Automation[]>;
  setAutomationEnabled(id: string, enabled: boolean): Promise<void>;

  // sync: call the callback whenever remote state changes (websocket / Firestore listener / polling)
  subscribe(onChange: () => void): () => void;

  resetDemoData(): Promise<void>;
}
