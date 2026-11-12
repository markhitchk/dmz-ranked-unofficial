package com.harleytg.dmzranked;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;

import org.json.JSONObject;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Iterator;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Explicit, signed-source transfer from the previous DMZ Ranked Android apps
 * to the new Ranked Hub Beta package. No WebView storage or auth is transferred.
 */
final class RankedHubDataTransfer {
    static final String OLD_BETA = "com.harleytg.dmzranked.beta";
    static final String OLD_STABLE = "com.harleytg.dmzranked";
    static final int MAX_TRANSFER_BYTES = 6_000_000;
    static final int MAX_OPERATOR_VALUE_CHARS = 120_000;

    static final Set<String> SAFE_BOOLEAN_KEYS = new HashSet<>(Arrays.asList(
            "desktop_site", "keep_awake", "verbose_loading", "site_notifications",
            "pull_to_refresh", "remember_last_page", "operator_auto_save",
            "app_animations"));
    static final Set<String> SAFE_STRING_KEYS = new HashSet<>(Arrays.asList(
            "content_size", "website_selected_operator"));

    private static final Pattern BLOCKED_KEY = Pattern.compile(
            "pin|pass(word|code)?|token|auth|session|secret|cookie|credential"
                    + "|jwt|bearer|csrf|oauth|api[_.-]?key",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern BLOCKED_VALUE = Pattern.compile(
            "(?:[\\\"']?(?:access_?token|refresh_?token|password|passcode|"
                    + "session|secret|authorization|oauth|jwt|api_?key)[\\\"']?\\s*[:=])"
                    + "|(?:eyJ[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,})",
            Pattern.CASE_INSENSITIVE);

    static final class Result {
        final int settings;
        final int operators;
        Result(int settings, int operators) {
            this.settings = settings;
            this.operators = operators;
        }
    }

    private RankedHubDataTransfer() {}

    private static boolean allowedSource(String packageName) {
        return OLD_BETA.equals(packageName) || OLD_STABLE.equals(packageName);
    }

    static boolean isSourceAvailable(Context context, String sourcePackage) {
        if (context == null || !allowedSource(sourcePackage)) return false;
        PackageManager pm = context.getPackageManager();
        if (pm.checkSignatures(context.getPackageName(), sourcePackage)
                != PackageManager.SIGNATURE_MATCH) return false;
        return pm.resolveContentProvider(sourcePackage + ".migration", 0) != null;
    }

    static Result importFrom(Context context, String sourcePackage,
                             SharedPreferences preferences) throws Exception {
        if (!isSourceAvailable(context, sourcePackage)) {
            throw new SecurityException("Untrusted or missing previous app");
        }
        JSONObject payload;
        Uri uri = Uri.parse("content://" + sourcePackage + ".migration/export");
        try (Cursor cursor = context.getContentResolver().query(
                uri, new String[]{"payload"}, null, null, null)) {
            if (cursor == null || !cursor.moveToFirst()) {
                throw new IllegalStateException("No export payload available");
            }
            int column = cursor.getColumnIndex("payload");
            if (column < 0) throw new IllegalStateException("Invalid migration response");
            String raw = cursor.getString(column);
            if (raw == null || raw.isEmpty() || raw.length() > MAX_TRANSFER_BYTES) {
                throw new IllegalStateException("Migration payload missing or oversized");
            }
            payload = new JSONObject(raw);
        }
        if (!sourcePackage.equals(payload.optString("sourcePackage", ""))) {
            throw new SecurityException("Unexpected migration source");
        }

        JSONObject oldPrefs = payload.optJSONObject("preferences");
        SharedPreferences.Editor editor = preferences.edit();
        int count = 0;
        if (oldPrefs != null) {
            for (String key : SAFE_BOOLEAN_KEYS) {
                if (oldPrefs.opt(key) instanceof Boolean) {
                    editor.putBoolean(key, oldPrefs.optBoolean(key));
                    count++;
                }
            }
            for (String key : SAFE_STRING_KEYS) {
                if (!(oldPrefs.opt(key) instanceof String)) continue;
                String value = oldPrefs.optString(key, "").trim();
                if ("content_size".equals(key)) {
                    if (!("compact".equals(value) || "standard".equals(value)
                            || "large".equals(value))) continue;
                } else {
                    if (value.length() > 80 || blockedValue(value)) continue;
                }
                editor.putString(key, value);
                count++;
            }
        }
        // Verification on the old device must never authenticate the new app.
        editor.putBoolean("website_operator_verified", false);
        editor.putString("website_operator_source", "Imported from previous app");
        editor.putLong("website_operator_sync_ms", System.currentTimeMillis());

        JSONObject backups = payload.optJSONObject("operatorBackups");
        JSONObject safeBackups = sanitizeOperatorBackups(backups);
        int operators = OperatorBackupStore.importJson(context, safeBackups.toString());
        if (!editor.commit()) throw new IllegalStateException("Could not save app preferences");
        return new Result(count, operators);
    }

    static boolean blockedKey(String key) {
        return key == null || key.isEmpty() || key.length() > 100
                || BLOCKED_KEY.matcher(key).find();
    }

    static boolean blockedValue(String value) {
        return value == null || value.length() > MAX_OPERATOR_VALUE_CHARS
                || BLOCKED_VALUE.matcher(value).find();
    }

    static JSONObject sanitizeOperatorBackups(JSONObject oldBackups) throws Exception {
        JSONObject safe = new JSONObject();
        if (oldBackups == null) return safe;
        int records = 0;
        Iterator<String> names = oldBackups.keys();
        while (names.hasNext() && records < 2) {
            String ignoredIndex = names.next();
            JSONObject record = oldBackups.optJSONObject(ignoredIndex);
            if (record == null) continue;
            String operator = record.optString("operator", "").trim();
            if (operator.isEmpty() || operator.length() > 80 || blockedValue(operator)) continue;
            JSONObject oldStorage = record.optJSONObject("storage");
            if (oldStorage == null) continue;
            JSONObject cleanedStorage = new JSONObject();
            Iterator<String> keys = oldStorage.keys();
            while (keys.hasNext()) {
                String key = keys.next();
                if (blockedKey(key)) continue;
                Object item = oldStorage.opt(key);
                if (!(item instanceof String)) continue;
                String value = (String) item;
                if (blockedValue(value)) continue;
                cleanedStorage.put(key, value);
            }
            // Preserve the selected operator name but never a saved PIN/session.
            cleanedStorage.put("dmz_myname", operator);
            JSONObject cleaned = new JSONObject();
            cleaned.put("operator", operator);
            cleaned.put("storage", cleanedStorage);
            cleaned.put("origin", "https://dmzranked.com");
            cleaned.put("savedAt", record.optLong("savedAt", System.currentTimeMillis()));
            cleaned.put("protected", record.optBoolean("protected", false));
            safe.put(operator.toLowerCase(java.util.Locale.US), cleaned);
            records++;
        }
        return safe;
    }
}
