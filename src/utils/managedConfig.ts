import type { ManagedConfigurationMap } from './ManagedConfigModule';
import {
  applyManagedConfigurationFromRegistry,
  type ManagedConfigApplyResult,
} from '../constants/managedConfigRegistry';

export type { ManagedConfigApplyResult };

/**
 * Apply MDM / Intune managed app configuration to FreeKiosk storage.
 * Called on startup and when ACTION_APPLICATION_RESTRICTIONS_CHANGED fires.
 */
export async function applyManagedConfiguration(
  config: ManagedConfigurationMap | null | undefined,
): Promise<ManagedConfigApplyResult> {
  return applyManagedConfigurationFromRegistry(config);
}
