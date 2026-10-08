package expo.modules.dmzmigration

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.webkit.CookieManager
import android.webkit.WebStorage
import android.webkit.WebSettings
import android.webkit.WebView
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class DmzMigrationModule : Module() {
  private fun setLegacyComponentsEnabled(
    context: android.content.Context,
    enabled: Boolean
  ) {
    val state = if (enabled) {
      PackageManager.COMPONENT_ENABLED_STATE_ENABLED
    } else {
      PackageManager.COMPONENT_ENABLED_STATE_DISABLED
    }

    val components = arrayOf(
      ComponentName(context, com.harleytg.dmzranked.legacy.MainActivity::class.java),
      ComponentName(context, com.harleytg.dmzranked.legacy.SettingsActivity::class.java),
      ComponentName(context, com.harleytg.dmzranked.legacy.FeedbackActivity::class.java)
    )

    components.forEach { component ->
      context.packageManager.setComponentEnabledSetting(
        component,
        state,
        PackageManager.DONT_KILL_APP
      )
    }
  }

  override fun definition() = ModuleDefinition {
    Name("DmzMigration")

    AsyncFunction("launchLegacyExperience") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      try {
        setLegacyComponentsEnabled(context, true)

        context
          .getSharedPreferences("dmz_runtime", 0)
          .edit()
          .putString("experience_version", "v1")
          .remove("experience_return")
          .apply()

        val intent = Intent(
          context,
          com.harleytg.dmzranked.legacy.MainActivity::class.java
        )
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
        true
      } catch (_: Throwable) {
        try {
          setLegacyComponentsEnabled(context, false)
        } catch (_: Throwable) {
        }
        false
      }
    }

    AsyncFunction("deactivateLegacyExperience") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      try {
        setLegacyComponentsEnabled(context, false)
        context
          .getSharedPreferences("dmz_runtime", 0)
          .edit()
          .putString("experience_version", "v2")
          .apply()
        true
      } catch (_: Throwable) {
        false
      }
    }

    AsyncFunction("consumeLegacyExperienceReturn") {
      val context = appContext.reactContext ?: return@AsyncFunction null
      try {
        val prefs = context.getSharedPreferences("dmz_runtime", 0)
        val requested = prefs.getString("experience_return", null)
        if (requested == "v2") {
          try {
            setLegacyComponentsEnabled(context, false)
          } catch (_: Throwable) {
          }
          prefs.edit()
            .putString("experience_version", "v2")
            .remove("experience_return")
            .apply()
          "v2"
        } else {
          null
        }
      } catch (_: Throwable) {
        null
      }
    }

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

    AsyncFunction("getDisplayInfo") {
      val context = appContext.reactContext ?: return@AsyncFunction null
      try {
        val windowManager = context.getSystemService(
          android.content.Context.WINDOW_SERVICE
        ) as? android.view.WindowManager

        @Suppress("DEPRECATION")
        val display = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
          context.display ?: windowManager?.defaultDisplay
        } else {
          windowManager?.defaultDisplay
        } ?: return@AsyncFunction null

        val currentRefreshRate = display.refreshRate.toDouble()

        val supportedRefreshRates =
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            display.supportedModes
              .map { it.refreshRate.toDouble() }
              .distinctBy { kotlin.math.round(it * 100.0) / 100.0 }
              .sorted()
          } else {
            listOf(currentRefreshRate)
          }

        val width: Int
        val height: Int
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
          val mode = display.mode
          width = mode.physicalWidth
          height = mode.physicalHeight
        } else {
          @Suppress("DEPRECATION")
          val metrics = android.util.DisplayMetrics().also {
            display.getRealMetrics(it)
          }
          width = metrics.widthPixels
          height = metrics.heightPixels
        }

        mapOf(
          "currentRefreshRate" to currentRefreshRate,
          "supportedRefreshRates" to supportedRefreshRates,
          "width" to width,
          "height" to height
        )
      } catch (_: Throwable) {
        null
      }
    }

    AsyncFunction("sampleUiPerformance") { durationMs: Int, promise: expo.modules.kotlin.Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.resolve(null)
        return@AsyncFunction
      }

      val sampleDurationMs = durationMs.coerceIn(500, 10000)
      Handler(Looper.getMainLooper()).post {
        try {
          val windowManager = context.getSystemService(
            android.content.Context.WINDOW_SERVICE
          ) as? android.view.WindowManager

          @Suppress("DEPRECATION")
          val display = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            context.display ?: windowManager?.defaultDisplay
          } else {
            windowManager?.defaultDisplay
          }

          val refreshRate = (display?.refreshRate ?: 60f).toDouble().coerceAtLeast(1.0)
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
          promise.resolve(null)
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
