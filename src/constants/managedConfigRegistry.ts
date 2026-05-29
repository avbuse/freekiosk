/**
 * Declarative registry for Android managed app configuration (Intune / MDM).
 * Add new policy keys here, then mirror them in:
 * - android/app/src/main/res/xml/app_restrictions.xml
 * - android/.../ManagedConfigModule.kt (KNOWN_KEYS / BOOL_KEYS)
 */
import { StorageService } from '../utils/storage';
import { saveSecurePin, hasSecurePin } from '../utils/secureStorage';
import KioskModule from '../utils/KioskModule';
import { createManagedApp, type ManagedApp } from '../types/managedApps';
import type { ManagedConfigurationMap } from '../utils/ManagedConfigModule';

export const MANAGED_CONFIG_POLICY_VERSION = 2;

export type ManagedConfigApplyResult = {
  applied: boolean;
  keys: string[];
};

export type ManagedConfigFieldType = 'bool' | 'string' | 'int' | 'json';

export type ManagedConfigFieldDefinition = {
  key: string;
  type: ManagedConfigFieldType;
  /** If true, value is only applied when no secure PIN exists yet */
  pinOnce?: boolean;
  apply: (raw: string | boolean | undefined) => Promise<boolean>;
};

export const MANAGED_CONFIG_BOOL_KEYS = [
  'kiosk_enabled',
  'auto_launch',
  'auto_relaunch',
  'allow_power_button',
  'allow_notifications',
  'allow_system_info',
  'keep_screen_on',
  'volume_up_5tap_enabled',
  'auto_reload',
  'status_bar_enabled',
  'status_bar_show_battery',
  'status_bar_show_wifi',
  'status_bar_show_bluetooth',
  'status_bar_show_volume',
  'status_bar_show_time',
  'disable_user_zoom',
  'screensaver_enabled',
  'screensaver_inactivity_enabled',
  'screensaver_lock_screen',
] as const;

export const MANAGED_CONFIG_STRING_KEYS = [
  'url',
  'pin_mode',
  'display_mode',
  'lock_package',
  'pin',
  'external_app_mode',
  'managed_apps',
  'back_button_mode',
  'return_mode',
  'keyboard_mode',
  'custom_user_agent',
  'return_tap_count',
  'return_tap_timeout',
  'pin_max_attempts',
  'webview_zoom_level',
  'screensaver_inactivity_delay',
  'screensaver_type',
  'screensaver_url',
] as const;

export type ManagedConfigBoolKey = (typeof MANAGED_CONFIG_BOOL_KEYS)[number];
export type ManagedConfigStringKey = (typeof MANAGED_CONFIG_STRING_KEYS)[number];
export type ManagedConfigKey = ManagedConfigBoolKey | ManagedConfigStringKey;

export const MANAGED_CONFIG_ALL_KEYS: readonly string[] = [
  ...MANAGED_CONFIG_BOOL_KEYS,
  ...MANAGED_CONFIG_STRING_KEYS,
];

export function parseManagedConfigBool(
  value: string | boolean | undefined,
): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'boolean') return value;
  const s = String(value).trim().toLowerCase();
  if (s === 'true' || s === '1') return true;
  if (s === 'false' || s === '0') return false;
  return undefined;
}

export function parseManagedConfigInt(
  value: string | boolean | undefined,
  min: number,
  max: number,
): number | undefined {
  if (value === undefined || value === null) return undefined;
  const n = typeof value === 'number' ? value : parseInt(String(value).trim(), 10);
  if (Number.isNaN(n)) return undefined;
  return Math.max(min, Math.min(max, n));
}

function parseManagedAppsJson(raw: string): ManagedApp[] | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const apps = parsed
      .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
      .filter((item) => typeof item.packageName === 'string' && item.packageName.length > 0)
      .map((item) =>
        createManagedApp(String(item.packageName), String(item.displayName || item.packageName), {
          showOnHomeScreen:
            typeof item.showOnHomeScreen === 'boolean' ? item.showOnHomeScreen : true,
          launchOnBoot: typeof item.launchOnBoot === 'boolean' ? item.launchOnBoot : false,
          keepAlive: typeof item.keepAlive === 'boolean' ? item.keepAlive : false,
          allowAccessibility:
            typeof item.allowAccessibility === 'boolean' ? item.allowAccessibility : false,
        }),
      );
    return apps.length > 0 ? apps : null;
  } catch {
    return null;
  }
}

async function applyBool(
  raw: string | boolean | undefined,
  save: (value: boolean) => Promise<void>,
): Promise<boolean> {
  const value = parseManagedConfigBool(raw);
  if (value === undefined) return false;
  await save(value);
  return true;
}

async function applyAutoLaunch(raw: string | boolean | undefined): Promise<boolean> {
  const value = parseManagedConfigBool(raw);
  if (value === undefined) return false;
  await StorageService.saveAutoLaunch(value);
  try {
    if (value) {
      await KioskModule.enableAutoLaunch();
    } else {
      await KioskModule.disableAutoLaunch();
    }
  } catch (error) {
    console.warn('[ManagedConfig] Failed to sync BootReceiver with auto_launch:', error);
  }
  return true;
}

async function applyPinOnce(raw: string | boolean | undefined): Promise<boolean> {
  const pin = raw != null ? String(raw) : '';
  if (pin.length === 0) return false;
  if (await hasSecurePin()) {
    console.log('[ManagedConfig] PIN in policy ignored — device already has a PIN');
    return false;
  }
  await saveSecurePin(pin);
  console.log('[ManagedConfig] Initial PIN applied from MDM policy');
  return true;
}

/** Registry order: special handlers first in map construction below */
export const MANAGED_CONFIG_REGISTRY: ManagedConfigFieldDefinition[] = [
  {
    key: 'url',
    type: 'string',
    apply: async (raw) => {
      const url = raw != null ? String(raw).trim() : '';
      if (!url) return false;
      await StorageService.saveUrl(url);
      return true;
    },
  },
  {
    key: 'kiosk_enabled',
    type: 'bool',
    apply: (raw) => applyBool(raw, StorageService.saveKioskEnabled),
  },
  {
    key: 'auto_launch',
    type: 'bool',
    apply: applyAutoLaunch,
  },
  {
    key: 'pin_mode',
    type: 'string',
    apply: async (raw) => {
      const mode = raw != null ? String(raw) : '';
      if (mode !== 'numeric' && mode !== 'alphanumeric') return false;
      await StorageService.savePinMode(mode);
      return true;
    },
  },
  {
    key: 'display_mode',
    type: 'string',
    apply: async (raw) => {
      const mode = raw != null ? String(raw) : '';
      if (mode !== 'webview' && mode !== 'external_app' && mode !== 'media_player') return false;
      await StorageService.saveDisplayMode(mode);
      return true;
    },
  },
  {
    key: 'lock_package',
    type: 'string',
    apply: async (raw) => {
      const pkg = raw != null ? String(raw).trim() : '';
      if (!pkg) return false;
      await StorageService.saveExternalAppPackage(pkg);
      return true;
    },
  },
  {
    key: 'pin',
    type: 'string',
    pinOnce: true,
    apply: applyPinOnce,
  },
  {
    key: 'external_app_mode',
    type: 'string',
    apply: async (raw) => {
      const mode = raw != null ? String(raw) : '';
      if (mode !== 'single' && mode !== 'multi') return false;
      await StorageService.saveExternalAppMode(mode);
      return true;
    },
  },
  {
    key: 'managed_apps',
    type: 'json',
    apply: async (raw) => {
      const apps = parseManagedAppsJson(String(raw ?? ''));
      if (!apps) return false;
      await StorageService.saveManagedApps(apps);
      return true;
    },
  },
  {
    key: 'auto_relaunch',
    type: 'bool',
    apply: (raw) => applyBool(raw, StorageService.saveAutoRelaunchApp),
  },
  {
    key: 'back_button_mode',
    type: 'string',
    apply: async (raw) => {
      const mode = raw != null ? String(raw) : '';
      if (!['test', 'timer', 'immediate'].includes(mode)) return false;
      await StorageService.saveBackButtonMode(mode);
      return true;
    },
  },
  {
    key: 'allow_power_button',
    type: 'bool',
    apply: (raw) => applyBool(raw, StorageService.saveAllowPowerButton),
  },
  {
    key: 'allow_notifications',
    type: 'bool',
    apply: (raw) => applyBool(raw, StorageService.saveAllowNotifications),
  },
  {
    key: 'allow_system_info',
    type: 'bool',
    apply: (raw) => applyBool(raw, StorageService.saveAllowSystemInfo),
  },
  {
    key: 'keep_screen_on',
    type: 'bool',
    apply: (raw) => applyBool(raw, StorageService.saveKeepScreenOn),
  },
  {
    key: 'pin_max_attempts',
    type: 'int',
    apply: async (raw) => {
      const n = parseManagedConfigInt(raw, 1, 20);
      if (n === undefined) return false;
      await StorageService.savePinMaxAttempts(n);
      return true;
    },
  },
  {
    key: 'return_tap_count',
    type: 'int',
    apply: async (raw) => {
      const n = parseManagedConfigInt(raw, 2, 20);
      if (n === undefined) return false;
      await StorageService.saveReturnTapCount(n);
      return true;
    },
  },
  {
    key: 'return_tap_timeout',
    type: 'int',
    apply: async (raw) => {
      const n = parseManagedConfigInt(raw, 500, 10000);
      if (n === undefined) return false;
      await StorageService.saveReturnTapTimeout(n);
      return true;
    },
  },
  {
    key: 'return_mode',
    type: 'string',
    apply: async (raw) => {
      const mode = raw != null ? String(raw) : '';
      if (mode !== 'tap_anywhere' && mode !== 'button') return false;
      await StorageService.saveReturnMode(mode);
      return true;
    },
  },
  {
    key: 'volume_up_5tap_enabled',
    type: 'bool',
    apply: (raw) => applyBool(raw, StorageService.saveVolumeUp5TapEnabled),
  },
  {
    key: 'auto_reload',
    type: 'bool',
    apply: (raw) => applyBool(raw, StorageService.saveAutoReload),
  },
  {
    key: 'custom_user_agent',
    type: 'string',
    apply: async (raw) => {
      await StorageService.saveCustomUserAgent(String(raw ?? ''));
      return true;
    },
  },
  {
    key: 'webview_zoom_level',
    type: 'int',
    apply: async (raw) => {
      const n = parseManagedConfigInt(raw, 50, 200);
      if (n === undefined) return false;
      await StorageService.saveWebViewZoomLevel(n);
      return true;
    },
  },
  {
    key: 'disable_user_zoom',
    type: 'bool',
    apply: (raw) => applyBool(raw, StorageService.saveDisableUserZoom),
  },
  {
    key: 'keyboard_mode',
    type: 'string',
    apply: async (raw) => {
      const mode = raw != null ? String(raw) : '';
      if (!mode) return false;
      await StorageService.saveKeyboardMode(mode);
      return true;
    },
  },
  {
    key: 'status_bar_enabled',
    type: 'bool',
    apply: (raw) => applyBool(raw, StorageService.saveStatusBarEnabled),
  },
  {
    key: 'status_bar_show_battery',
    type: 'bool',
    apply: (raw) => applyBool(raw, StorageService.saveStatusBarShowBattery),
  },
  {
    key: 'status_bar_show_wifi',
    type: 'bool',
    apply: (raw) => applyBool(raw, StorageService.saveStatusBarShowWifi),
  },
  {
    key: 'status_bar_show_bluetooth',
    type: 'bool',
    apply: (raw) => applyBool(raw, StorageService.saveStatusBarShowBluetooth),
  },
  {
    key: 'status_bar_show_volume',
    type: 'bool',
    apply: (raw) => applyBool(raw, StorageService.saveStatusBarShowVolume),
  },
  {
    key: 'status_bar_show_time',
    type: 'bool',
    apply: (raw) => applyBool(raw, StorageService.saveStatusBarShowTime),
  },
  {
    key: 'screensaver_enabled',
    type: 'bool',
    apply: (raw) => applyBool(raw, StorageService.saveScreensaverEnabled),
  },
  {
    key: 'screensaver_inactivity_enabled',
    type: 'bool',
    apply: (raw) => applyBool(raw, StorageService.saveScreensaverInactivityEnabled),
  },
  {
    key: 'screensaver_lock_screen',
    type: 'bool',
    apply: (raw) => applyBool(raw, StorageService.saveScreensaverLockScreen),
  },
  {
    key: 'screensaver_inactivity_delay',
    type: 'int',
    apply: async (raw) => {
      // Policy value is minutes (same as Settings UI); storage is milliseconds
      const minutes = parseManagedConfigInt(raw, 1, 1440);
      if (minutes === undefined) return false;
      await StorageService.saveScreensaverInactivityDelay(minutes * 60000);
      return true;
    },
  },
  {
    key: 'screensaver_type',
    type: 'string',
    apply: async (raw) => {
      const type = raw != null ? String(raw) : '';
      if (type !== 'dim' && type !== 'url' && type !== 'video') return false;
      await StorageService.saveScreensaverType(type);
      return true;
    },
  },
  {
    key: 'screensaver_url',
    type: 'string',
    apply: async (raw) => {
      const url = raw != null ? String(raw).trim() : '';
      if (!url) return false;
      await StorageService.saveScreensaverUrl(url);
      return true;
    },
  },
];

export const MANAGED_CONFIG_REGISTRY_BY_KEY = new Map(
  MANAGED_CONFIG_REGISTRY.map((def) => [def.key, def]),
);

/**
 * Apply all keys present in the MDM bundle using the declarative registry.
 */
export async function applyManagedConfigurationFromRegistry(
  config: ManagedConfigurationMap | null | undefined,
): Promise<ManagedConfigApplyResult> {
  if (!config) {
    return { applied: false, keys: [] };
  }

  const appliedKeys: string[] = [];

  for (const def of MANAGED_CONFIG_REGISTRY) {
    const raw = config[def.key];
    if (raw === undefined) continue;

    try {
      const applied = await def.apply(raw);
      if (applied) {
        appliedKeys.push(def.key);
      }
    } catch (error) {
      console.warn(`[ManagedConfig] Failed to apply ${def.key}:`, error);
    }
  }

  if (appliedKeys.length > 0) {
    console.log('[ManagedConfig] Applied keys:', appliedKeys.join(', '));
  }

  return { applied: appliedKeys.length > 0, keys: appliedKeys };
}
