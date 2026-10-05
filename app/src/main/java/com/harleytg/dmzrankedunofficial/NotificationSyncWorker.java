package com.harleytg.dmzranked;

import android.content.Context;
import android.content.SharedPreferences;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

public class NotificationSyncWorker extends Worker {
    private static final String PUBLIC_STATE_URL =
            "https://dmzranked.com/api/v1/data/public-state";

    public NotificationSyncWorker(
            @NonNull Context appContext,
            @NonNull WorkerParameters workerParams) {
        super(appContext, workerParams);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context context = getApplicationContext();
        SharedPreferences prefs =
                context.getSharedPreferences(NotificationSync.PREFS, Context.MODE_PRIVATE);
        return syncNow(context, true);
    }

    static Result syncNow(Context context, boolean skipWhileAppForeground) {
        SharedPreferences prefs =
                context.getSharedPreferences(NotificationSync.PREFS, Context.MODE_PRIVATE);

        if (!prefs.getBoolean(NotificationSync.PREF_SITE_NOTIFICATIONS, true)) {
            return Result.success();
        }

        try {
            JSONObject root = fetchPublicState();
            syncSeason(context, prefs, root);

            String selected = clean(
                    prefs.getString(NotificationSync.PREF_SELECTED_OPERATOR, ""));
            if (selected.isEmpty()) {
                markSync(prefs, "OK • no operator selected");
                return Result.success();
            }

            JSONArray players = root.optJSONArray("players");
            JSONArray raids = root.optJSONArray("raids");
            if (players == null || raids == null) {
                markSync(prefs, "ERROR • invalid public state");
                return Result.retry();
            }

            JSONObject player = findPlayer(players, selected);
            if (player == null) {
                markSync(prefs, "OK • selected operator not found");
                return Result.success();
            }

            String playerId = clean(player.optString("id", ""));
            String canonicalName = clean(player.optString("name", selected));
            String operatorKey =
                    (playerId + "|" + canonicalName.toLowerCase(Locale.US)).trim();

            JSONObject nextRaids = collectRaids(raids, playerId, canonicalName);
            int nextPlayerReports = Math.max(0, player.optInt("reports", 0));

            boolean baselineReady =
                    prefs.getBoolean(NotificationSync.PREF_BASELINE_READY, false);
            String previousOperatorKey =
                    prefs.getString(NotificationSync.PREF_BASELINE_OPERATOR_KEY, "");

            if (!baselineReady || !operatorKey.equals(previousOperatorKey)) {
                NotificationSync.saveBaseline(
                        prefs, operatorKey, nextPlayerReports, nextRaids);
                return Result.success();
            }

            int previousPlayerReports =
                    prefs.getInt(NotificationSync.PREF_BASELINE_PLAYER_REPORTS, 0);
            JSONObject previousRaids;
            try {
                previousRaids = new JSONObject(
                        prefs.getString(NotificationSync.PREF_BASELINE_RAIDS, "{}"));
            } catch (JSONException ignored) {
                previousRaids = new JSONObject();
            }

            boolean appForeground =
                    prefs.getBoolean(NotificationSync.PREF_APP_FOREGROUND, false);

            // WorkManager stays out of the way while the UI is visible, but the
            // dedicated live-alert foreground service intentionally calls this
            // method with skipWhileAppForeground=false so it remains the single
            // authoritative report/review detector both on- and off-app.
            if (skipWhileAppForeground && appForeground) {
                markSync(prefs, "OK • app active");
                return Result.success();
            }

            if (nextPlayerReports > previousPlayerReports) {
                NotificationSync.postNotification(
                        context,
                        "[Reports] Operator reported",
                        "Hey " + canonicalName + " — your operator profile was reported",
                        "operator-report:" + playerId + ":" + nextPlayerReports);
            }

            JSONArray raidIds = nextRaids.names();
            if (raidIds != null) {
                for (int i = 0; i < raidIds.length(); i++) {
                    String raidId = raidIds.optString(i, "");
                    if (raidId.isEmpty()) continue;

                    JSONObject next = nextRaids.optJSONObject(raidId);
                    JSONObject previous = previousRaids.optJSONObject(raidId);
                    if (next == null) continue;
                    if (previous == null) previous = new JSONObject();

                    int nextReports = next.optInt("reports", 0);
                    int previousReports = previous.optInt("reports", 0);
                    boolean nextPending = next.optBoolean("pending", false);
                    boolean previousPending = previous.optBoolean("pending", false);
                    boolean nextVerified = next.optBoolean("verified", false);
                    boolean previousVerified = previous.optBoolean("verified", false);

                    if (nextReports > previousReports) {
                        NotificationSync.postNotification(
                                context,
                                "[Reports] Raid reported",
                                "Hey " + canonicalName + " — one of your raids was reported",
                                "raid-report:" + raidId + ":" + nextReports);
                    }

                    if (nextPending && !previousPending) {
                        String reason = clean(next.optString("pendingReason", ""));
                        String body =
                                "Hey " + canonicalName + " — one of your raids is under review";
                        if (!reason.isEmpty()) body += " • " + shorten(reason, 160);
                        NotificationSync.postNotification(
                                context,
                                "[Review] Raid under review",
                                body,
                                "raid-review:" + raidId);
                    }

                    if (nextVerified && !previousVerified) {
                        NotificationSync.postNotification(
                                context,
                                "[Approved] Raid approved",
                                "Hey " + canonicalName
                                        + " — one of your raids was approved and verified",
                                "raid-verified:" + raidId);
                    }
                }
            }

            JSONArray previousRaidIds = previousRaids.names();
            if (previousRaidIds != null) {
                for (int i = 0; i < previousRaidIds.length(); i++) {
                    String raidId = previousRaidIds.optString(i, "");
                    if (raidId.isEmpty() || nextRaids.has(raidId)) continue;

                    NotificationSync.postNotification(
                            context,
                            "[Raids] Raid removed",
                            "Hey " + canonicalName
                                    + " — one of your raids is no longer on the live board.",
                            "raid-removed:" + raidId);
                }
            }

            NotificationSync.saveBaseline(prefs, operatorKey, nextPlayerReports, nextRaids);
            markSync(prefs, "OK");
            return Result.success();
        } catch (IOException | JSONException error) {
            markSync(prefs, "ERROR • " + shorten(error.getMessage(), 120));
            return Result.retry();
        } catch (Throwable error) {
            markSync(prefs, "ERROR • " + shorten(error.getMessage(), 120));
            return Result.retry();
        }
    }

    private static void syncSeason(
            Context context,
            SharedPreferences prefs,
            JSONObject root) {
        JSONObject meta = root.optJSONObject("meta");
        JSONObject season = meta == null ? null : meta.optJSONObject("season");
        if (season == null) return;

        String name = clean(season.optString("name", ""));
        String key = name + "|" + season.optLong("updatedAt", 0L);
        String previous =
                prefs.getString(NotificationSync.PREF_BASELINE_SEASON, "");

        if (!previous.isEmpty()
                && !key.equals(previous)) {
            NotificationSync.postNotification(
                    context,
                    "[System] Season update",
                    name.isEmpty()
                            ? "DMZ Ranked season information changed."
                            : "DMZ Ranked is now showing " + name + ".",
                    "season:" + key);
        }

        prefs.edit()
                .putString(NotificationSync.PREF_BASELINE_SEASON, key)
                .apply();
    }

    private static JSONObject findPlayer(JSONArray players, String selected) {
        for (int i = 0; i < players.length(); i++) {
            JSONObject player = players.optJSONObject(i);
            if (player == null) continue;
            String name = clean(player.optString("name", ""));
            if (name.equalsIgnoreCase(selected)) return player;
        }
        return null;
    }

    private static JSONObject collectRaids(
            JSONArray raids,
            String playerId,
            String playerName) throws JSONException {
        JSONObject out = new JSONObject();

        for (int i = 0; i < raids.length(); i++) {
            JSONObject raid = raids.optJSONObject(i);
            if (raid == null) continue;

            String raidPlayerId = clean(raid.optString("playerId", ""));
            String raidPlayerName = clean(raid.optString("playerName", ""));
            boolean belongs = !playerId.isEmpty() && playerId.equals(raidPlayerId);
            if (!belongs) belongs = raidPlayerName.equalsIgnoreCase(playerName);
            if (!belongs) continue;

            String raidId = clean(raid.optString("id", ""));
            if (raidId.isEmpty()) continue;

            JSONObject snapshot = new JSONObject();
            snapshot.put("reports", Math.max(0, raid.optInt("reports", 0)));
            snapshot.put("pending", raid.optBoolean("pending", false));
            snapshot.put("verified", raid.optBoolean("verified", false));
            snapshot.put(
                    "pendingReason",
                    clean(raid.optString("pendingReason", "")));
            out.put(raidId, snapshot);
        }

        return out;
    }

    private static JSONObject fetchPublicState()
            throws IOException, JSONException {
        HttpURLConnection connection = null;
        try {
            connection =
                    (HttpURLConnection) new URL(PUBLIC_STATE_URL).openConnection();
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(10000);
            connection.setReadTimeout(10000);
            connection.setUseCaches(false);
            connection.setRequestProperty("Accept", "application/json");
            connection.setRequestProperty("Cache-Control", "no-cache");
            connection.setRequestProperty(
                    "User-Agent",
                    "Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36 DMZRanked/1.0.52");
            connection.setRequestProperty("Referer", "https://dmzranked.com/");
            connection.setRequestProperty("Accept-Language", "en-US,en;q=0.9");

            int status = connection.getResponseCode();
            if (status < 200 || status >= 300) {
                throw new IOException(
                        "DMZ Ranked public-state HTTP " + status);
            }

            try (InputStream stream = connection.getInputStream();
                 BufferedReader reader =
                         new BufferedReader(
                                 new InputStreamReader(
                                         stream,
                                         StandardCharsets.UTF_8))) {
                StringBuilder body = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    body.append(line);
                    if (body.length() > 4_000_000) {
                        throw new IOException(
                                "DMZ Ranked public-state response is too large");
                    }
                }
                return new JSONObject(body.toString());
            }
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private static void markSync(SharedPreferences prefs, String result) {
        if (prefs == null) return;
        prefs.edit()
                .putLong(NotificationSync.PREF_LAST_SYNC_MS, System.currentTimeMillis())
                .putString(NotificationSync.PREF_LAST_SYNC_RESULT,
                        result == null || result.trim().isEmpty() ? "OK" : result.trim())
                .apply();
    }

    private static String clean(String value) {
        return value == null
                ? ""
                : value.trim().replaceAll("\\s+", " ");
    }

    private static String shorten(String value, int max) {
        String text = clean(value);
        if (text.length() <= max) return text;
        return text.substring(0, Math.max(0, max - 1)) + "…";
    }
}
