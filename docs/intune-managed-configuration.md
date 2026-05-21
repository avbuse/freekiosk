# Intune / MDM Managed App Configuration

FreeKiosk supports **Android managed app configuration** (app restrictions) on enrolled Android Enterprise devices. Use this with Microsoft Intune **App configuration policies** for managed devices to push kiosk settings without rebuilding the APK.

## Prerequisites

- Device enrolled in Intune as **Android Enterprise** (fully managed or dedicated device)
- FreeKiosk deployed as a **Line-of-business (LOB)** app
- For production kiosk lockdown: **Device Owner** (see [ADB Configuration](adb-configuration.md))

## Policy keys

| Key | Type | Description |
|-----|------|-------------|
| `url` | string | WebView URL (e.g. `http://homeassistant.local:8123`) |
| `kiosk_enabled` | bool | Enable lock mode |
| `auto_launch` | bool | Launch FreeKiosk on boot |
| `pin_mode` | choice | `numeric` or `alphanumeric` |
| `display_mode` | choice | `webview`, `external_app`, or `media_player` |
| `lock_package` | string | External app package when `display_mode` is `external_app` |
| `pin` | string | Initial PIN only if none configured (not recommended for secrets) |

Schema is declared in `android/app/src/main/res/xml/app_restrictions.xml`.

## Configure in Microsoft Intune

1. **Apps** → **All apps** → select your FreeKiosk LOB app
2. **Configuration** → **Add configuration for managed devices**
3. Set values (example for Home Assistant):

   - `url`: `http://homeassistant.local:8123`
   - `kiosk_enabled`: `true`
   - `auto_launch`: `true`
   - `pin_mode`: `alphanumeric`
   - `display_mode`: `webview`

4. **Assign** the policy to your device group
5. Sync the device (Company Portal or automatic MDM sync)

## When settings apply

- On app startup (`KioskScreen` reads restrictions and writes to storage)
- When the policy changes (`ACTION_APPLICATION_RESTRICTIONS_CHANGED`)

ADB pending config is applied **before** managed configuration on each `loadSettings()` run.

## PIN security

- Prefer setting the PIN once via [ADB provisioning](adb-configuration.md), not Intune policy
- If `pin` is in the policy, it is applied **only when no PIN exists yet**
- Numeric PINs: 4–20 digits; alphanumeric passwords: 4–20 characters

## Related

- [ADB Configuration](adb-configuration.md) — initial provisioning and Device Owner
- [Installation](installation.md)
