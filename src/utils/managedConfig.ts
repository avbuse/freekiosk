import { StorageService } from './storage';
import { saveSecurePin, hasSecurePin } from './secureStorage';
import type { ManagedConfigurationMap } from './ManagedConfigModule';

export type ManagedConfigApplyResult = {
  applied: boolean;
  keys: string[];
};

/**
 * Apply MDM / Intune managed app configuration to FreeKiosk storage.
 * Called on startup and when ACTION_APPLICATION_RESTRICTIONS_CHANGED fires.
 */
export async function applyManagedConfiguration(
  config: ManagedConfigurationMap | null | undefined
): Promise<ManagedConfigApplyResult> {
  if (!config) {
    return { applied: false, keys: [] };
  }

  const appliedKeys: string[] = [];

  if (config.url != null && config.url.trim().length > 0) {
    await StorageService.saveUrl(config.url.trim());
    appliedKeys.push('url');
  }

  if (config.kiosk_enabled != null) {
    await StorageService.saveKioskEnabled(config.kiosk_enabled);
    appliedKeys.push('kiosk_enabled');
  }

  if (config.auto_launch != null) {
    await StorageService.saveAutoLaunch(config.auto_launch);
    appliedKeys.push('auto_launch');
  }

  if (config.pin_mode === 'numeric' || config.pin_mode === 'alphanumeric') {
    await StorageService.savePinMode(config.pin_mode);
    appliedKeys.push('pin_mode');
  }

  if (
    config.display_mode === 'webview' ||
    config.display_mode === 'external_app' ||
    config.display_mode === 'media_player'
  ) {
    await StorageService.saveDisplayMode(config.display_mode);
    appliedKeys.push('display_mode');
  }

  if (config.lock_package != null && config.lock_package.trim().length > 0) {
    await StorageService.saveExternalAppPackage(config.lock_package.trim());
    appliedKeys.push('lock_package');
  }

  // Only set PIN when MDM provides one and no PIN exists yet (avoid overwriting user PIN)
  if (config.pin != null && config.pin.length > 0) {
    const pinConfigured = await hasSecurePin();
    if (!pinConfigured) {
      await saveSecurePin(config.pin);
      appliedKeys.push('pin');
      console.log('[ManagedConfig] Initial PIN applied from MDM policy');
    } else {
      console.log('[ManagedConfig] PIN in policy ignored — device already has a PIN');
    }
  }

  if (appliedKeys.length > 0) {
    console.log('[ManagedConfig] Applied keys:', appliedKeys.join(', '));
  }

  return { applied: appliedKeys.length > 0, keys: appliedKeys };
}
