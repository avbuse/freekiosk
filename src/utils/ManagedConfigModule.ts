import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import { MANAGED_CONFIG_ALL_KEYS, type ManagedConfigKey } from '../constants/managedConfigRegistry';

export type ManagedConfigurationMap = Partial<Record<ManagedConfigKey | string, string | boolean>>;

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

/** Keys declared in app_restrictions.xml (for docs and tooling). */
export const MANAGED_CONFIG_POLICY_KEYS = MANAGED_CONFIG_ALL_KEYS;

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
