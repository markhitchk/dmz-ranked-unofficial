package com.harleytg.dmzranked;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;

/**
 * Polls DMZ Ranked's public-state API while the app is active and compares the
 * selected operator with the last successful snapshot saved on this device.
 *
 * This intentionally stores no PIN or authentication data. It complements the
 * WebView's immediate submit/under-review hooks with cross-device/public changes
 * that are visible through /api/v1/data/public-state.
 */
public final class DmzPublicStateMonitor {
    public interface Listener {
        void onEvent(String message);
    }

    private static final String TAG = "DMZPublicState";
    private static final String APP_PREFS = "dmz_ranked_settings";
    private static final String MONITOR_PREFS = "dmz_ranked_public_state_monitor";
    private static final String PREF_SELECTED_OPERATOR = "website_selected_operator";
    private static final String PREF_SITE_NOTIFICATIONS = "site_notifications";
    private static final String PUBLIC_STATE_URL = "https://dmzranked.com/api/v1/data/public-state";
    private static final long POLL_MS = 45_000L;
    private static final long REMOVAL_RECENCY_MS = 14L * 24L * 60L * 60L * 1000L;
    private static final int CONNECT_TIMEOUT_MS = 8_000;
    private static final int READ_TIMEOUT_MS = 12_000;
    private static final int MAX_JSON_CHARS = 12_000_000;

    private final Context appContext;
    private final SharedPreferences appPrefs;
    private final SharedPreferences monitorPrefs;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final Listener listener;

    private volatile boolean running;
    private volatile boolean requestInFlight;

    private final Runnable pollRunnable = new Runnable() {
        @Override
        public void run() {
            if (!running) return;
            pollOnce();
            mainHandler.postDelayed(this, POLL_MS);
        }
    };

    public DmzPublicStateMonitor(Context context, Listener listener) {
        appContext = context.getApplicationContext();
        appPrefs = appContext.getSharedPreferences(APP_PREFS, Context.MODE_PRIVATE);
        monitorPrefs = appContext.getSharedPreferences(MONITOR_PREFS, Context.MODE_PRIVATE);
        this.listener = listener;
    }

    public void start() {
        if (running) return;
        running = true;
        mainHandler.removeCallbacks(pollRunnable);
        mainHandler.post(pollRunnable);
    }

    public void stop() {
        running = false;
        mainHandler.removeCallbacks(pollRunnable);
    }

    public void pollNow() {
        if (!running) return;
        mainHandler.removeCallbacks(pollRunnable);
        mainHandler.post(pollRunnable);
    }

    private void pollOnce() {
        if (requestInFlight || !appPrefs.getBoolean(PREF_SITE_NOTIFICATIONS, true)) return;
        final String operator = clean(appPrefs.getString(PREF_SELECTED_OPERATOR, ""));
        if (operator.isEmpty()) return;

        requestInFlight = true;
        new Thread(() -> {
            try {
                JSONObject root = fetchJson(PUBLIC_STATE_URL);
                JSONObject snapshot = buildSnapshot(root, operator);
                if (snapshot != null) {
                    mainHandler.post(() -> applySnapshot(operator, snapshot));
                }
            } catch (Throwable error) {
                Log.d(TAG, "Public-state poll unavailable", error);
            } finally {
                requestInFlight = false;
            }
        }, "DMZPublicStatePoll").start();
    }

    private JSONObject buildSnapshot(JSONObject root, String operatorName) throws Exception {
        JSONArray players = root.optJSONArray("players");
        JSONArray raids = root.optJSONArray("raids");
        if (players == null || raids == null) return null;

        JSONObject player = null;
        for (int i = 0; i < players.length(); i++) {
            JSONObject candidate = players.optJSONObject(i);
            if (candidate == null) continue;
            if (clean(candidate.optString("name", "")).equalsIgnoreCase(operatorName)) {
                player = candidate;
                break;
            }
        }
        if (player == null) return null;

        String playerId = clean(player.optString("id", ""));
        JSONObject raidMap = new JSONObject();
        for (int i = 0; i < raids.length(); i++) {
            JSONObject raid = raids.optJSONObject(i);
            if (raid == null) continue;
            String raidPlayerId = clean(raid.optString("playerId", ""));
            String raidPlayerName = clean(raid.optString("playerName", ""));
            if (!playerId.isEmpty()) {
                if (!playerId.equals(raidPlayerId)) continue;
            } else if (!raidPlayerName.equalsIgnoreCase(operatorName)) {
                continue;
            }

            String id = clean(raid.optString("id", ""));
            if (id.isEmpty()) continue;
            JSONObject compact = new JSONObject();
            compact.put("verified", raid.optBoolean("verified", false));
            compact.put("reports", Math.max(0, raid.optInt("reports", 0)));
            compact.put("ts", raid.optLong("ts", 0L));
            raidMap.put(id, compact);
        }

        JSONObject snapshot = new JSONObject();
        snapshot.put("name", clean(player.optString("name", operatorName)));
        snapshot.put("playerId", playerId);
        snapshot.put("reports", Math.max(0, player.optInt("reports", 0)));
        snapshot.put("checkedAt", System.currentTimeMillis());
        snapshot.put("raids", raidMap);
        return snapshot;
    }

    private void applySnapshot(String requestedOperator, JSONObject current) {
        try {
            String actualName = clean(current.optString("name", requestedOperator));
            String key = snapshotKey(requestedOperator);
            String rawPrevious = monitorPrefs.getString(key, "");
            JSONObject previous = rawPrevious == null || rawPrevious.trim().isEmpty()
                    ? null : new JSONObject(rawPrevious);

            if (previous != null
                    && clean(previous.optString("name", "")).equalsIgnoreCase(actualName)) {
                List<String> events = compare(previous, current, actualName);
                for (String event : events) {
                    if (listener != null && running) listener.onEvent(event);
                }
            }

            monitorPrefs.edit().putString(key, current.toString()).apply();
            DmzRankedWidgetProvider.requestUpdateAll(appContext);
        } catch (Throwable error) {
            Log.d(TAG, "Could not apply public-state snapshot", error);
        }
    }

    private List<String> compare(JSONObject previous, JSONObject current, String name) {
        List<String> events = new ArrayList<>();

        int oldPlayerReports = Math.max(0, previous.optInt("reports", 0));
        int newPlayerReports = Math.max(0, current.optInt("reports", 0));
        if (newPlayerReports > oldPlayerReports) {
            int delta = newPlayerReports - oldPlayerReports;
            events.add("[REPORT]Hey " + name + " — your operator received "
                    + (delta == 1 ? "a new report" : delta + " new reports"));
        }

        JSONObject oldRaids = previous.optJSONObject("raids");
        JSONObject newRaids = current.optJSONObject("raids");
        if (oldRaids == null) oldRaids = new JSONObject();
        if (newRaids == null) newRaids = new JSONObject();

        int newRaidCount = 0;
        int approvedCount = 0;
        int raidReportCount = 0;
        int removedCount = 0;

        Iterator<String> newKeys = newRaids.keys();
        while (newKeys.hasNext()) {
            String id = newKeys.next();
            JSONObject now = newRaids.optJSONObject(id);
            if (now == null) continue;
            JSONObject before = oldRaids.optJSONObject(id);
            if (before == null) {
                if (now.optBoolean("verified", false)) approvedCount++;
                else newRaidCount++;
                continue;
            }
            if (!before.optBoolean("verified", false) && now.optBoolean("verified", false)) {
                approvedCount++;
            }
            if (now.optInt("reports", 0) > before.optInt("reports", 0)) {
                raidReportCount++;
            }
        }

        long nowMs = System.currentTimeMillis();
        Iterator<String> oldKeys = oldRaids.keys();
        while (oldKeys.hasNext()) {
            String id = oldKeys.next();
            if (newRaids.has(id)) continue;
            JSONObject before = oldRaids.optJSONObject(id);
            long raidTs = before == null ? 0L : before.optLong("ts", 0L);
            if (raidTs <= 0L || nowMs - raidTs <= REMOVAL_RECENCY_MS) removedCount++;
        }

        if (newRaidCount > 0) {
            events.add("[RAID]Hey " + name + " — "
                    + (newRaidCount == 1 ? "a raid was just logged under your name"
                    : newRaidCount + " raids were logged under your name"));
        }
        if (approvedCount > 0) {
            events.add("[APPROVED]Hey " + name + " — "
                    + (approvedCount == 1 ? "your raid was approved and now counts"
                    : approvedCount + " raids were approved and now count"));
        }
        if (raidReportCount > 0) {
            events.add("[REPORT]Hey " + name + " — "
                    + (raidReportCount == 1 ? "one of your raids was reported"
                    : raidReportCount + " of your raids received new reports"));
        }
        if (removedCount > 0) {
            events.add("[REMOVED]Hey " + name + " — "
                    + (removedCount == 1 ? "one of your recent raids was removed"
                    : removedCount + " recent raids were removed"));
        }

        return events;
    }

    private JSONObject fetchJson(String urlString) throws Exception {
        HttpURLConnection connection = null;
        InputStream input = null;
        BufferedReader reader = null;
        try {
            connection = (HttpURLConnection) new URL(urlString).openConnection();
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(CONNECT_TIMEOUT_MS);
            connection.setReadTimeout(READ_TIMEOUT_MS);
            connection.setUseCaches(false);
            connection.setRequestProperty("Accept", "application/json");
            connection.setRequestProperty("Cache-Control", "no-cache");
            connection.setRequestProperty("User-Agent",
                    "DMZRankedAndroid/1.0.40 (HarleysStudios; PublicStateMonitor; com.harleytg.dmzranked)");

            int code = connection.getResponseCode();
            if (code < 200 || code >= 300) {
                throw new IllegalStateException("DMZ Ranked returned HTTP " + code);
            }

            input = connection.getInputStream();
            reader = new BufferedReader(new InputStreamReader(input, StandardCharsets.UTF_8));
            StringBuilder body = new StringBuilder(256 * 1024);
            char[] buffer = new char[8192];
            int read;
            while ((read = reader.read(buffer)) >= 0) {
                body.append(buffer, 0, read);
                if (body.length() > MAX_JSON_CHARS) {
                    throw new IllegalStateException("Public-state response was unexpectedly large");
                }
            }
            return new JSONObject(body.toString());
        } finally {
            try {
                if (reader != null) reader.close();
            } catch (Throwable ignored) {
            }
            try {
                if (input != null) input.close();
            } catch (Throwable ignored) {
            }
            if (connection != null) connection.disconnect();
        }
    }

    private static String snapshotKey(String operator) {
        String normalized = clean(operator).toLowerCase(Locale.US);
        return "operator_" + Integer.toHexString(normalized.hashCode());
    }

    private static String clean(String value) {
        return value == null ? "" : value.replaceAll("\s+", " ").trim();
    }
}
