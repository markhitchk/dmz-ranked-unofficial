package expo.modules.dmzmigration

import android.net.Uri
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
