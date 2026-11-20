import { NewDevice } from '../types';

export const STREAM = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'; // public HLS test stream

/** What the pretend network scan "discovers". Shared by every backend, since a phone cannot really sweep a LAN yet. */
export const SCAN_CATALOG: NewDevice[] = [
  { name: 'Hallway Light', type: 'light', roomId: 'entry', vendor: 'Philips Hue', online: true, on: false, brightness: 80 },
  { name: 'Space Heater Plug', type: 'plug', roomId: 'bedroom', vendor: 'TP-Link Kasa', online: true, on: false },
  { name: 'Bedroom Thermostat', type: 'thermostat', roomId: 'bedroom', vendor: 'Ecobee', online: true, on: false, targetTemp: 20, currentTemp: 19 },
  { name: 'Back Door Lock', type: 'lock', roomId: 'kitchen', vendor: 'Schlage', online: true, locked: true },
  { name: 'Kitchen Camera', type: 'camera', roomId: 'kitchen', vendor: 'Eufy', online: true, streamUrl: STREAM },
];
