package com.harleytg.dmzranked;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.text.Editable;
import android.text.TextWatcher;
import android.util.Log;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.WebStorage;
import android.webkit.WebView;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.Switch;
import android.widget.TextView;
import android.widget.Toast;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Locale;

public class SettingsActivity extends Activity {
    private static final String TAG = "DMZRankedSettings";
    private static final String PAYPAL_SHARE_URL = "https://share.google/9nj1GcaYNu3qJTTeu";
    private static final String APP_SUPPORT_DISCORD_URL = "https://discord.gg/kdHneTZkyd";
    private static final String MAIN_DISCORD_URL = "https://discord.gg/jTaTHqw45F";
    private static final String BETA_GROUP_URL = "https://groups.google.com/g/dmz-ranked";
    private static final String PLAY_STORE_HTTPS = "https://play.google.com/store/apps/details?id=com.harleytg.dmzranked";
    private static final String PLAY_STORE_MARKET = "market://details?id=com.harleytg.dmzranked";
    private static final String YOLANDO_AVATAR_URL = "https://cdn.discordapp.com/avatars/645842556898377728/b2c3a2a0001bc2d946ae52aeaa9abe1c.webp?size=3072";
    private static final String DCHINZ_AVATAR_URL = "https://cdn.discordapp.com/avatars/364411414787653642/71fc7b2b2cae4b81c38ad148aed61df3.webp?size=3072";

    private static final String PREFS = "dmz_ranked_settings";
    private static final String PREF_DESKTOP = "desktop_site";
    private static final String PREF_KEEP_AWAKE = "keep_awake";
    private static final String PREF_VERBOSE_LOADING = "verbose_loading";
    private static final String PREF_SITE_NOTIFICATIONS = "site_notifications";
    private static final String PREF_PULL_REFRESH = "pull_to_refresh";
    private static final String PREF_REMEMBER_LAST_PAGE = "remember_last_page";
    private static final String PREF_WEBVIEW_DEBUG = "webview_debug";
    private static final String PREF_LAST_PAGE_URL = "last_page_url";

    private static final String SITE_NOTIFICATION_CHANNEL = "dmz_site_notifications";
    private static final int NOTIFICATION_PERMISSION_REQUEST = 2004;

    public static final String EXTRA_ACTION = "settings_action";
    public static final String ACTION_RELOAD = "reload";

    private SharedPreferences preferences;
    private boolean pendingTestNotification;
    private boolean creditsExpanded;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        preferences = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        setContentView(R.layout.activity_settings);
        configureSystemBars();

        applyBrandLogo(findViewById(R.id.settingsLogo));
        applyBrandLogo(findViewById(R.id.aboutLogo));

        PackageInfo packageInfo = getPackageInfoSafe();
        String versionName = packageInfo == null || packageInfo.versionName == null
                ? "Unknown"
                : packageInfo.versionName;
        long versionCode = packageInfo == null
                ? -1
                : (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                    ? packageInfo.getLongVersionCode()
                    : packageInfo.versionCode);

        TextView versionText = findViewById(R.id.versionText);
        TextView buildText = findViewById(R.id.buildText);
        TextView updateVersionText = findViewById(R.id.updateVersionText);
        versionText.setText("Version " + versionName);
        buildText.setText(versionCode >= 0 ? "Build " + versionCode : "Build unknown");
        updateVersionText.setText("Installed: " + versionName
                + (versionCode >= 0 ? " (" + versionCode + ")" : "")
                + " • Open Google Play to check for an update.");

        Switch desktopSite = findViewById(R.id.desktopSiteSwitch);
        Switch keepAwake = findViewById(R.id.keepAwakeSwitch);
        Switch pullRefresh = findViewById(R.id.pullRefreshSwitch);
        Switch rememberLastPage = findViewById(R.id.rememberLastPageSwitch);
        Switch verboseLoading = findViewById(R.id.verboseLoadingSwitch);
        Switch siteNotifications = findViewById(R.id.siteNotificationsSwitch);
        Switch webviewDebug = findViewById(R.id.webviewDebugSwitch);

        desktopSite.setChecked(preferences.getBoolean(PREF_DESKTOP, false));
        keepAwake.setChecked(preferences.getBoolean(PREF_KEEP_AWAKE, false));
        pullRefresh.setChecked(preferences.getBoolean(PREF_PULL_REFRESH, true));
        rememberLastPage.setChecked(preferences.getBoolean(PREF_REMEMBER_LAST_PAGE, true));
        verboseLoading.setChecked(preferences.getBoolean(PREF_VERBOSE_LOADING, false));
        siteNotifications.setChecked(preferences.getBoolean(PREF_SITE_NOTIFICATIONS, true));
        webviewDebug.setChecked(preferences.getBoolean(PREF_WEBVIEW_DEBUG, false));

        desktopSite.setOnCheckedChangeListener((buttonView, checked) ->
                preferences.edit().putBoolean(PREF_DESKTOP, checked).apply());
        keepAwake.setOnCheckedChangeListener((buttonView, checked) ->
                preferences.edit().putBoolean(PREF_KEEP_AWAKE, checked).apply());
        pullRefresh.setOnCheckedChangeListener((buttonView, checked) ->
                preferences.edit().putBoolean(PREF_PULL_REFRESH, checked).apply());
        rememberLastPage.setOnCheckedChangeListener((buttonView, checked) ->
                preferences.edit().putBoolean(PREF_REMEMBER_LAST_PAGE, checked).apply());
        verboseLoading.setOnCheckedChangeListener((buttonView, checked) ->
                preferences.edit().putBoolean(PREF_VERBOSE_LOADING, checked).apply());
        siteNotifications.setOnCheckedChangeListener((buttonView, checked) -> {
            preferences.edit().putBoolean(PREF_SITE_NOTIFICATIONS, checked).apply();
            if (checked) requestNotificationPermissionIfNeeded(false);
            updateNotificationStatus();
        });
        webviewDebug.setOnCheckedChangeListener((buttonView, checked) ->
                preferences.edit().putBoolean(PREF_WEBVIEW_DEBUG, checked).apply());

        bindToggleCard(R.id.desktopSiteCard, desktopSite);
        bindToggleCard(R.id.keepAwakeCard, keepAwake);
        bindToggleCard(R.id.pullRefreshCard, pullRefresh);
        bindToggleCard(R.id.rememberLastPageCard, rememberLastPage);
        bindToggleCard(R.id.verboseLoadingCard, verboseLoading);
        bindToggleCard(R.id.siteNotificationsCard, siteNotifications);
        bindToggleCard(R.id.webviewDebugCard, webviewDebug);

        findViewById(R.id.backButton).setOnClickListener(v -> finish());
        findViewById(R.id.creditsButton).setOnClickListener(v -> toggleCredits());
        findViewById(R.id.reloadCard).setOnClickListener(v -> {
            setResult(RESULT_OK, new Intent().putExtra(EXTRA_ACTION, ACTION_RELOAD));
            finish();
        });
        findViewById(R.id.clearCacheCard).setOnClickListener(v -> clearWebCacheOnly());
        findViewById(R.id.clearDataCard).setOnClickListener(v -> confirmClearWebData());
        findViewById(R.id.notificationSettingsCard).setOnClickListener(v -> openNotificationSettings());
        findViewById(R.id.testNotificationCard).setOnClickListener(v -> requestNotificationPermissionIfNeeded(true));
        findViewById(R.id.checkUpdatesCard).setOnClickListener(v -> openPlayStore());
        findViewById(R.id.playStoreCard).setOnClickListener(v -> openPlayStore());
        findViewById(R.id.copyDiagnosticsCard).setOnClickListener(v -> copyDiagnostics());
        findViewById(R.id.resetSettingsCard).setOnClickListener(v -> confirmResetSettings());
        findViewById(R.id.paypalCard).setOnClickListener(v -> openExternal(PAYPAL_SHARE_URL));
        findViewById(R.id.feedbackCard).setOnClickListener(v ->
                startActivity(new Intent(this, FeedbackActivity.class)));
        findViewById(R.id.appSupportDiscordCard).setOnClickListener(v -> openExternal(APP_SUPPORT_DISCORD_URL));
        findViewById(R.id.mainDiscordCard).setOnClickListener(v -> openExternal(MAIN_DISCORD_URL));
        findViewById(R.id.betaGroupCard).setOnClickListener(v -> openExternal(BETA_GROUP_URL));

        EditText settingsSearch = findViewById(R.id.settingsSearch);
        settingsSearch.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {
            }

            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {
                applySearch(s == null ? "" : s.toString());
            }

            @Override
            public void afterTextChanged(Editable s) {
            }
        });

        updateNotificationStatus();
        updateDiagnosticsSummary();
        loadRemoteAvatar(YOLANDO_AVATAR_URL, findViewById(R.id.yolandoAvatar));
        loadRemoteAvatar(DCHINZ_AVATAR_URL, findViewById(R.id.dchinzAvatar));
    }

    @Override
    protected void onResume() {
        super.onResume();
        updateNotificationStatus();
        updateDiagnosticsSummary();
    }

    private void bindToggleCard(int cardId, Switch toggle) {
        View card = findViewById(cardId);
        if (card != null && toggle != null) {
            card.setOnClickListener(v -> toggle.setChecked(!toggle.isChecked()));
        }
    }

    private void toggleCredits() {
        creditsExpanded = !creditsExpanded;
        View content = findViewById(R.id.creditsContent);
        TextView button = findViewById(R.id.creditsButton);
        content.setVisibility(creditsExpanded ? View.VISIBLE : View.GONE);
        button.setText(creditsExpanded ? "HIDE CREDITS" : "VIEW CREDITS");
    }

    private void applySearch(String query) {
        String q = query == null ? "" : query.trim().toLowerCase(Locale.US);
        boolean searching = !q.isEmpty();

        boolean aboutMatch = showIfMatches(
                R.id.aboutCard,
                q,
                "dmz ranked about version build credits creator creators yolando dchinz harley studios paypal unofficial");
        if (searching && aboutMatch
                && containsAny(q, "credit", "creator", "yolando", "dchinz", "harley", "paypal")) {
            creditsExpanded = true;
            findViewById(R.id.creditsContent).setVisibility(View.VISIBLE);
            ((TextView) findViewById(R.id.creditsButton)).setText("HIDE CREDITS");
        }

        boolean appMatch =
                showIfMatches(R.id.desktopSiteCard, q,
                        "desktop website site layout pc view user agent wide viewport")
                | showIfMatches(R.id.keepAwakeCard, q,
                        "keep screen awake display sleep")
                | showIfMatches(R.id.pullRefreshCard, q,
                        "pull refresh swipe reload gesture")
                | showIfMatches(R.id.rememberLastPageCard, q,
                        "remember last page restore reopen startup")
                | showIfMatches(R.id.verboseLoadingCard, q,
                        "detailed verbose loading status percentage progress");
        findViewById(R.id.appExperienceSection).setVisibility(appMatch ? View.VISIBLE : View.GONE);

        boolean notificationMatch =
                showIfMatches(R.id.siteNotificationsCard, q,
                        "website notifications alerts permission android")
                | showIfMatches(R.id.notificationSettingsCard, q,
                        "notification settings permission sound vibration android")
                | showIfMatches(R.id.testNotificationCard, q,
                        "test notification alert diagnostics");
        findViewById(R.id.notificationsSection).setVisibility(notificationMatch ? View.VISIBLE : View.GONE);

        boolean updateMatch =
                showIfMatches(R.id.checkUpdatesCard, q,
                        "check update updates google play store version build")
                | showIfMatches(R.id.playStoreCard, q,
                        "open google play store listing update");
        findViewById(R.id.updatesSection).setVisibility(updateMatch ? View.VISIBLE : View.GONE);

        boolean actionMatch =
                showIfMatches(R.id.reloadCard, q,
                        "reload refresh page action")
                | showIfMatches(R.id.clearCacheCard, q,
                        "clear cache webview temporary files")
                | showIfMatches(R.id.clearDataCard, q,
                        "clear data cookies website storage sign out reset web");
        findViewById(R.id.pageActionsSection).setVisibility(actionMatch ? View.VISIBLE : View.GONE);

        boolean helpMatch =
                showIfMatches(R.id.feedbackCard, q,
                        "feedback report bug feature help support")
                | showIfMatches(R.id.appSupportDiscordCard, q,
                        "app support discord help")
                | showIfMatches(R.id.mainDiscordCard, q,
                        "main dmz ranked discord community")
                | showIfMatches(R.id.betaGroupCard, q,
                        "beta group closed testing google play tester");
        findViewById(R.id.helpSection).setVisibility(helpMatch ? View.VISIBLE : View.GONE);

        boolean developerMatch =
                showIfMatches(R.id.diagnosticsCard, q,
                        "developer diagnostics runtime android device webview version permission")
                | showIfMatches(R.id.webviewDebugCard, q,
                        "webview debugging developer adb inspect")
                | showIfMatches(R.id.copyDiagnosticsCard, q,
                        "copy diagnostic report support device webview")
                | showIfMatches(R.id.resetSettingsCard, q,
                        "reset app settings defaults developer");
        findViewById(R.id.developerSection).setVisibility(developerMatch ? View.VISIBLE : View.GONE);

        boolean any = aboutMatch || appMatch || notificationMatch || updateMatch
                || actionMatch || helpMatch || developerMatch;
        findViewById(R.id.searchEmptyState).setVisibility(searching && !any ? View.VISIBLE : View.GONE);
    }

    private boolean showIfMatches(int viewId, String query, String keywords) {
        View view = findViewById(viewId);
        if (view == null) return false;
        boolean show = query == null || query.isEmpty()
                || (keywords != null && keywords.toLowerCase(Locale.US).contains(query));
        view.setVisibility(show ? View.VISIBLE : View.GONE);
        return show;
    }

    private boolean containsAny(String source, String... terms) {
        if (source == null) return false;
        for (String term : terms) {
            if (source.contains(term)) return true;
        }
        return false;
    }

    private void requestNotificationPermissionIfNeeded(boolean postTestAfter) {
        pendingTestNotification = postTestAfter;
        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(
                    new String[]{Manifest.permission.POST_NOTIFICATIONS},
                    NOTIFICATION_PERMISSION_REQUEST);
            return;
        }
        if (postTestAfter) postTestNotification();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != NOTIFICATION_PERMISSION_REQUEST) return;

        boolean granted = grantResults.length > 0
                && grantResults[0] == PackageManager.PERMISSION_GRANTED;
        updateNotificationStatus();

        if (granted && pendingTestNotification) {
            postTestNotification();
        } else if (!granted && pendingTestNotification) {
            Toast.makeText(this,
                    "Notification permission is blocked. Open Android notification settings to enable it.",
                    Toast.LENGTH_LONG).show();
        }
        pendingTestNotification = false;
    }

    private void updateNotificationStatus() {
        TextView status = findViewById(R.id.notificationStatusText);
        if (status == null) return;

        boolean enabled = preferences != null
                && preferences.getBoolean(PREF_SITE_NOTIFICATIONS, true);
        boolean permissionGranted = Build.VERSION.SDK_INT < 33
                || checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                == PackageManager.PERMISSION_GRANTED;

        if (!enabled) {
            status.setText("Website notifications are off");
            status.setTextColor(getColor(R.color.dmz_muted));
        } else if (permissionGranted) {
            status.setText("Enabled • Android permission granted");
            status.setTextColor(getColor(R.color.dmz_green));
        } else {
            status.setText("Permission needed • tap Android notification settings");
            status.setTextColor(getColor(R.color.dmz_gold));
        }
    }

    private void ensureNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;
        NotificationChannel channel = new NotificationChannel(
                SITE_NOTIFICATION_CHANNEL,
                "DMZ Ranked website alerts",
                NotificationManager.IMPORTANCE_DEFAULT);
        channel.setDescription("Website alerts and app notification tests from DMZ Ranked.");
        manager.createNotificationChannel(channel);
    }

    private void postTestNotification() {
        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
            Toast.makeText(this, "Notification permission is not granted.", Toast.LENGTH_SHORT).show();
            return;
        }

        ensureNotificationChannel();
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) {
            Toast.makeText(this, "Android notification service is unavailable.", Toast.LENGTH_SHORT).show();
            return;
        }

        Intent launch = new Intent(this, MainActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                4200,
                launch,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(this, SITE_NOTIFICATION_CHANNEL)
                : new Notification.Builder(this);

        builder.setSmallIcon(R.drawable.ic_notification)
                .setContentTitle("DMZ Ranked test notification")
                .setContentText("Notifications are working on this device.")
                .setStyle(new Notification.BigTextStyle()
                        .bigText("Notifications are working on this device. This is a local app test."))
                .setContentIntent(pendingIntent)
                .setAutoCancel(true)
                .setColor(getColor(R.color.dmz_gold));

        try {
            Bitmap logo = BitmapFactory.decodeResource(getResources(), R.drawable.dmz_ranked_logo);
            if (logo != null) builder.setLargeIcon(logo);
        } catch (Throwable ignored) {
        }

        manager.notify(11999, builder.build());
        Toast.makeText(this, "Test notification sent.", Toast.LENGTH_SHORT).show();
    }

    private void openNotificationSettings() {
        try {
            Intent intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                    .putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName());
            startActivity(intent);
        } catch (Throwable error) {
            Toast.makeText(this, "Could not open Android notification settings.", Toast.LENGTH_SHORT).show();
        }
    }

    private void openPlayStore() {
        try {
            Intent market = new Intent(Intent.ACTION_VIEW, Uri.parse(PLAY_STORE_MARKET));
            market.setPackage("com.android.vending");
            startActivity(market);
        } catch (Throwable ignored) {
            openExternal(PLAY_STORE_HTTPS);
        }
    }

    private void clearWebCacheOnly() {
        try {
            WebView tempWebView = new WebView(this);
            tempWebView.clearCache(true);
            tempWebView.destroy();
            Toast.makeText(this,
                    "Web cache cleared. Cookies and website storage were kept.",
                    Toast.LENGTH_SHORT).show();
        } catch (Throwable error) {
            Log.e(TAG, "Could not clear web cache", error);
            Toast.makeText(this, "Could not clear web cache.", Toast.LENGTH_LONG).show();
        }
    }

    private void confirmClearWebData() {
        new AlertDialog.Builder(this)
                .setTitle("Clear website data?")
                .setMessage("This clears WebView cache, cookies, and site storage. You may be signed out of DMZ Ranked.")
                .setNegativeButton("Cancel", null)
                .setPositiveButton("Clear data", (dialog, which) -> clearWebData())
                .show();
    }

    private void clearWebData() {
        try {
            WebView tempWebView = new WebView(this);
            tempWebView.clearCache(true);
            tempWebView.clearHistory();
            tempWebView.destroy();

            WebStorage.getInstance().deleteAllData();
            preferences.edit().remove(PREF_LAST_PAGE_URL).apply();

            CookieManager.getInstance().removeAllCookies(value -> runOnUiThread(() -> {
                CookieManager.getInstance().flush();
                Toast.makeText(SettingsActivity.this,
                        "Website cache, cookies, and site storage cleared.",
                        Toast.LENGTH_SHORT).show();
            }));
        } catch (Throwable error) {
            Log.e(TAG, "Could not clear web data", error);
            Toast.makeText(this, "Could not clear website data.", Toast.LENGTH_LONG).show();
        }
    }

    private void confirmResetSettings() {
        new AlertDialog.Builder(this)
                .setTitle("Reset app settings?")
                .setMessage("This restores Android app settings to defaults. Website cookies and site storage are not deleted.")
                .setNegativeButton("Cancel", null)
                .setPositiveButton("Reset", (dialog, which) -> {
                    preferences.edit().clear().apply();
                    Toast.makeText(this, "App settings reset to defaults.", Toast.LENGTH_SHORT).show();
                    recreate();
                })
                .show();
    }

    private void updateDiagnosticsSummary() {
        TextView target = findViewById(R.id.diagnosticsSummaryText);
        if (target == null) return;

        PackageInfo webViewPackage = null;
        try {
            webViewPackage = WebView.getCurrentWebViewPackage();
        } catch (Throwable ignored) {
        }

        String webViewText = webViewPackage == null
                ? "Unknown"
                : webViewPackage.packageName + " " + webViewPackage.versionName;

        boolean notificationPermission = Build.VERSION.SDK_INT < 33
                || checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                == PackageManager.PERMISSION_GRANTED;

        target.setText(
                "Android " + Build.VERSION.RELEASE
                        + " • " + Build.MANUFACTURER + " " + Build.MODEL
                        + "\nWebView: " + webViewText
                        + "\nNotifications: " + (notificationPermission ? "Allowed" : "Blocked")
                        + " • Desktop: " + onOff(PREF_DESKTOP, false)
                        + " • Pull refresh: " + onOff(PREF_PULL_REFRESH, true)
                        + "\nRemember page: " + onOff(PREF_REMEMBER_LAST_PAGE, true)
                        + " • WebView debug: " + onOff(PREF_WEBVIEW_DEBUG, false));
    }

    private String buildDiagnosticsReport() {
        PackageInfo app = getPackageInfoSafe();
        String versionName = app == null || app.versionName == null ? "Unknown" : app.versionName;
        long versionCode = app == null
                ? -1
                : (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                    ? app.getLongVersionCode()
                    : app.versionCode);

        PackageInfo webViewPackage = null;
        try {
            webViewPackage = WebView.getCurrentWebViewPackage();
        } catch (Throwable ignored) {
        }
        String webViewText = webViewPackage == null
                ? "Unknown"
                : webViewPackage.packageName + " " + webViewPackage.versionName;

        boolean notificationPermission = Build.VERSION.SDK_INT < 33
                || checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                == PackageManager.PERMISSION_GRANTED;

        return "DMZ Ranked Android Diagnostics\n"
                + "App: " + versionName + (versionCode >= 0 ? " (" + versionCode + ")" : "") + "\n"
                + "Package: " + getPackageName() + "\n"
                + "Android: " + Build.VERSION.RELEASE + " (API " + Build.VERSION.SDK_INT + ")\n"
                + "Device: " + Build.MANUFACTURER + " " + Build.MODEL + "\n"
                + "WebView: " + webViewText + "\n"
                + "Notification permission: " + (notificationPermission ? "Allowed" : "Blocked") + "\n"
                + "Website notifications: " + onOff(PREF_SITE_NOTIFICATIONS, true) + "\n"
                + "Desktop website: " + onOff(PREF_DESKTOP, false) + "\n"
                + "Keep screen awake: " + onOff(PREF_KEEP_AWAKE, false) + "\n"
                + "Pull to refresh: " + onOff(PREF_PULL_REFRESH, true) + "\n"
                + "Remember last page: " + onOff(PREF_REMEMBER_LAST_PAGE, true) + "\n"
                + "Detailed loading: " + onOff(PREF_VERBOSE_LOADING, false) + "\n"
                + "WebView debugging: " + onOff(PREF_WEBVIEW_DEBUG, false);
    }

    private String onOff(String key, boolean defaultValue) {
        return preferences != null && preferences.getBoolean(key, defaultValue) ? "On" : "Off";
    }

    private void copyDiagnostics() {
        String report = buildDiagnosticsReport();
        ClipboardManager clipboard = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
        if (clipboard == null) {
            Toast.makeText(this, "Clipboard is unavailable.", Toast.LENGTH_SHORT).show();
            return;
        }
        clipboard.setPrimaryClip(ClipData.newPlainText("DMZ Ranked diagnostics", report));
        Toast.makeText(this, "Diagnostic report copied.", Toast.LENGTH_SHORT).show();
    }

    private PackageInfo getPackageInfoSafe() {
        try {
            return getPackageManager().getPackageInfo(getPackageName(), 0);
        } catch (Throwable ignored) {
            return null;
        }
    }

    private void configureSystemBars() {
        View root = findViewById(R.id.settingsRoot);
        if (root == null) return;

        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
        getWindow().getDecorView().setSystemUiVisibility(0);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            getWindow().setNavigationBarContrastEnforced(false);
        }

        root.setOnApplyWindowInsetsListener((view, insets) -> {
            int left;
            int top;
            int right;
            int bottom;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                Insets bars = insets.getInsets(WindowInsets.Type.systemBars());
                left = bars.left;
                top = bars.top;
                right = bars.right;
                bottom = bars.bottom;
            } else {
                left = insets.getSystemWindowInsetLeft();
                top = insets.getSystemWindowInsetTop();
                right = insets.getSystemWindowInsetRight();
                bottom = insets.getSystemWindowInsetBottom();
            }

            view.setPadding(left, top, right, bottom);
            return insets;
        });
        root.requestApplyInsets();
    }

    private void openExternal(String url) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
        } catch (ActivityNotFoundException error) {
            Toast.makeText(this, "No app can open this link.", Toast.LENGTH_SHORT).show();
        }
    }

    private void applyBrandLogo(ImageView imageView) {
        if (imageView == null) return;
        imageView.setBackgroundColor(Color.TRANSPARENT);
        imageView.setScaleType(ImageView.ScaleType.CENTER_INSIDE);
        imageView.setImageResource(R.drawable.dmz_ranked_logo);
    }

    private void loadRemoteAvatar(String url, ImageView target) {
        if (target == null) return;

        new Thread(() -> {
            HttpURLConnection connection = null;
            InputStream input = null;
            try {
                connection = (HttpURLConnection) new URL(url).openConnection();
                connection.setConnectTimeout(5000);
                connection.setReadTimeout(5000);
                connection.setInstanceFollowRedirects(true);
                connection.setRequestProperty(
                        "User-Agent",
                        "DMZRankedApp/1.0.24 (HarleysStudios; AndroidClient; com.harleytg.dmzranked)");
                input = connection.getInputStream();
                Bitmap avatar = BitmapFactory.decodeStream(input);
                if (avatar != null && !isFinishing()) {
                    runOnUiThread(() -> {
                        if (!isFinishing()) target.setImageBitmap(avatar);
                    });
                }
            } catch (Throwable error) {
                Log.w(TAG, "Could not load creator avatar", error);
            } finally {
                try {
                    if (input != null) input.close();
                } catch (Exception ignored) {
                }
                if (connection != null) connection.disconnect();
            }
        }, "DMZSettingsAvatarLoader").start();
    }
}
