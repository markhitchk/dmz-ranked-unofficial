package com.harleytg.dmzranked;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;

import org.json.JSONObject;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/**
 * Read-only bridge used by the stable and beta packages to exchange safe app data
 * side by side. No cookies, passwords, PINs, tokens, sessions, auth
 * values, or WebView private files are exposed.
 */
public final class MigrationProvider extends ContentProvider {
    private static final String PREFS = "dmz_ranked_settings";
    private static final Set<String> SAFE_PREF_KEYS = new HashSet<>(Arrays.asList(
            "desktop_site",
            "keep_awake",
            "verbose_loading",
            "site_notifications",
            "pull_to_refresh",
            "remember_last_page",
            "last_page_url",
            "website_selected_operator",
            "website_operator_verified",
            "website_operator_protected",
            "website_operator_source",
            "website_operator_sync_ms",
            "operator_auto_save",
            "content_size",
            "app_animations"
    ));

    @Override
    public boolean onCreate() {
        return true;
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection,
                        String[] selectionArgs, String sortOrder) {
        MatrixCursor cursor = new MatrixCursor(new String[]{"payload"});
        if (getContext() == null || uri == null
                || uri.getPath() == null
                || !"/export".equals(uri.getPath())) {
            return cursor;
        }

        try {
            JSONObject payload = new JSONObject();
            JSONObject prefsJson = new JSONObject();
            SharedPreferences prefs =
                    getContext().getSharedPreferences(PREFS, 0);

            for (String key : SAFE_PREF_KEYS) {
                if (!prefs.contains(key)) continue;
                Object value = prefs.getAll().get(key);
                if (value instanceof Boolean || value instanceof Integer
                        || value instanceof Long || value instanceof Float
                        || value instanceof String) {
                    prefsJson.put(key, value);
                }
            }

            payload.put("sourcePackage", getContext().getPackageName());
            payload.put("preferences", prefsJson);
            payload.put("operatorBackups", OperatorBackupStore.exportJson(getContext()));
            cursor.addRow(new Object[]{payload.toString()});
        } catch (Throwable ignored) {
        }
        return cursor;
    }

    @Override
    public String getType(Uri uri) {
        return "application/json";
    }

    @Override
    public Uri insert(Uri uri, ContentValues values) {
        throw new UnsupportedOperationException("Read only");
    }

    @Override
    public int delete(Uri uri, String selection, String[] selectionArgs) {
        throw new UnsupportedOperationException("Read only");
    }

    @Override
    public int update(Uri uri, ContentValues values, String selection,
                      String[] selectionArgs) {
        throw new UnsupportedOperationException("Read only");
    }
}
