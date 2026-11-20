export type Role = 'admin' | 'member' | 'guest';

export interface User {
  id: string;
  name: string;
  email: string;
  /** Salted SHA-256 of the password (hex). The plain password is never stored. */
  passwordHash?: string;
  salt?: string;
  /** Legacy plain-text password from older saved data. Migrated to passwordHash + salt on load, then removed. */
  password?: string;
  role: Role;
}
export type SessionUser = Omit<User, 'password' | 'passwordHash' | 'salt'>;

export type DeviceType = 'light' | 'plug' | 'thermostat' | 'lock' | 'camera' | 'router';

export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  roomId: string;
  vendor: string;
  online: boolean;
  on?: boolean; // light, plug, thermostat
  brightness?: number; // light, 0-100
  targetTemp?: number; // thermostat
  currentTemp?: number; // thermostat
  locked?: boolean; // lock
  streamUrl?: string; // camera
  clients?: number; // router: connected clients
}
export type NewDevice = Omit<Device, 'id'>;

/** Rooms are drawn on the floor plan using percentages (0-100) of the plan size. */
export interface Room {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface HomeConfig {
  name: string;
  latitude: number;
  longitude: number;
  radius: number; // metres
}

export type AutomationTrigger = 'arrive' | 'leave';
export interface AutomationAction {
  deviceId: string;
  patch: Partial<Device>;
}
export interface Automation {
  id: string;
  name: string;
  description: string;
  trigger: AutomationTrigger;
  enabled: boolean;
  actions: AutomationAction[];
}
