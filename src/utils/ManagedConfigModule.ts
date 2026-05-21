import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

export interface ManagedConfigurationMap {
  url?: string;
  kiosk_enabled?: boolean;
  auto_launch?: boolean;
  pin_mode?: string;
  display_mode?: string;
  lock_package?: string;
  pin?: string;
}

interface ManagedConfigModuleInterface {
  getManagedConfiguration(): Promise<ManagedConfigurationMap>;
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

const { ManagedConfigModule } = NativeModules;

export const managedConfigEmitter =
  Platform.OS === 'android' && ManagedConfigModule
    ? new NativeEventEmitter(ManagedConfigModule)
    : null;

export const MANAGED_CONFIG_CHANGED_EVENT = 'onManagedConfigurationChanged';

export async function getManagedConfiguration(): Promise<ManagedConfigurationMap | null> {
  if (Platform.OS !== 'android' || !ManagedConfigModule) {
    return null;
  }
  const config = await (ManagedConfigModule as ManagedConfigModuleInterface).getManagedConfiguration();
  if (!config || Object.keys(config).length === 0) {
    return null;
  }
  return config;
}

export default ManagedConfigModule as ManagedConfigModuleInterface | undefined;
