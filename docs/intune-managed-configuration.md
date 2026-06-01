# Intune / MDM Managed App Configuration

FreeKiosk supports **Android managed app configuration** (app restrictions) on enrolled Android Enterprise devices. Use this with Microsoft Intune **App configuration policies** for managed devices to push kiosk settings without rebuilding the APK.

**Policy schema version:** `2` (see `MANAGED_CONFIG_POLICY_VERSION` in `src/constants/managedConfigRegistry.ts`)

## Prerequisites

- Device enrolled in Intune as **Android Enterprise** (fully managed or dedicated device)
- FreeKiosk deployed as a **Line-of-business (LOB)** app
- For production kiosk lockdown: **Device Owner** (see [ADB Configuration](adb-configuration.md))

## Architecture

| Layer | File | Role |
|-------|------|------|
| Schema (Intune UI) | `android/app/src/main/res/xml/app_restrictions.xml` | Declares keys, types, defaults |
| Native bridge | `android/.../ManagedConfigModule.kt` | Reads restrictions bundle; emits change events |
| Registry | `src/constants/managedConfigRegistry.ts` | **Single source of apply logic** per key |
| Apply entry | `src/utils/managedConfig.ts` | Calls registry on startup / policy change |
| UI | `src/screens/KioskScreen.tsx` | Loads policy on start; reloads on `onManagedConfigurationChanged` |

To add a new MDM key: extend the registry, then mirror the key in `app_restrictions.xml` and `ManagedConfigModule.kt` (`KNOWN_KEYS` / `BOOL_KEYS`).

## Policy keys (v2)

### Core (v1)

| Key | Type | Description |
|-----|------|-------------|
| `url` | string | WebView URL |
| `kiosk_enabled` | bool | Enable lock mode (lock task) |
| `auto_launch` | bool | Start on boot; also enables `BootReceiver` in PackageManager |
| `pin_mode` | choice | `numeric` or `alphanumeric` |
| `display_mode` | choice | `webview`, `external_app`, or `media_player` |
| `lock_package` | string | External app package when `display_mode` is `external_app` |
| `pin` | string | Sets or updates kiosk PIN when policy applies (see PIN security) |

### External app

| Key | Type | Description |
|-----|------|-------------|
| `external_app_mode` | choice | `single` or `multi` |
| `managed_apps` | string (JSON) | Array e.g. `[{"packageName":"com.app","launchOnBoot":true,"keepAlive":true}]` |
| `auto_relaunch` | bool | Relaunch external app after exit/crash |
| `back_button_mode` | choice | `test`, `timer`, or `immediate` |

### Device / kiosk

| Key | Type | Description |
|-----|------|-------------|
| `allow_power_button` | bool | Power menu in lock task |
| `allow_notifications` | bool | Notification shade |
| `allow_system_info` | bool | System info in lock task (e.g. Samsung audio) |
| `keep_screen_on` | bool | `FLAG_KEEP_SCREEN_ON` |
| `pin_max_attempts` | string (int) | Failed attempts before lockout (1–20) |

### Return / escape (often disabled in production)

| Key | Type | Description |
|-----|------|-------------|
| `return_tap_count` | string (int) | Taps to open PIN (2–20) |
| `return_tap_timeout` | string (int) | Ms between taps (500–10000) |
| `return_mode` | choice | `tap_anywhere` or `button` |
| `volume_up_5tap_enabled` | bool | Volume-up shortcut to PIN screen |

### WebView

| Key | Type | Description |
|-----|------|-------------|
| `auto_reload` | bool | Reload on reconnect |
| `custom_user_agent` | string | User-Agent override |
| `webview_zoom_level` | string (int) | Zoom 50–200 (default 100) |
| `disable_user_zoom` | bool | Block pinch zoom |
| `keyboard_mode` | string | Keyboard behavior (e.g. `default`) |

### Status bar

| Key | Type | Description |
|-----|------|-------------|
| `status_bar_enabled` | bool | Show overlay status bar |
| `status_bar_show_battery` | bool | Show battery |
| `status_bar_show_wifi` | bool | Show Wi‑Fi |
| `status_bar_show_bluetooth` | bool | Show Bluetooth |
| `status_bar_show_volume` | bool | Show volume |
| `status_bar_show_time` | bool | Show clock |

### Screensaver

| Key | Type | Description |
|-----|------|-------------|
| `screensaver_enabled` | bool | Enable screensaver |
| `screensaver_inactivity_enabled` | bool | Use inactivity timer |
| `screensaver_inactivity_delay` | string (int) | **Minutes** of inactivity (1–1440) |
| `screensaver_type` | choice | `dim`, `url`, or `video` |
| `screensaver_url` | string | URL when type is `url` |

> Intune exposes some numeric fields as strings in the portal; the app parses both.

## Configure in Microsoft Intune

1. **Apps** → **All apps** → select your FreeKiosk LOB app
2. **Configuration** → **Add configuration for managed devices**
3. Set values (keys match the table above)
4. **Assign** the policy to your device group
5. Sync the device (Company Portal or automatic MDM sync)

## When settings apply

- On app startup (`KioskScreen` → `loadSettings()` → registry apply)
- When the policy changes (`ACTION_APPLICATION_RESTRICTIONS_CHANGED` → reload settings)

ADB pending config is applied **before** managed configuration on each `loadSettings()` run.

## PIN security

- When `pin` is present in the policy, it **overwrites** the device PIN on every apply (startup, policy sync, return from Settings)
- Use Intune **secret** or **reference** variables for the PIN value in production — do not paste plaintext PINs into policy descriptions
- Numeric PINs (`pin_mode` = `numeric`): 4–20 digits only
- Alphanumeric passwords (`pin_mode` = `alphanumeric`): 4–20 characters
- Changing `pin` in Intune and syncing the device updates PINs on already-provisioned tablets without reinstalling the app

## Auto-launch on boot

1. Set `auto_launch` to `true` in Intune
2. Open FreeKiosk once after policy sync (writes storage and enables `BootReceiver`)
3. Reboot to verify

## Related

- [ADB Configuration](adb-configuration.md) — initial provisioning and Device Owner
- [Installation](installation.md)
