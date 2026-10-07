package com.harleytg.dmzranked.legacy;

import expo.modules.dmzmigration.R;
import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.Iterator;
import java.util.Locale;

final class OperatorBackupStore {
    private static final String PREFS = "dmz_operator_backups";
    private static final String KEY_BACKUPS = "backups_v1";
    private static final int MAX_OPERATORS = 2;
    private static final int MAX_SNAPSHOT_CHARS = 1_500_000;

    private OperatorBackupStore() {
    }

    static boolean save(Context context, String operatorName, String snapshotJson) {
        String name = cleanName(operatorName);
        if (context == null || name.isEmpty() || snapshotJson == null
                || snapshotJson.length() > MAX_SNAPSHOT_CHARS) {
            return false;
        }

        try {
            JSONObject snapshot = new JSONObject(snapshotJson);
            JSONObject storage = snapshot.optJSONObject("storage");
            if (storage == null) return false;

            // dmzranked.com restores the local operator from this exact key. Keep it
            // tied to the backup record even if the site had a stale value when captured.
            storage.put("dmz_myname", name);

            JSONObject root = loadRoot(context);
            JSONObject record = new JSONObject();
            record.put("operator", name);
            record.put("savedAt", System.currentTimeMillis());
            record.put("origin", snapshot.optString("origin", "https://dmzranked.com"));
            record.put("storage", storage);
            record.put("entryCount", storage.length());
            record.put("protected", snapshot.optBoolean("protected", false));

            root.put(normalize(name), record);
            prune(root);

            return prefs(context).edit()
                    .putString(KEY_BACKUPS, root.toString())
                    .commit();
        } catch (Throwable ignored) {
            return false;
        }
    }

    static JSONObject get(Context context, String operatorName) {
        String name = cleanName(operatorName);
        if (context == null || name.isEmpty()) return null;
        try {
            return loadRoot(context).optJSONObject(normalize(name));
        } catch (Throwable ignored) {
            return null;
        }
    }

    static JSONObject latest(Context context) {
        if (context == null) return null;
        try {
            JSONObject root = loadRoot(context);
            JSONObject latest = null;
            long newest = Long.MIN_VALUE;
            Iterator<String> keys = root.keys();
            while (keys.hasNext()) {
                JSONObject record = root.optJSONObject(keys.next());
                if (record == null) continue;
                long savedAt = record.optLong("savedAt", 0L);
                if (latest == null || savedAt > newest) {
                    latest = record;
                    newest = savedAt;
                }
            }
            return latest;
        } catch (Throwable ignored) {
            return null;
        }
    }

    static int backupCount(Context context) {
        try {
            return loadRoot(context).length();
        } catch (Throwable ignored) {
            return 0;
        }
    }

    static String exportJson(Context context) {
        if (context == null) return "{}";
        try {
            return loadRoot(context).toString();
        } catch (Throwable ignored) {
            return "{}";
        }
    }

    static int importJson(Context context, String raw) {
        if (context == null || raw == null || raw.trim().isEmpty()) return 0;
        try {
            JSONObject incoming = new JSONObject(raw);
            JSONObject root = loadRoot(context);
            int imported = 0;
            Iterator<String> keys = incoming.keys();
            while (keys.hasNext()) {
                String key = keys.next();
                JSONObject record = incoming.optJSONObject(key);
                if (record == null) continue;
                String name = operatorName(record);
                JSONObject storage = record.optJSONObject("storage");
                if (name.isEmpty() || storage == null) continue;

                JSONObject clean = new JSONObject();
                clean.put("operator", name);
                clean.put("savedAt", record.optLong("savedAt", System.currentTimeMillis()));
                clean.put("origin", record.optString("origin", "https://dmzranked.com"));
                clean.put("storage", storage);
                clean.put("entryCount", storage.length());
                clean.put("protected", record.optBoolean("protected", false));
                root.put(normalize(name), clean);
                imported++;
            }
            prune(root);
            prefs(context).edit().putString(KEY_BACKUPS, root.toString()).commit();
            return Math.min(imported, MAX_OPERATORS);
        } catch (Throwable ignored) {
            return 0;
        }
    }

    static String[] operatorNames(Context context) {
        if (context == null) return new String[0];
        try {
            JSONObject root = loadRoot(context);
            ArrayList<JSONObject> records = new ArrayList<>();
            Iterator<String> keys = root.keys();
            while (keys.hasNext()) {
                JSONObject record = root.optJSONObject(keys.next());
                if (record != null) records.add(record);
            }
            Collections.sort(records, new Comparator<JSONObject>() {
                @Override
                public int compare(JSONObject left, JSONObject right) {
                    return Long.compare(savedAt(right), savedAt(left));
                }
            });
            ArrayList<String> names = new ArrayList<>();
            for (JSONObject record : records) {
                String name = operatorName(record);
                if (!name.isEmpty()) names.add(name);
                if (names.size() >= MAX_OPERATORS) break;
            }
            return names.toArray(new String[0]);
        } catch (Throwable ignored) {
            return new String[0];
        }
    }

    static String operatorName(JSONObject record) {
        return record == null ? "" : cleanName(record.optString("operator", ""));
    }

    static long savedAt(JSONObject record) {
        return record == null ? 0L : record.optLong("savedAt", 0L);
    }

    static int entryCount(JSONObject record) {
        if (record == null) return 0;
        JSONObject storage = record.optJSONObject("storage");
        return storage == null ? 0 : storage.length();
    }

    static boolean isProtected(JSONObject record) {
        return record != null && record.optBoolean("protected", false);
    }

    static String buildRestoreScript(JSONObject record) {
        if (record == null) return null;
        JSONObject storage = record.optJSONObject("storage");
        if (storage == null || storage.length() == 0) return null;

        StringBuilder script = new StringBuilder();
        script.append("(function(){try{var restored=0;");
        Iterator<String> keys = storage.keys();
        while (keys.hasNext()) {
            String key = keys.next();
            String value = storage.optString(key, null);
            if (key == null || value == null) continue;
            script.append("localStorage.setItem(")
                    .append(JSONObject.quote(key))
                    .append(",")
                    .append(JSONObject.quote(value))
                    .append(");restored++;");
        }
        String operator = operatorName(record);
        if (!operator.isEmpty()) {
            // Apply this last so an older snapshot can never restore a different operator.
            script.append("localStorage.setItem('dmz_myname',")
                    .append(JSONObject.quote(operator))
                    .append(");");
        }
        script.append("return 'restored:'+restored;}catch(e){return 'error:'+String(e&&e.message||e);}})()");
        return script.toString();
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static JSONObject loadRoot(Context context) {
        try {
            String raw = prefs(context).getString(KEY_BACKUPS, "{}");
            JSONObject root = new JSONObject(raw == null ? "{}" : raw);
            // Enforce the two-operator cap for existing installs too, not only after the next save.
            int before = root.length();
            prune(root);
            if (root.length() != before) {
                prefs(context).edit().putString(KEY_BACKUPS, root.toString()).apply();
            }
            return root;
        } catch (Throwable ignored) {
            return new JSONObject();
        }
    }

    private static void prune(JSONObject root) {
        if (root == null || root.length() <= MAX_OPERATORS) return;

        ArrayList<String> keys = new ArrayList<>();
        Iterator<String> iterator = root.keys();
        while (iterator.hasNext()) keys.add(iterator.next());

        Collections.sort(keys, new Comparator<String>() {
            @Override
            public int compare(String left, String right) {
                JSONObject a = root.optJSONObject(left);
                JSONObject b = root.optJSONObject(right);
                long aTime = a == null ? 0L : a.optLong("savedAt", 0L);
                long bTime = b == null ? 0L : b.optLong("savedAt", 0L);
                return Long.compare(bTime, aTime);
            }
        });

        for (int i = MAX_OPERATORS; i < keys.size(); i++) {
            root.remove(keys.get(i));
        }
    }

    private static String cleanName(String value) {
        if (value == null) return "";
        String clean = value.replaceAll("\\s+", " ").trim();
        return clean.length() > 80 ? clean.substring(0, 80) : clean;
    }

    private static String normalize(String value) {
        return cleanName(value).toLowerCase(Locale.US);
    }
}
