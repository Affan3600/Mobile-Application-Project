import { Device, DeviceType } from '../types';

export type ScreenName = 'Devices' | 'Floor Plan' | 'Cameras' | 'Geofence' | 'Settings';

export type Intent =
  | { kind: 'navigate'; screen: ScreenName; spoken: string }
  | { kind: 'device'; targets: Device[]; patch: Partial<Device>; spoken: string }
  | { kind: 'unknown'; spoken: string };

const NAV: [RegExp, ScreenName][] = [
  [/\b(camera|cameras|feed|feeds|live)\b/, 'Cameras'],
  [/\b(map|floor|plan|layout)\b/, 'Floor Plan'],
  [/\b(geofence|location|automation|automations|arrive|leave)\b/, 'Geofence'],
  [/\b(settings|account|members|family|profile)\b/, 'Settings'],
  [/\b(devices|device|list|dashboard|home)\b/, 'Devices'],
];

const TYPE_WORDS: Record<DeviceType, string[]> = {
  light: ['light', 'lights', 'lamp', 'lamps'],
  plug: ['plug', 'plugs', 'outlet'],
  thermostat: ['thermostat', 'heat', 'heating', 'temperature'],
  lock: ['lock', 'unlock', 'locks'],
  camera: ['camera', 'cameras'],
  router: ['wifi', 'router', 'internet'],
};

const tokens = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

function score(d: Device, toks: Set<string>) {
  let s = 0;
  for (const w of tokens(d.name)) if (w.length > 2 && (toks.has(w) || toks.has(w + 's'))) s += 1;
  if (TYPE_WORDS[d.type].some((w) => toks.has(w))) s += 1;
  return s;
}

function detectPatch(text: string, d: Device): Partial<Device> | null {
  if (d.type === 'lock') {
    if (/\b(unlock|open)\b/.test(text)) return { locked: false };
    if (/\block\b/.test(text)) return { locked: true };
    return null;
  }
  if (d.type === 'thermostat') {
    const m = text.match(/\b(\d{2})\b/);
    if (m && /\b(set|to|degrees)\b/.test(text)) return { on: true, targetTemp: Number(m[1]) };
  }
  if (d.type === 'light') {
    const m = text.match(/\b(\d{1,3})\s*(%|percent)/);
    if (m) return { on: true, brightness: Math.min(100, Number(m[1])) };
  }
  if (d.type === 'light' || d.type === 'plug' || d.type === 'thermostat') {
    if (/\boff\b/.test(text)) return { on: false };
    if (/\bon\b/.test(text)) return { on: true };
  }
  return null;
}

function describe(patch: Partial<Device>) {
  if (patch.locked === true) return 'locked';
  if (patch.locked === false) return 'unlocked';
  if (patch.targetTemp !== undefined) return `set to ${patch.targetTemp} degrees`;
  if (patch.brightness !== undefined) return `set to ${patch.brightness} percent`;
  if (patch.on === true) return 'turned on';
  if (patch.on === false) return 'turned off';
  return 'updated';
}

export function parseCommand(raw: string, devices: Device[]): Intent {
  const text = raw.toLowerCase().replace(/[.,!?]/g, '').trim();
  if (!text) return { kind: 'unknown', spoken: 'I did not catch that.' };

  const toks = new Set(tokens(text));
  const wantsAll = toks.has('all') || toks.has('every');
  const scored = devices
    .map((d) => ({ d, s: score(d, toks) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);

  if (scored.length) {
    const top = scored[0];
    const group = wantsAll
      ? scored.filter((x) => x.d.type === top.d.type).map((x) => x.d)
      : scored.filter((x) => x.s === top.s).map((x) => x.d);
    const actionable = group.filter((d) => detectPatch(text, d));
    if (actionable.length) {
      if (actionable.length > 1 && !wantsAll) {
        return { kind: 'unknown', spoken: `Which one: ${actionable.map((d) => d.name).join(' or ')}?` };
      }
      const patch = detectPatch(text, actionable[0])!;
      return {
        kind: 'device',
        targets: actionable,
        patch,
        spoken: `${actionable.map((d) => d.name).join(' and ')} ${describe(patch)}`,
      };
    }
  }

  for (const [re, screen] of NAV) {
    if (re.test(text)) return { kind: 'navigate', screen, spoken: `Opening ${screen}` };
  }
  return { kind: 'unknown', spoken: 'Sorry, I did not understand that.' };
}
