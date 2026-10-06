package com.harleytg.dmzranked;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.util.Base64;
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
 * dmzranked.com public-state API (with leaderboard.json fallback) and performs the same
 * SR/rank calculation client-side, keeping the widget native and RemoteViews-compatible.
 */
public class DmzRankedWidgetProvider extends AppWidgetProvider {
    public static final String ACTION_REFRESH = "com.harleytg.dmzranked.action.WIDGET_REFRESH";
    private static final String EXTRA_WIDGET_ID = "dmz_widget_id";

    private static final String PREFS = "dmz_ranked_settings";
    private static final String PREF_SELECTED_OPERATOR = "website_selected_operator";
    private static final String PREF_WIDGET_SIZE_MODE = "widget_size_mode";
    private static final String PREF_WIDGET_SHOW_BADGE = "widget_show_badge";
    private static final String PREF_WIDGET_SHOW_STATUS = "widget_show_status";
    private static final String PREF_WIDGET_SHOW_PROGRESS = "widget_show_progress";
    private static final String PREF_WIDGET_SHOW_SEASON = "widget_show_season";
    private static final String PREF_WIDGET_SHOW_BRANDING = "widget_show_branding";
    private static final String PREF_WIDGET_SHOW_REFRESH = "widget_show_refresh";
    private static final String CACHE_PREFS = "dmz_ranked_widget_cache";
    private static final String BADGE_CACHE_PREFS = "dmz_ranked_widget_badges";
    private static final String PUBLIC_STATE_URL = "https://dmzranked.com/api/v1/data/public-state";
    private static final String SNAPSHOT_DATA_URL = "https://dmzranked.com/leaderboard.json";
    private static final String BADGE_SOURCE_URL = "https://dmz-ticker.netlify.app/";

    private static final int CONNECT_TIMEOUT_MS = 8_000;
    private static final int READ_TIMEOUT_MS = 12_000;
    private static final int MAX_JSON_CHARS = 12_000_000;
    private static final int MAX_BADGE_PAGE_CHARS = 8_000_000;

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
    public void onAppWidgetOptionsChanged(
            Context context,
            AppWidgetManager appWidgetManager,
            int appWidgetId,
            Bundle newOptions) {
        super.onAppWidgetOptionsChanged(context, appWidgetManager, appWidgetId, newOptions);
        int[] ids = new int[] {appWidgetId};
        renderLoading(context, appWidgetManager, ids);
        refreshAsync(context, appWidgetManager, ids);
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
            JSONObject root = fetchWidgetState();
            stats = resolveStats(root, operator);
            if (stats != null) saveCachedStats(context, stats);
        } catch (Throwable t) {
            error = t;
        }

        if (stats == null) {
            stats = readCachedStats(context, operator);
        }

        String badgeData = stats == null
                ? ""
                : loadRankBadgeData(context, stats.rankLabel, stats.position);

        for (int id : ids) {
            RemoteViews views;
            if (stats != null) {
                views = buildStatsViews(context, id, stats, error != null, badgeData);
            } else {
                views = buildErrorViews(context, id, operator,
                        error == null ? "Operator not found on DMZ Ranked." : "Could not reach DMZ Ranked.");
            }
            manager.updateAppWidget(id, views);
        }
    }

    private static JSONObject fetchWidgetState() throws Exception {
        Exception primaryError = null;
        try {
            JSONObject publicState = fetchJson(PUBLIC_STATE_URL);
            JSONArray players = publicState.optJSONArray("players");
            JSONArray raids = publicState.optJSONArray("raids");
            JSONObject meta = publicState.optJSONObject("meta");
            JSONObject season = meta == null ? null : meta.optJSONObject("season");
            if (players != null && raids != null && season != null) {
                JSONObject data = new JSONObject();
                data.put("players", players);
                data.put("raids", raids);
                data.put("season", season);

                JSONObject wrapped = new JSONObject();
                wrapped.put("data", data);
                return wrapped;
            }
            primaryError = new IllegalStateException("DMZ Ranked public-state payload was incomplete");
        } catch (Exception error) {
            primaryError = error;
        }

        try {
            return fetchJson(SNAPSHOT_DATA_URL);
        } catch (Exception fallbackError) {
            if (primaryError != null) fallbackError.addSuppressed(primaryError);
            throw fallbackError;
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
                    "DMZRankedAndroidWidget/1.0.53 (HarleysStudios; com.harleytg.dmzranked)");

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

    private static RemoteViews buildStatsViews(
            Context context,
            int appWidgetId,
            WidgetStats stats,
            boolean staleBecauseNetworkFailed,
            String badgeData) {
        int displayMode = widgetDisplayMode(context, appWidgetId);
        RemoteViews views = baseViews(context, appWidgetId);
        views.setViewVisibility(R.id.widgetProgress, View.VISIBLE);
        views.setViewVisibility(R.id.widgetStatus, View.VISIBLE);
        views.setTextViewText(R.id.widgetStatus,
                staleBecauseNetworkFailed || stats.fromCache ? "CACHED" : "LIVE");
        views.setTextViewText(R.id.widgetOperator, stats.name);
        views.setTextViewText(R.id.widgetRank, stats.rankLabel);
        views.setTextColor(R.id.widgetRank, tierColor(stats.rankLabel));
        views.setTextViewText(R.id.widgetSr, formatNumber(stats.sr) + " SR");
        views.setTextViewText(R.id.widgetPosition,
                "#" + stats.position + " / " + Math.max(stats.totalPlayers, stats.position));
        views.setTextViewText(R.id.widgetDelta, signed(stats.lastDelta));
        views.setTextColor(R.id.widgetDelta,
                stats.lastDelta > 0 ? context.getColor(R.color.dmz_green)
                        : (stats.lastDelta < 0 ? context.getColor(R.color.dmz_red)
                        : context.getColor(R.color.dmz_muted)));
        views.setProgressBar(
                R.id.widgetProgress,
                100,
                Math.max(0, Math.min(100, stats.progressPct)),
                false);

        Bitmap badge = decodeBadge(context, badgeData, displayMode);
        if (badge != null) {
            views.setImageViewBitmap(R.id.widgetRankBadge, badge);
        } else {
            views.setImageViewResource(R.id.widgetRankBadge, R.drawable.dmz_ranked_logo);
        }

        String updated = DateFormat.getTimeInstance(DateFormat.SHORT)
                .format(new Date(stats.updatedAt))
                .toUpperCase(Locale.US);
        String footer = (staleBecauseNetworkFailed || stats.fromCache ? "CACHED • " : "")
                + "UPDATED " + updated;
        views.setTextViewText(R.id.widgetFooter, footer);

        String season = clean(stats.seasonName);
        views.setTextViewText(
                R.id.widgetSeason,
                season.isEmpty() ? "DMZRANKED.COM" : season.toUpperCase(Locale.US));
        applyWidgetDisplayPreferences(context, views, true);
        return views;
    }

    private static RemoteViews buildEmptyViews(Context context, int appWidgetId) {
        RemoteViews views = baseViews(context, appWidgetId);
        views.setImageViewResource(R.id.widgetRankBadge, R.drawable.dmz_ranked_logo);
        views.setTextViewText(R.id.widgetOperator, "SELECT AN OPERATOR");
        views.setTextViewText(R.id.widgetRank, "Open DMZ Ranked → Operators");
        views.setTextColor(R.id.widgetRank, context.getColor(R.color.dmz_gold));
        views.setTextViewText(R.id.widgetSr, "— SR");
        views.setTextViewText(R.id.widgetPosition, "#— / —");
        views.setTextViewText(R.id.widgetDelta, "NO DATA");
        views.setTextColor(R.id.widgetDelta, context.getColor(R.color.dmz_muted));
        views.setViewVisibility(R.id.widgetProgress, View.GONE);
        views.setViewVisibility(R.id.widgetStatus, View.VISIBLE);
        views.setTextViewText(R.id.widgetStatus, "NO OPERATOR");
        views.setTextViewText(R.id.widgetFooter, "TAP TO OPEN APP");
        views.setTextViewText(R.id.widgetSeason, "DMZRANKED.COM");
        applyWidgetDisplayPreferences(context, views, false);
        return views;
    }

    private static RemoteViews buildErrorViews(
            Context context,
            int appWidgetId,
            String operator,
            String message) {
        RemoteViews views = baseViews(context, appWidgetId);
        views.setImageViewResource(R.id.widgetRankBadge, R.drawable.dmz_ranked_logo);
        views.setTextViewText(R.id.widgetOperator, operator);
        views.setTextViewText(R.id.widgetRank, message);
        views.setTextColor(R.id.widgetRank, context.getColor(R.color.dmz_gold));
        views.setTextViewText(R.id.widgetSr, "— SR");
        views.setTextViewText(R.id.widgetPosition, "#— / —");
        views.setTextViewText(R.id.widgetDelta, "TAP ↻");
        views.setTextColor(R.id.widgetDelta, context.getColor(R.color.dmz_muted));
        views.setViewVisibility(R.id.widgetProgress, View.GONE);
        views.setViewVisibility(R.id.widgetStatus, View.VISIBLE);
        views.setTextViewText(R.id.widgetStatus, "OFFLINE");
        views.setTextViewText(R.id.widgetFooter, "REFRESH WHEN ONLINE");
        views.setTextViewText(R.id.widgetSeason, "DMZRANKED.COM");
        applyWidgetDisplayPreferences(context, views, false);
        return views;
    }

    private static RemoteViews baseViews(Context context, int appWidgetId) {
        int displayMode = widgetDisplayMode(context, appWidgetId);
        int layout = displayMode == 0
                ? R.layout.widget_dmz_stats_compact
                : (displayMode == 2
                    ? R.layout.widget_dmz_stats_large
                    : R.layout.widget_dmz_stats);
        RemoteViews views = new RemoteViews(context.getPackageName(), layout);

        views.setTextViewText(R.id.widgetAppTitle, "DMZ RANKED");
        views.setTextViewText(R.id.widgetBrandSubtitle, "MADE BY HARLEY'S STUDIOS");
        views.setViewVisibility(
                R.id.widgetBetaTag,
                context.getPackageName().endsWith(".beta") ? View.VISIBLE : View.GONE);

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

    private static int widgetDisplayMode(Context context, int appWidgetId) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String requested = prefs.getString(PREF_WIDGET_SIZE_MODE, "auto");
        requested = requested == null ? "auto" : requested.trim().toLowerCase(Locale.US);

        if ("compact".equals(requested)) return 0;
        if ("standard".equals(requested)) return 1;
        if ("large".equals(requested)) return 2;

        try {
            Bundle options = AppWidgetManager.getInstance(context).getAppWidgetOptions(appWidgetId);
            int minWidth = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 250);
            int minHeight = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 130);

            if (minWidth < 245 || minHeight < 125) return 0;
            if (minWidth >= 330 && minHeight >= 165) return 2;
        } catch (Throwable ignored) {
        }
        return 1;
    }

    private static boolean isCompactWidget(Context context, int appWidgetId) {
        return widgetDisplayMode(context, appWidgetId) == 0;
    }

    private static void applyWidgetDisplayPreferences(
            Context context,
            RemoteViews views,
            boolean progressAvailable) {
        if (views == null) return;

        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        boolean showBadge = prefs.getBoolean(PREF_WIDGET_SHOW_BADGE, true);
        boolean showStatus = prefs.getBoolean(PREF_WIDGET_SHOW_STATUS, true);
        boolean showProgress = prefs.getBoolean(PREF_WIDGET_SHOW_PROGRESS, true);
        boolean showSeason = prefs.getBoolean(PREF_WIDGET_SHOW_SEASON, true);
        boolean showBranding = prefs.getBoolean(PREF_WIDGET_SHOW_BRANDING, true);
        boolean showRefresh = prefs.getBoolean(PREF_WIDGET_SHOW_REFRESH, true);

        views.setViewVisibility(R.id.widgetRankBadge, showBadge ? View.VISIBLE : View.GONE);
        views.setViewVisibility(R.id.widgetStatus, showStatus ? View.VISIBLE : View.GONE);
        views.setViewVisibility(
                R.id.widgetProgress,
                showProgress && progressAvailable ? View.VISIBLE : View.GONE);
        views.setViewVisibility(R.id.widgetSeason, showSeason ? View.VISIBLE : View.GONE);
        views.setViewVisibility(
                R.id.widgetBrandSubtitle,
                showBranding ? View.VISIBLE : View.GONE);
        views.setViewVisibility(R.id.widgetRefresh, showRefresh ? View.VISIBLE : View.GONE);
    }

    private static void renderLoading(Context context, AppWidgetManager manager, int[] ids) {
        if (ids == null) return;
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String operator = clean(prefs.getString(PREF_SELECTED_OPERATOR, ""));
        for (int id : ids) {
            RemoteViews views = baseViews(context, id);
            views.setImageViewResource(R.id.widgetRankBadge, R.drawable.dmz_ranked_logo);
            views.setTextViewText(R.id.widgetOperator, operator.isEmpty() ? "DMZ RANKED" : operator);
            views.setTextViewText(R.id.widgetRank, "Refreshing live standings…");
            views.setTextColor(R.id.widgetRank, context.getColor(R.color.dmz_gold));
            views.setTextViewText(R.id.widgetSr, "… SR");
            views.setTextViewText(R.id.widgetPosition, "#… / …");
            views.setTextViewText(R.id.widgetDelta, "SYNC");
            views.setTextColor(R.id.widgetDelta, context.getColor(R.color.dmz_muted));
            views.setViewVisibility(R.id.widgetProgress, View.GONE);
            views.setViewVisibility(R.id.widgetStatus, View.VISIBLE);
            views.setTextViewText(R.id.widgetStatus, "SYNCING");
            views.setTextViewText(R.id.widgetFooter, "READING LIVE DATA");
            views.setTextViewText(R.id.widgetSeason, "DMZRANKED.COM");
            applyWidgetDisplayPreferences(context, views, false);
            manager.updateAppWidget(id, views);
        }
    }

    private static String loadRankBadgeData(Context context, String rankLabel, int standing) {
        String key = badgeKey(rankLabel, standing);
        if (key.isEmpty()) return "";

        SharedPreferences cache = context.getSharedPreferences(BADGE_CACHE_PREFS, Context.MODE_PRIVATE);
        String cached = cache.getString(key, "");
        if (isBadgeData(cached)) return cached;

        try {
            String html = fetchText(BADGE_SOURCE_URL, MAX_BADGE_PAGE_CHARS);
            int marker = html.indexOf("const BADGE");
            int objectStart = marker < 0 ? -1 : html.indexOf('{', marker);
            int objectEnd = objectStart < 0 ? -1 : html.indexOf("};", objectStart);
            if (objectStart < 0 || objectEnd <= objectStart) return "";

            JSONObject badges = new JSONObject(html.substring(objectStart, objectEnd + 1));
            String badge = badges.optString(key, "");
            if (!isBadgeData(badge)) return "";

            cache.edit().putString(key, badge).apply();
            return badge;
        } catch (Throwable ignored) {
            return "";
        }
    }

    private static String fetchText(String urlString, int maxChars) throws Exception {
        HttpURLConnection connection = null;
        InputStream input = null;
        BufferedReader reader = null;
        try {
            connection = (HttpURLConnection) new URL(urlString).openConnection();
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(CONNECT_TIMEOUT_MS);
            connection.setReadTimeout(READ_TIMEOUT_MS);
            connection.setUseCaches(true);
            connection.setRequestProperty("Accept", "text/html,*/*");
            connection.setRequestProperty("User-Agent",
                    "DMZRankedAndroidWidget/1.0.53 (HarleysStudios; rank-badges)");

            int code = connection.getResponseCode();
            if (code < 200 || code >= 300) {
                throw new IllegalStateException("Badge source returned HTTP " + code);
            }

            input = connection.getInputStream();
            reader = new BufferedReader(new InputStreamReader(input, StandardCharsets.UTF_8));
            StringBuilder body = new StringBuilder(512 * 1024);
            char[] buffer = new char[8192];
            int read;
            while ((read = reader.read(buffer)) >= 0) {
                body.append(buffer, 0, read);
                if (body.length() > maxChars) {
                    throw new IllegalStateException("Badge source was unexpectedly large");
                }
            }
            return body.toString();
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

    private static boolean isBadgeData(String value) {
        return value != null
                && value.startsWith("data:image/")
                && value.contains(";base64,")
                && value.length() > 200;
    }

    private static String badgeKey(String rankLabel, int standing) {
        String label = clean(rankLabel).toUpperCase(Locale.US);
        if (label.startsWith("IRIDESCENT")) {
            return standing >= 1 && standing <= 3 ? "Top" : "Iridescent";
        }

        String[] parts = label.split("\\s+");
        if (parts.length < 2) return "";
        String tier = parts[0].substring(0, 1)
                + parts[0].substring(1).toLowerCase(Locale.US);
        String division;
        if ("I".equals(parts[1])) division = "1";
        else if ("II".equals(parts[1])) division = "2";
        else if ("III".equals(parts[1])) division = "3";
        else return "";
        return tier + division;
    }

    private static Bitmap decodeBadge(Context context, String data, int displayMode) {
        if (!isBadgeData(data)) return null;
        try {
            int comma = data.indexOf(',');
            byte[] bytes = Base64.decode(data.substring(comma + 1), Base64.DEFAULT);
            Bitmap raw = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
            if (raw == null) return null;

            int width = dp(context, displayMode == 0 ? 42 : (displayMode == 2 ? 76 : 58));
            int height = dp(context, displayMode == 0 ? 46 : (displayMode == 2 ? 84 : 64));
            Bitmap scaled = Bitmap.createScaledBitmap(raw, width, height, true);
            if (scaled != raw) raw.recycle();
            return scaled;
        } catch (Throwable ignored) {
            return null;
        }
    }

    private static int dp(Context context, int value) {
        return Math.max(1, Math.round(value * context.getResources().getDisplayMetrics().density));
    }

    private static int tierColor(String rankLabel) {
        String label = clean(rankLabel).toUpperCase(Locale.US);
        if (label.startsWith("IRIDESCENT")) return Color.parseColor("#C9B3FF");
        if (label.startsWith("CRIMSON")) return Color.parseColor("#E5484D");
        if (label.startsWith("DIAMOND")) return Color.parseColor("#8FD6FF");
        if (label.startsWith("PLATINUM")) return Color.parseColor("#DFE7EE");
        if (label.startsWith("GOLD")) return Color.parseColor("#F5C451");
        if (label.startsWith("SILVER")) return Color.parseColor("#C3CCD4");
        if (label.startsWith("BRONZE")) return Color.parseColor("#C48A5A");
        return Color.parseColor("#F6C453");
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
