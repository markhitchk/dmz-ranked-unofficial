package com.harleytg.dmzranked;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;

import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * Keeps report/review notifications near-real-time without Firebase by polling
 * the same DMZ Ranked public-state endpoint while a user-visible foreground
 * notification is active.
 */
public class LiveNotificationService extends Service {
    private static final String CHANNEL_ID = "dmz_live_alert_service";
    private static final int FOREGROUND_NOTIFICATION_ID = 5101;
    private static final long INITIAL_DELAY_SECONDS = 1L;
    private static final long POLL_SECONDS = 5L;

    private ScheduledExecutorService scheduler;

    @Override
    public void onCreate() {
        super.onCreate();
        ensureChannel();
        startAsForeground();
        startPolling();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (scheduler == null || scheduler.isShutdown()) {
            startPolling();
        }
        return START_STICKY;
    }

    private void startAsForeground() {
        Intent launch = new Intent(this, MainActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent contentIntent = PendingIntent.getActivity(
                this,
                5101,
                launch,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(this, CHANNEL_ID)
                : new Notification.Builder(this);

        Notification notification = builder
                .setSmallIcon(R.drawable.ic_notification_dmz)
                .setContentTitle("DMZ Ranked")
                .setContentText("[System] Live monitoring active")
                .setStyle(new Notification.BigTextStyle().bigText(
                        "[System] Live monitoring active\nWatching reports, review holds, and raid approvals every few seconds."))
                .setContentIntent(contentIntent)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setCategory(Notification.CATEGORY_SERVICE)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setPriority(Notification.PRIORITY_LOW)
                .build();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                    FOREGROUND_NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
        } else {
            startForeground(FOREGROUND_NOTIFICATION_ID, notification);
        }
    }

    private void startPolling() {
        if (scheduler != null && !scheduler.isShutdown()) return;

        scheduler = Executors.newSingleThreadScheduledExecutor();
        scheduler.scheduleWithFixedDelay(() -> {
            SharedPreferences prefs =
                    getSharedPreferences(NotificationSync.PREFS, Context.MODE_PRIVATE);

            if (!prefs.getBoolean(NotificationSync.PREF_SITE_NOTIFICATIONS, true)) {
                stopSelf();
                return;
            }

            prefs.edit()
                    .putLong(
                            NotificationSync.PREF_LIVE_SERVICE_HEARTBEAT_MS,
                            System.currentTimeMillis())
                    .apply();

            try {
                NotificationSyncWorker.syncNow(getApplicationContext(), false);
            } catch (Throwable ignored) {
                // Keep the service alive. The next scheduled pass will retry.
            }
        }, INITIAL_DELAY_SECONDS, POLL_SECONDS, TimeUnit.SECONDS);
    }

    private void ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationManager manager =
                (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null || manager.getNotificationChannel(CHANNEL_ID) != null) return;

        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "DMZ Ranked live monitoring",
                NotificationManager.IMPORTANCE_LOW);
        channel.setDescription(
                "Required while Firebase-free real-time DMZ Ranked alert monitoring is active.");
        channel.setShowBadge(false);
        channel.enableVibration(false);
        channel.enableLights(false);
        manager.createNotificationChannel(channel);
    }

    @Override
    public void onDestroy() {
        if (scheduler != null) {
            scheduler.shutdownNow();
            scheduler = null;
        }

        getSharedPreferences(NotificationSync.PREFS, Context.MODE_PRIVATE)
                .edit()
                .putLong(NotificationSync.PREF_LIVE_SERVICE_HEARTBEAT_MS, 0L)
                .apply();

        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
