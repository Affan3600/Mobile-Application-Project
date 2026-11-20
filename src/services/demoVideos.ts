/**
 * Bundled demo footage, keyed by camera device id. Used instead of a network stream so the Cameras tab
 * plays offline. Cameras without an entry fall back to their device.streamUrl.
 * To use a different clip, drop it in assets/videos/ and point the ids below at it.
 */
const GARAGE_FOOTAGE = require('../../assets/videos/garage-cam.mov') as number;

export const DEMO_VIDEOS: Record<string, number> = {
  d8: GARAGE_FOOTAGE, // Front Door Camera (same clip for now)
  d9: GARAGE_FOOTAGE, // Garage Camera
};
