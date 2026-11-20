import { AutomationTrigger } from '../types';
import { api } from './index';

/** Runs every enabled automation for the trigger. Safe to call from the background geofence task. */
export async function runAutomations(trigger: AutomationTrigger): Promise<number> {
  const all = await api.getAutomations();
  const matching = all.filter((a) => a.enabled && a.trigger === trigger);
  for (const automation of matching) {
    for (const action of automation.actions) {
      try {
        await api.updateDevice(action.deviceId, action.patch);
      } catch {
        // device may have been removed; keep going
      }
    }
  }
  return matching.length;
}
