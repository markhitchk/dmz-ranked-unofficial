package com.harleytg.dmzranked;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.DateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Native DMZ Ranked home-screen widget.
 *
 * The widget intentionally does not embed the OBS / Netlify pages. It reads the public
 * dmzranked.com leaderboard JSON and performs the same SR/rank calculation client-side,
 * which makes the widget lighter, battery-friendly, and compatible with RemoteViews.
 */
public class DmzRankedWidgetProvider extends AppWidgetProvider {
    public static final String ACTION_REFRESH = "com.harleytg.dmzranked.action.WIDGET_REFRESH";
    private static final String EXTRA_WIDGET_ID = "dmz_widget_id";

    private static final String PREFS = "dmz_ranked_settings";
    private static final String PREF_SELECTED_OPERATOR = "website_selected_operator";
    private static final String CACHE_PREFS = "dmz_ranked_widget_cache";
    private static final String DATA_URL = "https://dmzranked.com/leaderboard.json";

    private static final int CONNECT_TIMEOUT_MS = 8_000;
    private static final int READ_TIMEOUT_MS = 12_000;
    private static final int MAX_JSON_CHARS = 12_000_000;

    private static final Tier[] TIERS = new Tier[] {
            new Tier("Iridescent", 6000, 100),
            new Tier("Crimson", 5000, 75),
            new Tier("Diamond", 4000, 60),
            new Tier("Platinum", 3000, 45),
            new Tier("Gold", 2000, 30),
            new Tier("Silver", 1000, 15),
            new Tier("Bronze", 0, 0)
    };

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        if (appWidgetIds == null || appWidgetIds.length == 0) return;
        renderLoading(context, appWidgetManager, appWidgetIds);
        refreshAsync(context, appWidgetManager, appWidgetIds);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent != null && ACTION_REFRESH.equals(intent.getAction())) {
            int requestedId = intent.getIntExtra(EXTRA_WIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
            AppWidgetManager manager = AppWidgetManager.getInstance(context);
            int[] ids;
            if (requestedId != AppWidgetManager.INVALID_APPWIDGET_ID) {
                ids = new int[] {requestedId};
            } else {
                ids = manager.getAppWidgetIds(new ComponentName(context, DmzRankedWidgetProvider.class));
            }
            renderLoading(context, manager, ids);
            refreshAsync(context, manager, ids);
            return;
        }
        super.onReceive(context, intent);
    }

    /** Refresh every pinned widget, e.g. after the app detects a different website operator. */
    public static void requestUpdateAll(Context context) {
        if (context == null) return;
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName provider = new ComponentName(context, DmzRankedWidgetProvider.class);
        int[] ids = manager.getAppWidgetIds(provider);
        if (ids == null || ids.length == 0) return;

        Intent update = new Intent(context, DmzRankedWidgetProvider.class);
        update.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
        update.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
        context.sendBroadcast(update);
    }

    private void refreshAsync(Context context, AppWidgetManager manager, int[] ids) {
        if (ids == null || ids.length == 0) return;
        final PendingResult pendingResult = goAsync();
        final Context appContext = context.getApplicationContext();
        new Thread(() -> {
            try {
                refreshNow(appContext, manager, ids);
            } finally {
                pendingResult.finish();
            }
        }, "DMZWidgetRefresh").start();
    }

    private static void refreshNow(Context context, AppWidgetManager manager, int[] ids) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String operator = clean(prefs.getString(PREF_SELECTED_OPERATOR, ""));

        if (operator.isEmpty()) {
            for (int id : ids) {
                manager.updateAppWidget(id, buildEmptyViews(context, id));
            }
            return;
        }

        WidgetStats stats = null;
        Throwable error = null;
        try {
            JSONObject root = fetchJson(DATA_URL);
            stats = resolveStats(root, operator);
            if (stats != null) saveCachedStats(context, stats);
        } catch (Throwable t) {
            error = t;
        }

        if (stats == null) {
            stats = readCachedStats(context, operator);
        }

        for (int id : ids) {
            RemoteViews views;
            if (stats != null) {
                views = buildStatsViews(context, id, stats, error != null);
            } else {
                views = buildErrorViews(context, id, operator,
                        error == null ? "Operator not found on DMZ Ranked." : "Could not reach DMZ Ranked.");
            }
            manager.updateAppWidget(id, views);
        }
    }

    private static JSONObject fetchJson(String urlString) throws Exception {
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
                    "DMZRankedAndroidWidget/1.0 (HarleysStudios; com.harleytg.dmzranked)");

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
                    throw new IllegalStateException("Leaderboard response was unexpectedly large");
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

    private static WidgetStats resolveStats(JSONObject root, String operatorName) throws Exception {
        JSONObject data = root.optJSONObject("data");
        if (data == null) return null;

        JSONArray players = data.optJSONArray("players");
        JSONArray raids = data.optJSONArray("raids");
        JSONObject season = data.optJSONObject("season");
        if (players == null || raids == null || season == null) return null;

        long seasonStart = optLongOr(season, "start", Long.MIN_VALUE);
        long seasonEnd = optLongOr(season, "end", Long.MAX_VALUE);
        boolean season2Scoring = season.optBoolean("s2", false);

        final Map<String, Standing> byId = new LinkedHashMap<>();
        for (int i = 0; i < players.length(); i++) {
            JSONObject p = players.optJSONObject(i);
            if (p == null) continue;
            String id = clean(p.optString("id", ""));
            String name = clean(p.optString("name", ""));
            if (!id.isEmpty()) byId.put(id, new Standing(id, name));
        }

        List<Raid> seasonRaids = new ArrayList<>();
        for (int i = 0; i < raids.length(); i++) {
            JSONObject obj = raids.optJSONObject(i);
            if (obj == null || obj.optBoolean("pending", false) || obj.optBoolean("deleted", false)) {
                continue;
            }
            Raid raid = Raid.from(obj);
            if (raid.ts < seasonStart || raid.ts > seasonEnd) continue;
            seasonRaids.add(raid);
        }
        Collections.sort(seasonRaids, Comparator.comparingLong(r -> r.ts));

        for (Raid raid : seasonRaids) {
            Standing standing = byId.get(raid.playerId);
            if (standing == null) {
                standing = new Standing(raid.playerId, raid.playerName.isEmpty() ? "?" : raid.playerName);
                byId.put(raid.playerId, standing);
            }

            int before = standing.sr;
            int fee = feeFor(before);
            int earned = gross(raid, season2Scoring);

            // Match the website exactly: carryover rows affect SR, but they do not
            // count toward achievement stats and do not replace the displayed last raid.
            if (!raid.hasCarryover) {
                standing.raids++;
                standing.operatorKills += raid.operatorKills;
                standing.squadKills += raid.squadKills;
                if (!"none".equals(raid.contract)) standing.contracts++;
                if (raid.extracted) standing.exfils++;
                if (raid.finalExfil) standing.finalExfils++;
                if (raid.weaponCase && raid.extracted) standing.weaponCases++;
                if (season2Scoring) standing.bossKills += Math.min(raid.bossKills, 2);

                earned += achievementBonus(standing, season2Scoring);
            }

            int after = Math.max(0, before - fee + earned);
            standing.sr = after;
            standing.peak = Math.max(standing.peak, after);
            if (!raid.hasCarryover) {
                standing.last = after - before;
            }
        }

        List<Standing> standings = new ArrayList<>(byId.values());
        Collections.sort(standings, (a, b) -> {
            int srOrder = Integer.compare(b.sr, a.sr);
            return srOrder != 0 ? srOrder : a.name.compareToIgnoreCase(b.name);
        });

        String wanted = operatorName.trim().toLowerCase(Locale.US);
        Standing mine = null;
        int position = -1;
        for (int i = 0; i < standings.size(); i++) {
            Standing candidate = standings.get(i);
            if (candidate.name.trim().toLowerCase(Locale.US).equals(wanted)) {
                mine = candidate;
                position = i + 1;
                break;
            }
        }
        if (mine == null) return null;

        RankInfo rank = rankInfo(mine.sr);
        WidgetStats stats = new WidgetStats();
        stats.name = mine.name;
        stats.sr = mine.sr;
        stats.peak = mine.peak;
        stats.lastDelta = mine.last;
        stats.position = position;
        stats.totalPlayers = standings.size();
        stats.rankLabel = rank.label.toUpperCase(Locale.US);
        stats.progressPct = rank.progressPct;
        stats.srToNext = rank.toNext;
        stats.seasonName = clean(season.optString("name", ""));
        stats.updatedAt = System.currentTimeMillis();
        stats.fromCache = false;
        return stats;
    }

    private static int achievementBonus(Standing s, boolean season2Scoring) {
        int bonus = 0;
        bonus += awardAchievement(s, "opk", s.operatorKills, new double[] {40, 90, 150, 250});
        bonus += awardAchievement(s, "exf", s.exfils, new double[] {8, 18, 32, 50});
        bonus += awardAchievement(s, "sqk", s.squadKills, new double[] {20, 45, 90, 150});
        bonus += awardAchievement(s, "wc", s.weaponCases, new double[] {4, 9, 18, 30});
        bonus += awardAchievement(s, "fin", s.finalExfils, new double[] {3, 7, 14, 25});
        bonus += awardAchievement(s, "con", s.contracts, new double[] {12, 28, 55, 100});
        bonus += awardAchievement(s, "raids", s.raids, new double[] {10, 22, 40, 65});

        if (season2Scoring) {
            bonus += awardAchievement(s, "boss", s.bossKills, new double[] {4, 9, 18, 30});
        }

        if (s.raids >= 10) {
            double killsPerRaid = s.raids == 0 ? 0.0 : s.operatorKills / (double) s.raids;
            double exfilRate = s.raids == 0 ? 0.0 : (s.exfils / (double) s.raids) * 100.0;
            bonus += awardAchievement(s, "kpr", killsPerRaid, new double[] {0.5, 1.5, 4, 6});
            bonus += awardAchievement(s, "exfr", exfilRate, new double[] {45, 65, 82, 95});
        }
        return bonus;
    }

    private static int awardAchievement(Standing s, String key, double value, double[] thresholds) {
        int achieved = 0;
        for (double threshold : thresholds) {
            if (value >= threshold) achieved++;
        }

        int previous = s.achievementLevels.containsKey(key)
                ? s.achievementLevels.get(key)
                : 0;
        if (achieved <= previous || previous >= 4) return 0;

        // The site advances at most one star per raid even if one raid crosses
        // multiple thresholds at once.
        s.achievementLevels.put(key, previous + 1);
        return new int[] {25, 50, 100, 200}[previous];
    }

    private static int gross(Raid r, boolean season2Scoring) {
        int earned = 0;
        if (r.hasCarryover) earned += r.carryover;
        earned += r.operatorKills * 15;
        earned += Math.min(r.squadKills, 10) * 3;
        if (r.extracted) {
            earned += 20;
            if (r.weaponCase) earned += 20;
            if (r.fullSquad) earned += 10;
            if (r.finalExfil) earned += 15;
        }
        if ("regular".equals(r.contract)) earned += 10;
        else if ("hunt".equals(r.contract)) earned += 20;
        if (season2Scoring) earned += Math.min(r.bossKills, 2) * 10;
        return earned;
    }

    private static int feeFor(int sr) {
        RankInfo info = rankInfo(sr);
        Tier tier = tierFor(sr);
        return info.apex ? tier.fee : tier.fee + (info.division - 1) * 5;
    }

    private static Tier tierFor(int sr) {
        for (Tier tier : TIERS) {
            if (sr >= tier.min) return tier;
        }
        return TIERS[TIERS.length - 1];
    }

    private static RankInfo rankInfo(int inputSr) {
        int sr = Math.max(0, inputSr);
        int tierIndex = TIERS.length - 1;
        for (int i = 0; i < TIERS.length; i++) {
            if (sr >= TIERS[i].min) {
                tierIndex = i;
                break;
            }
        }

        Tier tier = TIERS[tierIndex];
        if (tierIndex == 0) {
            return new RankInfo(tier.name, true, 0, tier.name, 100, 0);
        }

        int upper = TIERS[tierIndex - 1].min;
        int span = upper - tier.min;
        double divWidth = span / 3.0;
        int d = (int) Math.floor((sr - tier.min) / divWidth);
        d = Math.max(0, Math.min(2, d));
        String roman = new String[] {"I", "II", "III"}[d];
        double floor = tier.min + d * divWidth;
        double next = tier.min + (d + 1) * divWidth;
        int toNext = Math.max(0, (int) Math.ceil(next - sr));
        int pct = (int) Math.round(Math.max(0, Math.min(100,
                ((sr - floor) / Math.max(1.0, next - floor)) * 100.0)));
        return new RankInfo(tier.name, false, d + 1, tier.name + " " + roman, pct, toNext);
    }

    private static RemoteViews buildStatsViews(Context context, int appWidgetId, WidgetStats stats,
                                                boolean staleBecauseNetworkFailed) {
        RemoteViews views = baseViews(context, appWidgetId);
        views.setViewVisibility(R.id.widgetProgress, View.VISIBLE);
        views.setViewVisibility(R.id.widgetStatus, View.GONE);
        views.setTextViewText(R.id.widgetOperator, stats.name);
        views.setTextViewText(R.id.widgetRank, stats.rankLabel);
        views.setTextViewText(R.id.widgetSr, formatNumber(stats.sr) + " SR");
        views.setTextViewText(R.id.widgetPosition,
                "#" + stats.position + " / " + Math.max(stats.totalPlayers, stats.position));
        views.setTextViewText(R.id.widgetDelta, signed(stats.lastDelta) + " last raid");
        views.setTextColor(R.id.widgetDelta,
                stats.lastDelta > 0 ? context.getColor(R.color.dmz_green)
                        : (stats.lastDelta < 0 ? context.getColor(R.color.dmz_red)
                        : context.getColor(R.color.dmz_muted)));
        views.setProgressBar(R.id.widgetProgress, 100, Math.max(0, Math.min(100, stats.progressPct)), false);

        String footer = "DMZRANKED.COM • "
                + (staleBecauseNetworkFailed || stats.fromCache ? "CACHED • " : "")
                + "UPDATED " + DateFormat.getTimeInstance(DateFormat.SHORT).format(new Date(stats.updatedAt));
        views.setTextViewText(R.id.widgetFooter, footer.toUpperCase(Locale.US));
        return views;
    }

    private static RemoteViews buildEmptyViews(Context context, int appWidgetId) {
        RemoteViews views = baseViews(context, appWidgetId);
        views.setTextViewText(R.id.widgetOperator, "SELECT AN OPERATOR");
        views.setTextViewText(R.id.widgetRank, "Open DMZ Ranked → Operators");
        views.setTextViewText(R.id.widgetSr, "— SR");
        views.setTextViewText(R.id.widgetPosition, "#— / —");
        views.setTextViewText(R.id.widgetDelta, "Widget follows your selected website operator");
        views.setTextColor(R.id.widgetDelta, context.getColor(R.color.dmz_muted));
        views.setViewVisibility(R.id.widgetProgress, View.GONE);
        views.setViewVisibility(R.id.widgetStatus, View.VISIBLE);
        views.setTextViewText(R.id.widgetStatus, "NO OPERATOR");
        views.setTextViewText(R.id.widgetFooter, "DMZRANKED.COM • TAP TO OPEN APP");
        return views;
    }

    private static RemoteViews buildErrorViews(Context context, int appWidgetId, String operator,
                                                String message) {
        RemoteViews views = baseViews(context, appWidgetId);
        views.setTextViewText(R.id.widgetOperator, operator);
        views.setTextViewText(R.id.widgetRank, message);
        views.setTextViewText(R.id.widgetSr, "— SR");
        views.setTextViewText(R.id.widgetPosition, "#— / —");
        views.setTextViewText(R.id.widgetDelta, "Tap ↻ to try again");
        views.setTextColor(R.id.widgetDelta, context.getColor(R.color.dmz_muted));
        views.setViewVisibility(R.id.widgetProgress, View.GONE);
        views.setViewVisibility(R.id.widgetStatus, View.VISIBLE);
        views.setTextViewText(R.id.widgetStatus, "OFFLINE");
        views.setTextViewText(R.id.widgetFooter, "DMZRANKED.COM • REFRESH WHEN ONLINE");
        return views;
    }

    private static RemoteViews baseViews(Context context, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_dmz_stats);

        Intent openApp = new Intent(context, MainActivity.class);
        openApp.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openPending = PendingIntent.getActivity(
                context,
                appWidgetId + 100_000,
                openApp,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widgetRoot, openPending);

        Intent refresh = new Intent(context, DmzRankedWidgetProvider.class);
        refresh.setAction(ACTION_REFRESH);
        refresh.putExtra(EXTRA_WIDGET_ID, appWidgetId);
        refresh.setData(Uri.parse("dmzranked://widget/refresh/" + appWidgetId));
        PendingIntent refreshPending = PendingIntent.getBroadcast(
                context,
                appWidgetId,
                refresh,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widgetRefresh, refreshPending);
        return views;
    }

    private static void renderLoading(Context context, AppWidgetManager manager, int[] ids) {
        if (ids == null) return;
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String operator = clean(prefs.getString(PREF_SELECTED_OPERATOR, ""));
        for (int id : ids) {
            RemoteViews views = baseViews(context, id);
            views.setTextViewText(R.id.widgetOperator, operator.isEmpty() ? "DMZ RANKED" : operator);
            views.setTextViewText(R.id.widgetRank, "Refreshing live standings…");
            views.setTextViewText(R.id.widgetSr, "… SR");
            views.setTextViewText(R.id.widgetPosition, "#… / …");
            views.setTextViewText(R.id.widgetDelta, "Reading leaderboard.json");
            views.setTextColor(R.id.widgetDelta, context.getColor(R.color.dmz_muted));
            views.setViewVisibility(R.id.widgetProgress, View.GONE);
            views.setViewVisibility(R.id.widgetStatus, View.VISIBLE);
            views.setTextViewText(R.id.widgetStatus, "SYNCING");
            views.setTextViewText(R.id.widgetFooter, "DMZRANKED.COM • LIVE DATA");
            manager.updateAppWidget(id, views);
        }
    }

    private static void saveCachedStats(Context context, WidgetStats stats) {
        try {
            JSONObject json = new JSONObject();
            json.put("name", stats.name);
            json.put("sr", stats.sr);
            json.put("peak", stats.peak);
            json.put("lastDelta", stats.lastDelta);
            json.put("position", stats.position);
            json.put("totalPlayers", stats.totalPlayers);
            json.put("rankLabel", stats.rankLabel);
            json.put("progressPct", stats.progressPct);
            json.put("srToNext", stats.srToNext);
            json.put("seasonName", stats.seasonName);
            json.put("updatedAt", stats.updatedAt);
            context.getSharedPreferences(CACHE_PREFS, Context.MODE_PRIVATE)
                    .edit()
                    .putString(cacheKey(stats.name), json.toString())
                    .apply();
        } catch (Throwable ignored) {
        }
    }

    private static WidgetStats readCachedStats(Context context, String operator) {
        try {
            String raw = context.getSharedPreferences(CACHE_PREFS, Context.MODE_PRIVATE)
                    .getString(cacheKey(operator), "");
            if (raw == null || raw.isEmpty()) return null;
            JSONObject json = new JSONObject(raw);
            WidgetStats stats = new WidgetStats();
            stats.name = json.optString("name", operator);
            stats.sr = json.optInt("sr", 0);
            stats.peak = json.optInt("peak", stats.sr);
            stats.lastDelta = json.optInt("lastDelta", 0);
            stats.position = json.optInt("position", 0);
            stats.totalPlayers = json.optInt("totalPlayers", 0);
            stats.rankLabel = json.optString("rankLabel", "BRONZE I");
            stats.progressPct = json.optInt("progressPct", 0);
            stats.srToNext = json.optInt("srToNext", 0);
            stats.seasonName = json.optString("seasonName", "");
            stats.updatedAt = json.optLong("updatedAt", System.currentTimeMillis());
            stats.fromCache = true;
            return stats;
        } catch (Throwable ignored) {
            return null;
        }
    }

    private static String cacheKey(String operator) {
        return "operator_" + clean(operator).toLowerCase(Locale.US);
    }

    private static long optLongOr(JSONObject object, String key, long fallback) {
        if (object == null || !object.has(key) || object.isNull(key)) return fallback;
        try {
            return object.getLong(key);
        } catch (Throwable ignored) {
            return fallback;
        }
    }

    private static String clean(String value) {
        return value == null ? "" : value.replaceAll("\\s+", " ").trim();
    }

    private static String formatNumber(int value) {
        return String.format(Locale.US, "%,d", value);
    }

    private static String signed(int value) {
        if (value > 0) return "+" + value + " SR";
        return value + " SR";
    }

    private static final class Tier {
        final String name;
        final int min;
        final int fee;

        Tier(String name, int min, int fee) {
            this.name = name;
            this.min = min;
            this.fee = fee;
        }
    }

    private static final class RankInfo {
        final String tier;
        final boolean apex;
        final int division;
        final String label;
        final int progressPct;
        final int toNext;

        RankInfo(String tier, boolean apex, int division, String label, int progressPct, int toNext) {
            this.tier = tier;
            this.apex = apex;
            this.division = division;
            this.label = label;
            this.progressPct = progressPct;
            this.toNext = toNext;
        }
    }

    private static final class Standing {
        final String id;
        final String name;
        final Map<String, Integer> achievementLevels = new HashMap<>();
        int sr;
        int peak;
        int last;
        int raids;
        int operatorKills;
        int squadKills;
        int exfils;
        int weaponCases;
        int finalExfils;
        int contracts;
        int bossKills;

        Standing(String id, String name) {
            this.id = id;
            this.name = name;
        }
    }

    private static final class Raid {
        long ts;
        String playerId;
        String playerName;
        int operatorKills;
        int squadKills;
        int bossKills;
        boolean extracted;
        boolean finalExfil;
        boolean fullSquad;
        boolean weaponCase;
        String contract;
        boolean hasCarryover;
        int carryover;

        static Raid from(JSONObject obj) {
            Raid raid = new Raid();
            raid.ts = obj.optLong("ts", 0L);
            raid.playerId = clean(obj.optString("playerId", ""));
            raid.playerName = clean(obj.optString("playerName", ""));
            raid.operatorKills = obj.optInt("operatorKills", 0);
            raid.squadKills = obj.optInt("squadKills", 0);
            raid.bossKills = obj.optInt("bossKills", 0);
            raid.extracted = obj.optBoolean("extracted", false);
            raid.finalExfil = obj.optBoolean("finalExfil", false);
            raid.fullSquad = obj.optBoolean("fullSquad", false);
            raid.weaponCase = obj.optBoolean("weaponCase", false);
            raid.contract = clean(obj.optString("contract", "none")).toLowerCase(Locale.US);
            raid.hasCarryover = obj.has("carryover") && !obj.isNull("carryover");
            raid.carryover = raid.hasCarryover ? obj.optInt("carryover", 0) : 0;
            return raid;
        }
    }

    private static final class WidgetStats {
        String name;
        int sr;
        int peak;
        int lastDelta;
        int position;
        int totalPlayers;
        String rankLabel;
        int progressPct;
        int srToNext;
        String seasonName;
        long updatedAt;
        boolean fromCache;
    }
}
