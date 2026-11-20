import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { config } from '../config';
import {
  Automation,
  Device,
  HomeConfig,
  NewDevice,
  Role,
  Room,
  SessionUser,
  User,
} from '../types';
import { SmartHomeApi } from './api';
import { SCAN_CATALOG, STREAM } from './demoCatalog';

const KEY = 'smarthome.db.v1';
const SESSION_KEY = 'smarthome.session.v2'; // id of the signed-in user

interface Db {
  users: User[];
  rooms: Room[];
  devices: Device[];
  automations: Automation[];
  home: HomeConfig;
}

const seed = (): Db => ({
  users: [
    { id: 'u1', name: 'Admin', email: 'admin@smarthome.app', password: 'admin123', role: 'admin' },
    { id: 'u2', name: 'Family Member', email: 'member@smarthome.app', password: 'member123', role: 'member' },
    { id: 'u3', name: 'Guest', email: 'guest@smarthome.app', password: 'guest123', role: 'guest' },
  ],
  rooms: [
    { id: 'living', name: 'Living Room', x: 0, y: 0, w: 55, h: 50 },
    { id: 'kitchen', name: 'Kitchen', x: 55, y: 0, w: 45, h: 50 },
    { id: 'bedroom', name: 'Bedroom', x: 0, y: 50, w: 40, h: 50 },
    { id: 'entry', name: 'Entry', x: 40, y: 50, w: 25, h: 50 },
    { id: 'garage', name: 'Garage', x: 65, y: 50, w: 35, h: 50 },
  ],
  devices: [
    { id: 'd1', name: 'Living Room Light', type: 'light', roomId: 'living', vendor: 'Philips Hue', online: true, on: true, brightness: 70 },
    { id: 'd2', name: 'Kitchen Light', type: 'light', roomId: 'kitchen', vendor: 'IKEA Tradfri', online: true, on: false, brightness: 100 },
    { id: 'd3', name: 'Bedroom Lamp', type: 'light', roomId: 'bedroom', vendor: 'TP-Link Kasa', online: true, on: false, brightness: 40 },
    { id: 'd4', name: 'Coffee Maker', type: 'plug', roomId: 'kitchen', vendor: 'TP-Link Kasa', online: true, on: false },
    { id: 'd5', name: 'Living Room Thermostat', type: 'thermostat', roomId: 'living', vendor: 'Nest', online: true, on: true, targetTemp: 21, currentTemp: 20 },
    { id: 'd6', name: 'Front Door Lock', type: 'lock', roomId: 'entry', vendor: 'August', online: true, locked: true },
    { id: 'd7', name: 'Garage Door Lock', type: 'lock', roomId: 'garage', vendor: 'Yale', online: true, locked: true },
    { id: 'd8', name: 'Front Door Camera', type: 'camera', roomId: 'entry', vendor: 'Ring', online: true, streamUrl: STREAM },
    { id: 'd9', name: 'Garage Camera', type: 'camera', roomId: 'garage', vendor: 'Wyze', online: true, streamUrl: STREAM },
    { id: 'd10', name: 'Wi-Fi Router', type: 'router', roomId: 'living', vendor: 'TP-Link', online: true, clients: 14 },
  ],
  automations: [
    {
      id: 'a1',
      name: 'Welcome home',
      description: 'Lights on, heat up to 22°, unlock the front door',
      trigger: 'arrive',
      enabled: true,
      actions: [
        { deviceId: 'd1', patch: { on: true, brightness: 70 } },
        { deviceId: 'd5', patch: { on: true, targetTemp: 22 } },
        { deviceId: 'd6', patch: { locked: false } },
      ],
    },
    {
      id: 'a2',
      name: 'Leaving home',
      description: 'Lights off, lock both doors, heat down to 17°',
      trigger: 'leave',
      enabled: true,
      actions: [
        { deviceId: 'd1', patch: { on: false } },
        { deviceId: 'd2', patch: { on: false } },
        { deviceId: 'd3', patch: { on: false } },
        { deviceId: 'd6', patch: { locked: true } },
        { deviceId: 'd7', patch: { locked: true } },
        { deviceId: 'd5', patch: { targetTemp: 17 } },
      ],
    },
  ],
  // Default: Ontario Tech University campus. Change it from the Geofence screen.
  home: { name: 'Home', latitude: 43.9453, longitude: -78.8964, radius: 150 },
});

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const toSession = ({ password: _p, passwordHash: _h, salt: _s, ...rest }: User): SessionUser => rest;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Demo-grade password storage: a random salt per user plus SHA-256, so plain passwords are never saved.
// expo-crypto has no slow KDF (PBKDF2/scrypt/argon2), so a real backend should handle this instead.
async function hashPassword(password: string, salt: string) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${password}`);
}
async function newSalt() {
  const bytes = await Crypto.getRandomBytesAsync(16);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
async function withHashedPassword(user: User, password: string): Promise<User> {
  const salt = await newSalt();
  const { password: _legacy, ...rest } = user;
  return { ...rest, salt, passwordHash: await hashPassword(password, salt) };
}

export class MockSmartHomeApi implements SmartHomeApi {
  private db: Db | null = null;
  private loading: Promise<Db> | null = null;
  private listeners = new Set<() => void>();

  private load(): Promise<Db> {
    if (this.db) return Promise.resolve(this.db);
    // Share one in-flight load so concurrent callers do not each seed or migrate the data.
    this.loading ??= this.loadFromStorage().finally(() => {
      this.loading = null;
    });
    return this.loading;
  }
  private async loadFromStorage(): Promise<Db> {
    const raw = await AsyncStorage.getItem(KEY);
    const db = raw ? (JSON.parse(raw) as Db) : seed();
    // Seed accounts and data saved by older versions hold plain-text passwords: hash them once, then drop them.
    let changed = !raw;
    db.users = await Promise.all(
      db.users.map(async (u) => {
        if (u.password === undefined) return u;
        changed = true;
        return withHashedPassword(u, u.password);
      }),
    );
    this.db = db;
    if (changed) await this.persist();
    return db;
  }
  private async persist() {
    if (this.db) await AsyncStorage.setItem(KEY, JSON.stringify(this.db));
  }
  private async commit() {
    await this.persist();
    this.listeners.forEach((l) => l());
  }
  private async delay() {
    await sleep(config.mockLatencyMs);
  }

  subscribe(onChange: () => void) {
    this.listeners.add(onChange);
    return () => {
      this.listeners.delete(onChange);
    };
  }

  async login(email: string, password: string) {
    const db = await this.load();
    await this.delay();
    const user = db.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    const ok = !!user?.salt && !!user.passwordHash && (await hashPassword(password, user.salt)) === user.passwordHash;
    if (!user || !ok) throw new Error('Incorrect email or password.');
    await AsyncStorage.setItem(SESSION_KEY, user.id);
    return toSession(user);
  }
  async register(name: string, email: string, password: string) {
    const db = await this.load();
    await this.delay();
    const clean = email.trim().toLowerCase();
    if (!EMAIL_RE.test(clean)) throw new Error('Enter a valid email address.');
    if (password.length < 6) throw new Error('Use a password of at least 6 characters.');
    if (db.users.some((u) => u.email.toLowerCase() === clean)) throw new Error('An account with that email already exists.');
    const user = await withHashedPassword(
      { id: `u${Date.now()}`, name: name.trim() || clean.split('@')[0], email: clean, role: 'guest' },
      password,
    );
    db.users.push(user);
    await this.commit();
    await AsyncStorage.setItem(SESSION_KEY, user.id);
    return toSession(user);
  }
  async logout() {
    await AsyncStorage.removeItem(SESSION_KEY);
  }
  async getSessionUser() {
    const id = await AsyncStorage.getItem(SESSION_KEY);
    if (!id) return null;
    const user = (await this.load()).users.find((u) => u.id === id);
    return user ? toSession(user) : null;
  }
  async listUsers() {
    const db = await this.load();
    return db.users.map(toSession);
  }
  async setUserRole(userId: string, role: Role) {
    const db = await this.load();
    const u = db.users.find((x) => x.id === userId);
    if (!u) throw new Error('User not found.');
    u.role = role;
    await this.commit();
  }

  async getHome() {
    return clone((await this.load()).home);
  }
  async setHome(home: HomeConfig) {
    const db = await this.load();
    db.home = home;
    await this.commit();
  }
  async getRooms() {
    return clone((await this.load()).rooms);
  }
  async getDevices() {
    return clone((await this.load()).devices);
  }
  async updateDevice(id: string, patch: Partial<Device>) {
    const db = await this.load();
    const d = db.devices.find((x) => x.id === id);
    if (!d) throw new Error('Device not found.');
    await this.delay();
    Object.assign(d, patch);
    if (d.brightness !== undefined) d.brightness = clamp(d.brightness, 0, 100);
    if (d.targetTemp !== undefined) d.targetTemp = clamp(d.targetTemp, 10, 30);
    await this.commit();
    return clone(d);
  }
  async addDevice(device: NewDevice) {
    const db = await this.load();
    const created: Device = { ...device, id: `d${Date.now()}` };
    db.devices.push(created);
    await this.commit();
    return clone(created);
  }
  async scanForDevices() {
    const db = await this.load();
    await sleep(1800); // pretend to scan the network
    return SCAN_CATALOG.filter((f) => !db.devices.some((d) => d.name === f.name));
  }

  async getAutomations() {
    return clone((await this.load()).automations);
  }
  async setAutomationEnabled(id: string, enabled: boolean) {
    const db = await this.load();
    const a = db.automations.find((x) => x.id === id);
    if (a) a.enabled = enabled;
    await this.commit();
  }

  /** Resets devices, rooms, automations and the home location. Registered accounts are kept so people stay able to sign in. */
  async resetDemoData() {
    const { users } = await this.load();
    this.db = { ...seed(), users };
    await this.commit();
  }
}
