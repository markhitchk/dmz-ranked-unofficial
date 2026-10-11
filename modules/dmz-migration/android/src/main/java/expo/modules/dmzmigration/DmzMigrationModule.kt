package expo.modules.dmzmigration

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.webkit.CookieManager
import android.webkit.WebStorage
import android.webkit.WebSettings
import android.webkit.WebView
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class DmzMigrationModule : Module() {
  private var requestedRefreshPreference: String = "system"
  private var powerSavingReceiver: BroadcastReceiver? = null
  private var receiverContext: Context? = null

  private fun applyPreferredRefreshRate(): Double? {
    val activity = appContext.currentActivity ?: return null
    val available = supportedRefreshRates(resolveDisplay(activity))
    val isSavingPower = powerSaveMode(activity) == true
    // Android power policy wins. Never request a high rate in Battery Saver.
    val target = when {
      isSavingPower -> 0.0
      requestedRefreshPreference == "smooth" -> available.maxOrNull() ?: 0.0
      requestedRefreshPreference == "battery" && available.size > 1 ->
        available.minOrNull() ?: 0.0
      else -> 0.0
    }
    val attrs = activity.window.attributes
    attrs.preferredDisplayModeId = 0
    attrs.preferredRefreshRate = target.toFloat()
    activity.window.attributes = attrs
    return target
  }

  @Suppress("DEPRECATION")
  private fun resolveDisplay(
    context: android.content.Context?
  ): android.view.Display? {
    val activity = appContext.currentActivity
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      activity?.display?.let { return it }
      context?.display?.let { return it }
    }

    activity?.windowManager?.defaultDisplay?.let { return it }

    val displayManager = context?.getSystemService(
      android.content.Context.DISPLAY_SERVICE
    ) as? android.hardware.display.DisplayManager
    displayManager?.getDisplay(android.view.Display.DEFAULT_DISPLAY)?.let {
      return it
    }
    return displayManager?.displays?.firstOrNull()
  }

  // Android's reported active display mode, not an estimated frame rate.
  // Unknown displays stay unknown; never invent a 60 Hz fallback.
  private fun currentRefreshRate(
    context: android.content.Context?
  ): Double {
    val display = resolveDisplay(context) ?: return 0.0
    return display.refreshRate.toDouble().takeIf { it.isFinite() && it > 0.0 } ?: 0.0
  }

  /**
   * Enumerate hardware refresh rates reported by Android, including seamless
   * alternatives (Android 12+). Do not synthesize common values such as 60 Hz:
   * OEMs sometimes expose only a single mode to third-party apps.
   *
   * PreferredRefreshRate is a hint, so Android will decide whether a mode
   * advertised at another resolution is usable for this window.
   */
  private fun supportedRefreshRates(
    display: android.view.Display?
  ): List<Double> {
    if (display == null) return emptyList()

    val candidates = mutableListOf<Double>()
    val active = display.refreshRate.toDouble()
    if (active.isFinite() && active > 0.0) candidates.add(active)

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      try {
        val modes = display.supportedModes.toList()
        // Include every OEM-advertised physical display mode; otherwise a
        // lower rate offered under a different mode may be hidden from the app.
        for (mode in modes) {
          candidates.add(mode.refreshRate.toDouble())
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            // These additional rates are guaranteed seamless if used, but
            // may not appear as separate entries in supportedModes.
            candidates.addAll(mode.alternativeRefreshRates.map { it.toDouble() })
          }
        }
      } catch (_: Throwable) {
        // Keep the current rate if mode enumeration is not available.
      }
    }
    return candidates
      .filter { it.isFinite() && it > 0.0 }
      .distinctBy { kotlin.math.round(it * 100.0) / 100.0 }
      .sorted()
  }

  private fun powerSaveMode(context: android.content.Context?): Boolean? {
    return try {
      val manager = context?.getSystemService(android.content.Context.POWER_SERVICE) as? PowerManager
      manager?.isPowerSaveMode
    } catch (_: Throwable) {
      null
    }
  }

  override fun definition() = ModuleDefinition {
    Name("DmzMigration")

    AsyncFunction("readPeerPayload") {
      val context = appContext.reactContext ?: return@AsyncFunction null
      val peerAuthority = if (context.packageName.endsWith(".beta")) {
        "com.harleytg.dmzranked.migration"
      } else {
        "com.harleytg.dmzranked.beta.migration"
      }

      var cursor: android.database.Cursor? = null
      try {
        cursor = context.contentResolver.query(
          Uri.parse("content://$peerAuthority/export"),
          arrayOf("payload"),
          null,
          null,
          null
        )
        if (cursor == null || !cursor.moveToFirst()) {
          return@AsyncFunction null
        }
        val column = cursor.getColumnIndex("payload")
        if (column < 0) null else cursor.getString(column)
      } catch (_: Throwable) {
        null
      } finally {
        cursor?.close()
      }
    }

    // Java -> React Native in-place upgrade: both release channels retain their
    // own Android SharedPreferences, but React's AsyncStorage does not read them.
    // Return legacy operator data only from this application's private sandbox.
    AsyncFunction("readLegacyOperatorData") {
      val context = appContext.reactContext ?: return@AsyncFunction null
      try {
        val operatorPrefs = context.getSharedPreferences("dmz_operator_backups", 0)
        val backups = operatorPrefs.getString("backups_v1", "{}") ?: "{}"
        val appPrefs = context.getSharedPreferences("dmz_ranked_settings", 0)
        val selected = appPrefs.getString("website_selected_operator", "")?.trim().orEmpty()
        if (backups == "{}" && selected.isEmpty()) {
          null
        } else {
          mapOf(
            "operatorBackups" to backups,
            "selectedOperator" to selected
          )
        }
      } catch (_: Throwable) {
        null
      }
    }

    Function("getDefaultWebViewUserAgent") {
      val context = appContext.reactContext ?: return@Function null
      try {
        WebSettings.getDefaultUserAgent(context)
      } catch (_: Throwable) {
        null
      }
    }

    AsyncFunction("getWebViewPackage") {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
        return@AsyncFunction null
      }
      try {
        val info = WebView.getCurrentWebViewPackage()
        if (info == null) {
          null
        } else {
          mapOf(
            "packageName" to info.packageName,
            "versionName" to (info.versionName ?: "")
          )
        }
      } catch (_: Throwable) {
        null
      }
    }

    // Register a native receiver for Power Saving changes. No polling is
    // needed to remove the app's refresh-rate hint when Battery Saver turns on.
    OnCreate {
      val context = appContext.reactContext?.applicationContext
      if (context != null && powerSavingReceiver == null) {
        val receiver = object : BroadcastReceiver() {
          override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action != PowerManager.ACTION_POWER_SAVE_MODE_CHANGED) return
            Handler(Looper.getMainLooper()).post {
              try {
                applyPreferredRefreshRate()
              } catch (_: Throwable) {
                // System remains authoritative for display policy.
              }
            }
          }
        }
        try {
          context.registerReceiver(receiver, IntentFilter(PowerManager.ACTION_POWER_SAVE_MODE_CHANGED))
          receiverContext = context
          powerSavingReceiver = receiver
        } catch (_: Throwable) {
          // Supported refresh-rate preferences continue working without it.
        }
      }
    }

    OnDestroy {
      val receiver = powerSavingReceiver
      val context = receiverContext
      if (receiver != null && context != null) {
        try {
          context.unregisterReceiver(receiver)
        } catch (_: Throwable) {
        }
      }
      powerSavingReceiver = null
      receiverContext = null
    }

    // Window refresh-rate requests are advisory. Android Battery Saver and
    // system display settings always take priority.
    AsyncFunction("setRefreshRatePreference") {
      preference: String, promise: expo.modules.kotlin.Promise ->
      Handler(Looper.getMainLooper()).post {
        try {
          requestedRefreshPreference =
            if (preference in listOf("system", "smooth", "battery")) preference else "system"
          promise.resolve(applyPreferredRefreshRate())
        } catch (_: Throwable) {
          promise.resolve(null)
        }
      }
    }

    AsyncFunction("getDisplayInfo") {
      val context = appContext.reactContext ?: appContext.currentActivity
      try {
        val display = resolveDisplay(context)
        val activity = appContext.currentActivity
        val refreshRate = currentRefreshRate(context)

        val supportedRefreshRates = supportedRefreshRates(display)

        var width = 0
        var height = 0

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && display != null) {
          try {
            val mode = display.mode
            width = mode.physicalWidth
            height = mode.physicalHeight
          } catch (_: Throwable) {
          }
        }

        if ((width <= 0 || height <= 0) && activity != null) {
          try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
              val bounds = activity.windowManager.currentWindowMetrics.bounds
              width = bounds.width()
              height = bounds.height()
            } else {
              @Suppress("DEPRECATION")
              val metrics = android.util.DisplayMetrics().also {
                activity.windowManager.defaultDisplay.getRealMetrics(it)
              }
              width = metrics.widthPixels
              height = metrics.heightPixels
            }
          } catch (_: Throwable) {
          }
        }

        if (width <= 0 || height <= 0) {
          val metrics = (context ?: appContext.reactContext)
            ?.resources
            ?.displayMetrics
          width = metrics?.widthPixels ?: 0
          height = metrics?.heightPixels ?: 0
        }

        val powerSaveMode = powerSaveMode(context)
        val requestedRate = activity?.window?.attributes?.preferredRefreshRate?.toDouble() ?: 0.0

        mapOf(
          "currentRefreshRate" to refreshRate,
          "requestedRefreshRate" to requestedRate,
          "powerSaveMode" to powerSaveMode,
          "supportedRefreshRates" to supportedRefreshRates,
          "width" to width,
          "height" to height
        )
      } catch (_: Throwable) {
        val metrics = (context ?: appContext.reactContext)
          ?.resources
          ?.displayMetrics
        mapOf(
          "currentRefreshRate" to 0.0,
          "requestedRefreshRate" to 0.0,
          "powerSaveMode" to null,
          "supportedRefreshRates" to emptyList<Double>(),
          "width" to (metrics?.widthPixels ?: 0),
          "height" to (metrics?.heightPixels ?: 0)
        )
      }
    }

    AsyncFunction("sampleUiPerformance") { durationMs: Int, promise: expo.modules.kotlin.Promise ->
      val context = appContext.reactContext ?: appContext.currentActivity
      val sampleDurationMs = durationMs.coerceIn(500, 10000)
      Handler(Looper.getMainLooper()).post {
        try {
          val refreshRate = currentRefreshRate(context)
          if (refreshRate <= 0.0) {
            promise.resolve(mapOf(
              "refreshRate" to 0.0,
              "estimatedFps" to 0.0,
              "averageFrameTimeMs" to 0.0,
              "p95FrameTimeMs" to 0.0,
              "jankPercent" to 0.0,
              "missedFrames" to 0,
              "sampleDurationMs" to sampleDurationMs,
              "quality" to "Unavailable"
            ))
            return@post
          }
          val targetFrameNs = 1_000_000_000.0 / refreshRate
          val frameIntervals = mutableListOf<Long>()
          val startedAtNs = System.nanoTime()
          var firstFrameNs = 0L
          var lastFrameNs = 0L

          val choreographer = android.view.Choreographer.getInstance()
          val callback = object : android.view.Choreographer.FrameCallback {
            override fun doFrame(frameTimeNanos: Long) {
              if (firstFrameNs == 0L) {
                firstFrameNs = frameTimeNanos
              }
              if (lastFrameNs != 0L && frameTimeNanos > lastFrameNs) {
                frameIntervals.add(frameTimeNanos - lastFrameNs)
              }
              lastFrameNs = frameTimeNanos

              val elapsedMs = (System.nanoTime() - startedAtNs) / 1_000_000L
              if (elapsedMs < sampleDurationMs) {
                choreographer.postFrameCallback(this)
                return
              }

              if (frameIntervals.isEmpty() || lastFrameNs <= firstFrameNs) {
                promise.resolve(
                  mapOf(
                    "refreshRate" to refreshRate,
                    "estimatedFps" to 0.0,
                    "averageFrameTimeMs" to 0.0,
                    "p95FrameTimeMs" to 0.0,
                    "jankPercent" to 0.0,
                    "missedFrames" to 0,
                    "sampleDurationMs" to sampleDurationMs,
                    "quality" to "Unavailable"
                  )
                )
                return
              }

              val durationSeconds =
                (lastFrameNs - firstFrameNs).toDouble() / 1_000_000_000.0
              val estimatedFps =
                if (durationSeconds > 0.0) frameIntervals.size / durationSeconds else 0.0
              val averageFrameTimeMs =
                frameIntervals.average() / 1_000_000.0
              val sorted = frameIntervals.sorted()
              val p95Index =
                kotlin.math.ceil((sorted.size - 1) * 0.95).toInt().coerceIn(0, sorted.size - 1)
              val p95FrameTimeMs = sorted[p95Index] / 1_000_000.0
              val jankThresholdNs = targetFrameNs * 1.5
              val jankyFrames =
                frameIntervals.count { it.toDouble() > jankThresholdNs }
              val jankPercent =
                (jankyFrames.toDouble() / frameIntervals.size.toDouble()) * 100.0
              val missedFrames = frameIntervals.sumOf { interval ->
                val expected =
                  kotlin.math.round(interval.toDouble() / targetFrameNs).toInt().coerceAtLeast(1)
                (expected - 1).coerceAtLeast(0)
              }
              val fpsRatio = estimatedFps / refreshRate
              val quality = when {
                fpsRatio >= 0.92 && jankPercent < 5.0 -> "Excellent"
                fpsRatio >= 0.82 && jankPercent < 10.0 -> "Good"
                fpsRatio >= 0.68 && jankPercent < 20.0 -> "Fair"
                else -> "Poor"
              }

              promise.resolve(
                mapOf(
                  "refreshRate" to refreshRate,
                  "estimatedFps" to estimatedFps,
                  "averageFrameTimeMs" to averageFrameTimeMs,
                  "p95FrameTimeMs" to p95FrameTimeMs,
                  "jankPercent" to jankPercent,
                  "missedFrames" to missedFrames,
                  "sampleDurationMs" to sampleDurationMs,
                  "quality" to quality
                )
              )
            }
          }

          choreographer.postFrameCallback(callback)
        } catch (_: Throwable) {
          promise.resolve(
            mapOf(
              "refreshRate" to currentRefreshRate(context),
              "estimatedFps" to 0.0,
              "averageFrameTimeMs" to 0.0,
              "p95FrameTimeMs" to 0.0,
              "jankPercent" to 0.0,
              "missedFrames" to 0,
              "sampleDurationMs" to sampleDurationMs,
              "quality" to "Unavailable"
            )
          )
        }
      }
    }

    AsyncFunction("clearWebViewData") { promise: expo.modules.kotlin.Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.resolve(false)
        return@AsyncFunction
      }

      try {
        Handler(Looper.getMainLooper()).post {
          try {
            val webView = WebView(context)
            webView.clearCache(true)
            webView.clearHistory()
            webView.destroy()
            WebStorage.getInstance().deleteAllData()

            val cookies = CookieManager.getInstance()
            cookies.removeAllCookies {
              try {
                cookies.flush()
              } catch (_: Throwable) {
              }
              promise.resolve(true)
            }
          } catch (_: Throwable) {
            promise.resolve(false)
          }
        }
      } catch (_: Throwable) {
        promise.resolve(false)
      }
    }

    AsyncFunction("installWebChromeParity") {
      reactTag: Int,
      animations: Boolean,
      contentScale: Double,
      promise: expo.modules.kotlin.Promise ->
      val context = appContext.reactContext
      val reactContext =
        context as? com.facebook.react.bridge.ReactContext
      if (reactContext == null) {
        promise.resolve(false)
        return@AsyncFunction
      }

      Handler(Looper.getMainLooper()).post {
        try {
          promise.resolve(
            DmzWebChromeParity.install(
              reactContext,
              reactTag,
              animations,
              contentScale
            )
          )
        } catch (_: Throwable) {
          promise.resolve(false)
        }
      }
    }

    AsyncFunction("syncWidgetSettings") { selectedOperator: String ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      context
        .getSharedPreferences("dmz_ranked_settings", 0)
        .edit()
        .putString("website_selected_operator", selectedOperator.trim())
        .apply()
      true
    }

    AsyncFunction("requestPinDmzWidget") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
        return@AsyncFunction false
      }
      try {
        val manager = AppWidgetManager.getInstance(context)
        if (!manager.isRequestPinAppWidgetSupported) {
          false
        } else {
          manager.requestPinAppWidget(
            ComponentName(context, DmzRankedWidgetProvider::class.java),
            null,
            null
          )
        }
      } catch (_: Throwable) {
        false
      }
    }

    AsyncFunction("refreshDmzWidgets") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      try {
        DmzRankedWidgetProvider.requestUpdateAll(context)
        true
      } catch (_: Throwable) {
        false
      }
    }

    AsyncFunction("setExportPayload") { payload: String ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      context
        .getSharedPreferences(DmzMigrationProvider.PREFS, 0)
        .edit()
        .putString(DmzMigrationProvider.KEY_PAYLOAD, payload)
        .apply()
      true
    }
  }
}
