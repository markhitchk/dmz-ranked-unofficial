package com.harleytg.dmzranked;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;

import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.OutOfQuotaPolicy;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import java.util.Locale;
import java.util.concurrent.TimeUnit;

final class NotificationSync {
    static final String PREFS = "dmz_ranked_settings";
    static final String PREF_SITE_NOTIFICATIONS = "site_notifications";
    static final String PREF_SELECTED_OPERATOR = "website_selected_operator";
    static final String PREF_APP_FOREGROUND = "notification_app_foreground";

    static final String PREF_BASELINE_READY = "notification_sync_baseline_ready";
    static final String PREF_BASELINE_OPERATOR_KEY = "notification_sync_operator_key";
    static final String PREF_BASELINE_PLAYER_REPORTS = "notification_sync_player_reports";
    static final String PREF_BASELINE_RAIDS = "notification_sync_raids";
    static final String PREF_BASELINE_SEASON = "notification_sync_season";

    static final String PREF_HANDLED_RAID_REPORT_MS = "notification_handled_raid_report_ms";
    static final String PREF_HANDLED_OPERATOR_REPORT_MS = "notification_handled_operator_report_ms";
    static final String PREF_HANDLED_REVIEW_MS = "notification_handled_review_ms";
    static final String PREF_HANDLED_VERIFIED_MS = "notification_handled_verified_ms";
    static final String PREF_HANDLED_SEASON_MS = "notification_handled_season_ms";

    static final String CHANNEL_ID = "dmz_site_alerts_v2";
    private static final String PERIODIC_WORK = "dmz-ranked-background-notification-sync";
    private static final String PRIME_WORK = "dmz-ranked-notification-prime";
    private static final String BACKGROUND_KICK_WORK = "dmz-ranked-notification-background-kick";
    private static final long RECENT_FOREGROUND_EVENT_MS = TimeUnit.MINUTES.toMillis(30);

    private NotificationSync() {}

    static void configure(Context context) {
        Context app = context.getApplicationContext();
        SharedPreferences prefs = app.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        WorkManager workManager = WorkManager.getInstance(app);

        if (!prefs.getBoolean(PREF_SITE_NOTIFICATIONS, true)) {
            workManager.cancelUniqueWork(PERIODIC_WORK);
            workManager.cancelUniqueWork(PRIME_WORK);
            workManager.cancelUniqueWork(BACKGROUND_KICK_WORK);
            return;
        }

        Constraints constraints = new Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build();

        PeriodicWorkRequest periodic = new PeriodicWorkRequest.Builder(
                NotificationSyncWorker.class, 15, TimeUnit.MINUTES)
                .setConstraints(constraints)
                .build();

        workManager.enqueueUniquePeriodicWork(
                PERIODIC_WORK, ExistingPeriodicWorkPolicy.UPDATE, periodic);
    }

    static void primeBaseline(Context context) {
        Context app = context.getApplicationContext();
        SharedPreferences prefs = app.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        if (!prefs.getBoolean(PREF_SITE_NOTIFICATIONS, true)
                || prefs.getBoolean(PREF_BASELINE_READY, false)) {
            return;
        }

        Constraints constraints = new Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build();

        OneTimeWorkRequest request = new OneTimeWorkRequest.Builder(NotificationSyncWorker.class)
                .setConstraints(constraints)
                .setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
                .build();

        WorkManager.getInstance(app).enqueueUniqueWork(
                PRIME_WORK, ExistingWorkPolicy.KEEP, request);
    }

    static void scheduleBackgroundKick(Context context) {
        Context app = context.getApplicationContext();
        SharedPreferences prefs = app.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        if (!prefs.getBoolean(PREF_SITE_NOTIFICATIONS, true)) return;

        Constraints constraints = new Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build();

        OneTimeWorkRequest request = new OneTimeWorkRequest.Builder(NotificationSyncWorker.class)
                .setConstraints(constraints)
                .setInitialDelay(1, TimeUnit.MINUTES)
                .build();

        WorkManager.getInstance(app).enqueueUniqueWork(
                BACKGROUND_KICK_WORK, ExistingWorkPolicy.REPLACE, request);
    }

    static void setAppForeground(Context context, boolean foreground) {
        context.getApplicationContext()
                .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putBoolean(PREF_APP_FOREGROUND, foreground)
                .apply();
    }

    static void recordForegroundNotification(Context context, String title, String body) {
        String text = ((title == null ? "" : title) + " " + (body == null ? "" : body))
                .toLowerCase(Locale.US);
        long now = System.currentTimeMillis();
        SharedPreferences.Editor edit = context.getApplicationContext()
                .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit();

        if ((text.contains("one of your raids") || text.contains("your raid"))
                && text.contains("report")) {
            edit.putLong(PREF_HANDLED_RAID_REPORT_MS, now);
        }
        if (text.contains("operator") && text.contains("report")
                && (text.contains("your operator") || text.contains("profile"))) {
            edit.putLong(PREF_HANDLED_OPERATOR_REPORT_MS, now);
        }
        if (text.contains("under review") || text.contains("review hold")) {
            edit.putLong(PREF_HANDLED_REVIEW_MS, now);
        }
        if (text.contains("approved") || text.contains("verified")) {
            edit.putLong(PREF_HANDLED_VERIFIED_MS, now);
        }
        if (text.contains("season update") || text.contains("new season")) {
            edit.putLong(PREF_HANDLED_SEASON_MS, now);
        }
        edit.apply();
    }

    static boolean recentlyHandled(SharedPreferences prefs, String key) {
        long handled = prefs.getLong(key, 0L);
        return handled > 0L && System.currentTimeMillis() - handled < RECENT_FOREGROUND_EVENT_MS;
    }

    static void postNotification(Context context, String title, String body, String eventKey) {
        Context app = context.getApplicationContext();
        SharedPreferences prefs = app.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        if (!prefs.getBoolean(PREF_SITE_NOTIFICATIONS, true)) return;
        if (Build.VERSION.SDK_INT >= 33
                && app.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
            return;
        }

        NotificationManager manager =
                (NotificationManager) app.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;

        ensureChannel(manager);

        Intent launch = new Intent(app, MainActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent contentIntent = PendingIntent.getActivity(
                app,
                4200 + Math.abs(eventKey.hashCode() % 700),
                launch,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(app, CHANNEL_ID)
                : new Notification.Builder(app);

        builder.setSmallIcon(R.drawable.ic_notification_dmz)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new Notification.BigTextStyle().bigText(body))
                .setContentIntent(contentIntent)
                .setAutoCancel(true)
                .setOnlyAlertOnce(false)
                .setColor(app.getColor(R.color.dmz_gold))
                .setCategory(Notification.CATEGORY_EVENT)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setPriority(Notification.PRIORITY_HIGH)
                .setDefaults(Notification.DEFAULT_ALL);

        try {
            Bitmap logo = BitmapFactory.decodeResource(app.getResources(), R.drawable.dmz_ranked_logo);
            if (logo != null) builder.setLargeIcon(logo);
        } catch (Throwable ignored) {}

        manager.notify(22000 + Math.abs(eventKey.hashCode() % 9000), builder.build());
    }

    private static void ensureChannel(NotificationManager manager) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O
                || manager.getNotificationChannel(CHANNEL_ID) != null) {
            return;
        }

        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "DMZ Ranked alerts", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("Raid reports, review status, season updates, and website alerts from DMZ Ranked.");
        channel.enableVibration(true);
        channel.enableLights(true);
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        manager.createNotificationChannel(channel);
    }
}
