package expo.modules.dmzmigration

import android.content.ContentProvider
import android.content.ContentValues
import android.database.Cursor
import android.database.MatrixCursor
import android.net.Uri

class DmzMigrationProvider : ContentProvider() {
  companion object {
    const val PREFS = "dmz_react_migration"
    const val KEY_PAYLOAD = "payload"
  }

  override fun onCreate(): Boolean = true

  override fun query(
    uri: Uri,
    projection: Array<out String>?,
    selection: String?,
    selectionArgs: Array<out String>?,
    sortOrder: String?
  ): Cursor {
    val cursor = MatrixCursor(arrayOf("payload"))
    if (context == null || uri.path != "/export") {
      return cursor
    }

    val payload = context
      ?.getSharedPreferences(PREFS, 0)
      ?.getString(KEY_PAYLOAD, null)

    if (!payload.isNullOrBlank()) {
      cursor.addRow(arrayOf(payload))
    }
    return cursor
  }

  override fun getType(uri: Uri): String = "application/json"

  override fun insert(uri: Uri, values: ContentValues?): Uri {
    throw UnsupportedOperationException("Read only")
  }

  override fun delete(
    uri: Uri,
    selection: String?,
    selectionArgs: Array<out String>?
  ): Int {
    throw UnsupportedOperationException("Read only")
  }

  override fun update(
    uri: Uri,
    values: ContentValues?,
    selection: String?,
    selectionArgs: Array<out String>?
  ): Int {
    throw UnsupportedOperationException("Read only")
  }
}
