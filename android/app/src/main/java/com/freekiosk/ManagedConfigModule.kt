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
 */
class ManagedConfigModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), LifecycleEventListener {

    companion object {
        const val NAME = "ManagedConfigModule"
        const val EVENT_CONFIGURATION_CHANGED = "onManagedConfigurationChanged"

        private val KNOWN_KEYS = listOf(
            "url",
            "kiosk_enabled",
            "auto_launch",
            "pin_mode",
            "display_mode",
            "lock_package",
            "pin",
        )
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

    private fun bundleToWritableMap(bundle: Bundle): WritableMap {
        val map = Arguments.createMap()
        for (key in KNOWN_KEYS) {
            if (!bundle.containsKey(key)) continue
            when (key) {
                "kiosk_enabled", "auto_launch" -> map.putBoolean(key, bundle.getBoolean(key))
                else -> {
                    val value = bundle.getString(key)
                    if (value != null) {
                        map.putString(key, value)
                    }
                }
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
