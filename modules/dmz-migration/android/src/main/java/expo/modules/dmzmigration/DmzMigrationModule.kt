package expo.modules.dmzmigration

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
      if (context == null) {
        promise.resolve(false)
        return@AsyncFunction
      }

      Handler(Looper.getMainLooper()).post {
        try {
          promise.resolve(
            DmzWebChromeParity.install(
              context,
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
