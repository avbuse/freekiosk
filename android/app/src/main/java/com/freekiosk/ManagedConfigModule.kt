package com.freekiosk

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.RestrictionsManager
import android.os.Build
import android.os.Bundle
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * Reads Android managed app configuration (app restrictions) pushed by MDM tools
 * such as Microsoft Intune on enrolled Android Enterprise devices.
 *
 * Keep KNOWN_KEYS / BOOL_KEYS in sync with src/constants/managedConfigRegistry.ts
 */
class ManagedConfigModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), LifecycleEventListener {

    companion object {
        const val NAME = "ManagedConfigModule"
        const val EVENT_CONFIGURATION_CHANGED = "onManagedConfigurationChanged"

        private val BOOL_KEYS = setOf(
            "kiosk_enabled",
            "auto_launch",
            "auto_relaunch",
            "allow_power_button",
            "allow_notifications",
            "allow_system_info",
            "keep_screen_on",
            "volume_up_5tap_enabled",
            "auto_reload",
            "status_bar_enabled",
            "status_bar_show_battery",
            "status_bar_show_wifi",
            "status_bar_show_bluetooth",
            "status_bar_show_volume",
            "status_bar_show_time",
            "disable_user_zoom",
            "screensaver_enabled",
            "screensaver_inactivity_enabled",
            "screensaver_lock_screen",
        )

        private val STRING_KEYS = listOf(
            "url",
            "pin_mode",
            "display_mode",
            "lock_package",
            "pin",
            "external_app_mode",
            "managed_apps",
            "back_button_mode",
            "return_mode",
            "keyboard_mode",
            "custom_user_agent",
            "return_tap_count",
            "return_tap_timeout",
            "pin_max_attempts",
            "webview_zoom_level",
            "screensaver_inactivity_delay",
            "screensaver_type",
            "screensaver_url",
        )

        val KNOWN_KEYS: List<String> = BOOL_KEYS.toList() + STRING_KEYS
    }

    private var restrictionsReceiver: BroadcastReceiver? = null

    init {
        reactContext.addLifecycleEventListener(this)
    }

    override fun getName(): String = NAME

    @ReactMethod
    fun addListener(eventName: String) {
        // Required for NativeEventEmitter on Android
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Required for NativeEventEmitter on Android
    }

    @ReactMethod
    fun getManagedConfiguration(promise: Promise) {
        try {
            promise.resolve(bundleToWritableMap(getRestrictionsBundle()))
        } catch (e: Exception) {
            promise.reject("MANAGED_CONFIG_ERROR", "Failed to read managed configuration: ${e.message}", e)
        }
    }

    override fun onHostResume() {
        registerRestrictionsReceiver()
    }

    override fun onHostPause() {
        unregisterRestrictionsReceiver()
    }

    override fun onHostDestroy() {
        unregisterRestrictionsReceiver()
    }

    private fun getRestrictionsBundle(): Bundle {
        val restrictionsManager =
            reactContext.getSystemService(Context.RESTRICTIONS_SERVICE) as? RestrictionsManager
                ?: return Bundle.EMPTY
        return restrictionsManager.applicationRestrictions ?: Bundle.EMPTY
    }

    private fun readBool(bundle: Bundle, key: String): Boolean? {
        if (!bundle.containsKey(key)) return null
        return when (val value = bundle.get(key)) {
            is Boolean -> value
            is String -> value.equals("true", ignoreCase = true) || value == "1"
            is Int -> value != 0
            else -> null
        }
    }

    private fun readString(bundle: Bundle, key: String): String? {
        if (!bundle.containsKey(key)) return null
        return when (val value = bundle.get(key)) {
            is String -> value
            is Boolean -> value.toString()
            is Int -> value.toString()
            else -> value?.toString()
        }
    }

    private fun bundleToWritableMap(bundle: Bundle): WritableMap {
        val map = Arguments.createMap()
        for (key in KNOWN_KEYS) {
            if (!bundle.containsKey(key)) continue
            if (key in BOOL_KEYS) {
                readBool(bundle, key)?.let { map.putBoolean(key, it) }
            } else {
                readString(bundle, key)?.let { map.putString(key, it) }
            }
        }
        return map
    }

    private fun registerRestrictionsReceiver() {
        if (restrictionsReceiver != null) return
        restrictionsReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                if (intent?.action != Intent.ACTION_APPLICATION_RESTRICTIONS_CHANGED) return
                emitConfigurationChanged()
            }
        }
        val filter = IntentFilter(Intent.ACTION_APPLICATION_RESTRICTIONS_CHANGED)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            reactContext.registerReceiver(restrictionsReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("DEPRECATION")
            reactContext.registerReceiver(restrictionsReceiver, filter)
        }
        DebugLog.d(NAME, "Registered managed configuration change receiver")
    }

    private fun unregisterRestrictionsReceiver() {
        restrictionsReceiver?.let {
            try {
                reactContext.unregisterReceiver(it)
            } catch (e: Exception) {
                DebugLog.d(NAME, "Receiver already unregistered: ${e.message}")
            }
        }
        restrictionsReceiver = null
    }

    private fun emitConfigurationChanged() {
        if (!reactContext.hasActiveReactInstance()) return
        try {
            val payload = bundleToWritableMap(getRestrictionsBundle())
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(EVENT_CONFIGURATION_CHANGED, payload)
            DebugLog.d(NAME, "Emitted $EVENT_CONFIGURATION_CHANGED")
        } catch (e: Exception) {
            DebugLog.errorProduction(NAME, "Failed to emit managed config event: ${e.message}")
        }
    }
}
