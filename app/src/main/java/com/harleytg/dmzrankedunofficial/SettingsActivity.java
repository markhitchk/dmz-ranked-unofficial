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
import android.content.res.ColorStateList;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.Insets;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.provider.Settings;
import android.text.Editable;
import android.text.InputFilter;
import android.text.InputType;
import android.text.TextWatcher;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.WebStorage;
import android.webkit.WebView;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.Switch;
import android.widget.TextView;

import com.google.android.play.core.appupdate.AppUpdateInfo;
import com.google.android.play.core.appupdate.AppUpdateManager;
import com.google.android.play.core.appupdate.AppUpdateManagerFactory;
import com.google.android.play.core.appupdate.AppUpdateOptions;
import com.google.android.play.core.install.InstallStateUpdatedListener;
import com.google.android.play.core.install.model.AppUpdateType;
import com.google.android.play.core.install.model.InstallStatus;
import com.google.android.play.core.install.model.UpdateAvailability;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.text.DateFormat;
import java.util.Date;
import java.util.Iterator;
import java.util.Locale;

import org.json.JSONObject;

public class SettingsActivity extends Activity {
    private static final String TAG = "DMZRankedSettings";
    private static final String PAYPAL_SHARE_URL = "https://share.google/9nj1GcaYNu3qJTTeu";
    private static final String HARLEYS_STUDIOS_KOFI_URL = "https://ko-fi.com/harleytg_#checkoutModal";
    private static final String APP_SUPPORT_DISCORD_URL = "https://discord.gg/kdHneTZkyd";
    private static final String MAIN_DISCORD_URL = "https://discord.gg/jTaTHqw45F";
    private static final String BETA_GROUP_URL = "https://groups.google.com/g/dmz-ranked";
    private static final String DMZ_TICKER_BUILDER_URL = "https://dmz-ticker.netlify.app";
    private static final String DMZ_THEMED_OBS_BUILDER_URL = "https://dmz-themed-obs.netlify.app";
    private static final String PLAY_STORE_HTTPS_PREFIX = "https://play.google.com/store/apps/details?id=";
    private static final String PLAY_STORE_MARKET_PREFIX = "market://details?id=";
    private static final String PRODUCTION_PACKAGE = "com.harleytg.dmzranked";
    private static final String BETA_PACKAGE = "com.harleytg.dmzranked.beta";
    private static final String HUB_BETA_PACKAGE = "com.harleytg.rankedhub.beta";
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
    private static final String PREF_SELECTED_OPERATOR = "website_selected_operator";
    private static final String PREF_OPERATOR_VERIFIED = "website_operator_verified";
    private static final String PREF_OPERATOR_PROTECTED = "website_operator_protected";
    private static final String PREF_OPERATOR_SOURCE = "website_operator_source";
    private static final String PREF_OPERATOR_SYNC_MS = "website_operator_sync_ms";
    private static final String PREF_OPERATOR_AUTOSAVE = "operator_auto_save";
    private static final String PREF_CONTENT_SIZE = "content_size";
    private static final String PREF_APP_ANIMATIONS = "app_animations";
    private static final String PREF_REDUCED_MOTION = "reduced_motion";
    private static final int EXPORT_RANKED_BACKUP_REQUEST = 7112;
    private static final int IMPORT_RANKED_BACKUP_REQUEST = 7113;

    private static final String SITE_NOTIFICATION_CHANNEL = "dmz_site_alerts_v3_heads_up";
    private static final int NOTIFICATION_PERMISSION_REQUEST = 2004;
    private static final int PLAY_UPDATE_REQUEST = 2005;
    private static final long LIVE_PLAY_UPDATE_POLL_MS = 30_000L;

    // Developer tools are intentionally hidden from normal Settings. Five taps on
    // Harley's Studios in Credits opens the PIN gate. The PIN itself is never stored
    // in plaintext: verification uses two salted SHA-256 stages and compares the final
    // digest in constant time.
    private static final int DEV_UNLOCK_TAPS = 5;
    private static final long DEV_TAP_WINDOW_MS = 4500L;
    private static final int DEV_MAX_PIN_ATTEMPTS = 5;
    private static final long DEV_PIN_LOCKOUT_MS = 30000L;
    private static final String DEV_HASH_SALT_1 = "DMZRanked::DeveloperGate::Layer1::v1";
    private static final String DEV_HASH_SALT_2 = "HarleysStudios::DeveloperGate::Layer2::v1";
    private static final String DEV_PIN_DOUBLE_HASH =
            "af237b066602cebf2ea25843fdab831639173b894205a21192b15c6ac242c23d";

    public static final String EXTRA_LAUNCHER_THEME = "ranked_launcher_theme";
    public static final String EXTRA_ACTION = "settings_action";
    public static final String EXTRA_OPERATOR_NAME = "operator_name";
    public static final String ACTION_RELOAD = "reload";
    public static final String ACTION_SAVE_OPERATOR = "save_operator";
    public static final String ACTION_RESTORE_OPERATOR = "restore_operator";
    public static final String ACTION_SELECT_OPERATOR = "select_operator";

    private int launcherTheme = RankedHeaderView.THEME_COMMUNITY;
    private View settingsHeader;
    private SharedPreferences preferences;
    private RankedSettingsNavigator settingsNavigator;
    private char[] pendingBackupPassword;
    private boolean pendingBackupExport;
    private java.util.Set<String> selectedExportSites =
            new java.util.HashSet<>(java.util.Arrays.asList("hub","community"));
    private AppUpdateManager appUpdateManager;
    private InstallStateUpdatedListener installStateUpdatedListener;
    private boolean updateReadyDialogShown;
    private Handler playUpdateHandler;
    private Runnable playUpdatePoller;
    private boolean livePlayUpdateMonitoring;
    private boolean playUpdateCheckInFlight;
    private long lastPlayUpdateCheckAt;
    private long lastAnnouncedUpdateBuild = -1L;
    private boolean pendingTestNotification;
    private boolean creditsExpanded;
    private boolean developerUnlocked;
    private int developerTapCount;
    private long developerTapWindowStartedAt;
    private int developerPinFailures;
    private long developerPinLockoutUntil;

    @Override
    protected void attachBaseContext(Context newBase) {
        super.attachBaseContext(AppUiScale.wrap(newBase));
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        preferences = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        setContentView(R.layout.activity_settings);
        launcherTheme = getIntent().getIntExtra(
                EXTRA_LAUNCHER_THEME, RankedHeaderView.THEME_COMMUNITY);
        if (launcherTheme < RankedHeaderView.THEME_HUB
                || launcherTheme > RankedHeaderView.THEME_COMMUNITY) {
            launcherTheme = RankedHeaderView.THEME_COMMUNITY;
        }
        configureSystemBars();
        installRankedSettingsHeader();
        RankedSettingsStyler.apply(this, launcherTheme);

        appUpdateManager = AppUpdateManagerFactory.create(this);
        installStateUpdatedListener = state -> runOnUiThread(() ->
                handlePlayInstallState(
                        state.installStatus(),
                        state.bytesDownloaded(),
                        state.totalBytesToDownload()));

        playUpdateHandler = new Handler(Looper.getMainLooper());
        playUpdatePoller = new Runnable() {
            @Override
            public void run() {
                if (!livePlayUpdateMonitoring || isFinishing()) return;
                checkForPlayUpdate(false);
                playUpdateHandler.postDelayed(this, LIVE_PLAY_UPDATE_POLL_MS);
            }
        };

        applyBrandLogo(findViewById(R.id.settingsLogo));
        applyBrandLogo(findViewById(R.id.aboutLogo));
        RankedSettingsStyler.applyAboutLogo(this, launcherTheme);

        boolean betaBuild = getPackageName().endsWith(".beta");
        TextView settingsSubtitle = findViewById(R.id.settingsSubtitle);
        TextView aboutTitle = findViewById(R.id.aboutTitle);
        TextView aboutBetaBadge = findViewById(R.id.aboutBetaBadge);
        if (aboutTitle != null) {
            aboutTitle.setText(RankedSettingsStyler.pageTitleFor(launcherTheme));
        }
        TextView creditsSummary=findViewById(R.id.creditsSummaryText);
        if(creditsSummary!=null && isRankedHubBuild()){
            if(launcherTheme==RankedHeaderView.THEME_HUB){
                creditsSummary.setText("Ranked Hub Android app by Harley's Studios. "
                        +"MW4 and ARC Raiders are independent Harley's Studios ranked projects. "
                        +"Original DMZRanked.com was created by YoLando & dCHINZ.");
            }else if(launcherTheme==RankedHeaderView.THEME_DMZ_V1){
                creditsSummary.setText("MW4 DMZ Ranked V1 by Harley's Studios. "
                        +"Original DMZRanked.com by YoLando & dCHINZ is a separate community project.");
            }else if(launcherTheme==RankedHeaderView.THEME_ARC){
                creditsSummary.setText("ARC Raiders Ranked by Harley's Studios. "
                        +"Original DMZRanked.com by YoLando & dCHINZ is a separate community project.");
            }else{
                creditsSummary.setText("Original DMZRanked.com website by YoLando & dCHINZ. "
                        +"Android integration by Harley's Studios.");
            }
        }
        if (aboutBetaBadge != null) {
            aboutBetaBadge.setVisibility(betaBuild ? View.VISIBLE : View.GONE);
        }
        View betaProgramSection = findViewById(R.id.betaProgramSection);
        if (betaProgramSection != null) {
            betaProgramSection.setVisibility(betaBuild ? View.VISIBLE : View.GONE);
        }
        View widgetSection = findViewById(R.id.widgetSection);
        if (widgetSection != null) {
            widgetSection.setVisibility(betaBuild && isCommunityContext()
                    ? View.VISIBLE : View.GONE);
        }

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
        if (settingsSubtitle != null) {
            settingsSubtitle.setText(
                    "Version " + versionName
                            + " • Build "
                            + (versionCode >= 0 ? versionCode : "Unknown"));
        }
        versionText.setText("Version " + versionName);
        buildText.setText(versionCode >= 0 ? "Build " + versionCode : "Build unknown");
        updateVersionText.setText("Installed: " + versionName
                + (versionCode >= 0 ? " (" + versionCode + ")" : "")
                + " • Checking Google Play…");

        Switch desktopSite = findViewById(R.id.desktopSiteSwitch);
        Switch keepAwake = findViewById(R.id.keepAwakeSwitch);
        Switch pullRefresh = findViewById(R.id.pullRefreshSwitch);
        Switch rememberLastPage = findViewById(R.id.rememberLastPageSwitch);
        Switch verboseLoading = findViewById(R.id.verboseLoadingSwitch);
        Switch siteNotifications = findViewById(R.id.siteNotificationsSwitch);
        Switch operatorAutoSave = findViewById(R.id.operatorAutoSaveSwitch);
        Switch appAnimations = findViewById(R.id.appAnimationsSwitch);
        Switch reducedMotion = findViewById(R.id.reducedMotionSwitch);
        Switch webviewDebug = findViewById(R.id.webviewDebugSwitch);

        desktopSite.setChecked(preferences.getBoolean(PREF_DESKTOP, false));
        keepAwake.setChecked(preferences.getBoolean(PREF_KEEP_AWAKE, false));
        pullRefresh.setChecked(preferences.getBoolean(PREF_PULL_REFRESH, true));
        rememberLastPage.setChecked(preferences.getBoolean(PREF_REMEMBER_LAST_PAGE, true));
        verboseLoading.setChecked(preferences.getBoolean(PREF_VERBOSE_LOADING, isRankedHubBuild()));
        siteNotifications.setChecked(preferences.getBoolean(PREF_SITE_NOTIFICATIONS, true));
        operatorAutoSave.setChecked(preferences.getBoolean(PREF_OPERATOR_AUTOSAVE, true));
        appAnimations.setChecked(preferences.getBoolean(PREF_APP_ANIMATIONS, true));
        reducedMotion.setChecked(preferences.getBoolean(PREF_REDUCED_MOTION, false));
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
            if (checked) {
                ensureNotificationChannel();
                requestNotificationPermissionIfNeeded(false);
            }
            NotificationSync.configure(this);
            if (checked) NotificationSync.primeBaseline(this);
            updateNotificationStatus();
        });
        operatorAutoSave.setOnCheckedChangeListener((buttonView, checked) ->
                preferences.edit().putBoolean(PREF_OPERATOR_AUTOSAVE, checked).apply());
        appAnimations.setOnCheckedChangeListener((buttonView, checked) -> {
            preferences.edit().putBoolean(PREF_APP_ANIMATIONS, checked).apply();
            if (checked) runEntryAnimations();
        });
        reducedMotion.setOnCheckedChangeListener((buttonView, checked) ->
                preferences.edit().putBoolean(PREF_REDUCED_MOTION, checked).apply());
        webviewDebug.setOnCheckedChangeListener((buttonView, checked) ->
                preferences.edit().putBoolean(PREF_WEBVIEW_DEBUG, checked).apply());

        bindToggleCard(R.id.desktopSiteCard, desktopSite);
        bindToggleCard(R.id.keepAwakeCard, keepAwake);
        bindToggleCard(R.id.pullRefreshCard, pullRefresh);
        bindToggleCard(R.id.rememberLastPageCard, rememberLastPage);
        bindToggleCard(R.id.verboseLoadingCard, verboseLoading);
        bindToggleCard(R.id.siteNotificationsCard, siteNotifications);
        bindToggleCard(R.id.operatorAutoSaveCard, operatorAutoSave);
        bindToggleCard(R.id.appAnimationsCard, appAnimations);
        bindToggleCard(R.id.reducedMotionCard, reducedMotion);
        bindToggleCard(R.id.webviewDebugCard, webviewDebug);

        findViewById(R.id.contentSizeCompactButton).setOnClickListener(v -> setContentSize("compact"));
        findViewById(R.id.contentSizeStandardButton).setOnClickListener(v -> setContentSize("standard"));
        findViewById(R.id.contentSizeLargeButton).setOnClickListener(v -> setContentSize("large"));
        updateContentSizeUi();

        findViewById(R.id.backButton).setOnClickListener(v -> handleSettingsBack());
        findViewById(R.id.creditsButton).setOnClickListener(v -> toggleCredits());
        findViewById(R.id.developerUnlockTrigger).setOnClickListener(v -> handleDeveloperUnlockTap());
        findViewById(R.id.reloadCard).setOnClickListener(v -> {
            setResult(RESULT_OK, new Intent().putExtra(EXTRA_ACTION, ACTION_RELOAD));
            finish();
        });
        findViewById(R.id.clearCacheCard).setOnClickListener(v -> clearWebCacheOnly());
        findViewById(R.id.clearDataCard).setOnClickListener(v -> confirmClearWebData());
        View.OnClickListener syncOperator = v -> {
            setResult(RESULT_OK, new Intent().putExtra(EXTRA_ACTION, ACTION_SAVE_OPERATOR));
            finish();
        };
        findViewById(R.id.saveOperatorCard).setOnClickListener(syncOperator);
        findViewById(R.id.refreshOperatorCard).setOnClickListener(syncOperator);
        findViewById(R.id.backupOperatorCard).setOnClickListener(syncOperator);
        findViewById(R.id.openWebsiteCard).setOnClickListener(v -> finish());
        findViewById(R.id.restoreOperatorCard).setOnClickListener(v -> {
            setResult(RESULT_OK, new Intent().putExtra(EXTRA_ACTION, ACTION_RESTORE_OPERATOR));
            finish();
        });
        findViewById(R.id.operatorPickerCard).setOnClickListener(v -> showOperatorPicker());
        findViewById(R.id.operatorListText).setOnClickListener(v -> showOperatorPicker());
        findViewById(R.id.peerImportCard).setOnClickListener(v -> confirmPeerImport());
        installRankedDestinationSettings();
        // Keep the original DMZRanked.com stable Settings unchanged.
        // Ranked Hub Beta uses a category overview with scoped detail screens.
        if (isRankedHubBuild()) {
            settingsNavigator = new RankedSettingsNavigator(this, launcherTheme, () ->
                    applySearch(((EditText) findViewById(R.id.settingsSearch))
                            .getText().toString()));
        }
        findViewById(R.id.notificationSettingsCard).setOnClickListener(v -> openNotificationSettings());
        findViewById(R.id.testNotificationCard).setOnClickListener(v -> requestNotificationPermissionIfNeeded(true));
        findViewById(R.id.checkUpdatesCard).setOnClickListener(v -> checkForPlayUpdate(true));
        findViewById(R.id.playStoreCard).setOnClickListener(v -> openPlayStore());
        findViewById(R.id.copyDiagnosticsCard).setOnClickListener(v -> {
            if (developerUnlocked) copyDiagnostics();
        });
        findViewById(R.id.lockDeveloperToolsCard).setOnClickListener(v -> lockDeveloperTools());
        findViewById(R.id.resetSettingsCard).setOnClickListener(v -> confirmResetSettings());
        findViewById(R.id.paypalCard).setOnClickListener(v -> openExternal(PAYPAL_SHARE_URL));
        findViewById(R.id.harleysStudiosSupportCard).setOnClickListener(
                v -> openExternal(HARLEYS_STUDIOS_KOFI_URL));
        findViewById(R.id.feedbackCard).setOnClickListener(v ->
                startActivity(new Intent(this, FeedbackActivity.class)));
        findViewById(R.id.appSupportDiscordCard).setOnClickListener(v -> openExternal(APP_SUPPORT_DISCORD_URL));
        findViewById(R.id.mainDiscordCard).setOnClickListener(v -> openExternal(MAIN_DISCORD_URL));
        findViewById(R.id.betaGroupCard).setOnClickListener(v -> openExternal(BETA_GROUP_URL));
        findViewById(R.id.betaDiscordCard).setOnClickListener(v -> openExternal(APP_SUPPORT_DISCORD_URL));
        findViewById(R.id.dmzTickerBuilderCard).setOnClickListener(v -> openExternal(DMZ_TICKER_BUILDER_URL));
        findViewById(R.id.dmzThemedObsBuilderCard).setOnClickListener(v -> openExternal(DMZ_THEMED_OBS_BUILDER_URL));
        findViewById(R.id.addHomeWidgetCard).setOnClickListener(v -> requestPinDmzWidget());
        findViewById(R.id.refreshWidgetsCard).setOnClickListener(v -> {
            DmzRankedWidgetProvider.requestUpdateAll(this);
            Toast.makeText(this, "Refreshing DMZ Ranked widgets…", Toast.LENGTH_SHORT).show();
        });

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
        updateOperatorBackupStatus();
        updatePeerImportUi();
        setDeveloperSectionVisible(false);
        loadRemoteAvatar(YOLANDO_AVATAR_URL, findViewById(R.id.yolandoAvatar));
        loadRemoteAvatar(DCHINZ_AVATAR_URL, findViewById(R.id.dchinzAvatar));
        runEntryAnimations();
        if (settingsNavigator != null) settingsNavigator.restoreState(savedInstanceState);
        applySearch("");
    }

    private void handleSettingsBack() {
        if (settingsNavigator != null && settingsNavigator.onBack()) return;
        finish();
    }

    @Override
    public void onBackPressed() {
        if (settingsNavigator != null && settingsNavigator.onBack()) return;
        super.onBackPressed();
    }

    @Override
    protected void onSaveInstanceState(Bundle state) {
        if (settingsNavigator != null) settingsNavigator.saveState(state);
        super.onSaveInstanceState(state);
    }

    @Override
    public void finish() {
        super.finish();
        if (preferences == null || preferences.getBoolean(PREF_APP_ANIMATIONS, true)) {
            overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out);
        }
    }

    @Override
    protected void onStart() {
        super.onStart();
        if (appUpdateManager != null && installStateUpdatedListener != null) {
            appUpdateManager.registerListener(installStateUpdatedListener);
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        NotificationSync.setAppForeground(this, true);
        NotificationSync.configure(this);
        NotificationSync.primeBaseline(this);
        updateNotificationStatus();
        updateOperatorBackupStatus();
        updatePeerImportUi();
        updateRankedSiteBackupSummary();
        startLivePlayUpdateMonitoring();
        if (developerUnlocked) updateDiagnosticsSummary();
    }

    @Override
    protected void onPause() {
        NotificationSync.setAppForeground(this, false);
        NotificationSync.scheduleBackgroundKick(this);
        super.onPause();
    }

    @Override
    protected void onStop() {
        stopLivePlayUpdateMonitoring();
        if (appUpdateManager != null && installStateUpdatedListener != null) {
            appUpdateManager.unregisterListener(installStateUpdatedListener);
        }
        super.onStop();
    }


    private void requestPinDmzWidget() {
        try {
            android.appwidget.AppWidgetManager manager =
                    android.appwidget.AppWidgetManager.getInstance(this);
            android.content.ComponentName provider =
                    new android.content.ComponentName(this, DmzRankedWidgetProvider.class);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                    && manager.isRequestPinAppWidgetSupported()) {
                boolean requested = manager.requestPinAppWidget(provider, null, null);
                if (requested) {
                    Toast.makeText(this,
                            "Choose where to place the DMZ Ranked widget.",
                            Toast.LENGTH_SHORT).show();
                    return;
                }
            }

            Toast.makeText(this,
                    "Open your Android launcher’s Widgets menu and add DMZ Ranked.",
                    Toast.LENGTH_LONG).show();
        } catch (Throwable error) {
            Log.d(TAG, "Could not request widget pin", error);
            Toast.makeText(this,
                    "Open your Android launcher’s Widgets menu and add DMZ Ranked.",
                    Toast.LENGTH_LONG).show();
        }
    }

    private void setContentSize(String size) {
        String next = ("compact".equals(size) || "large".equals(size)) ? size : "standard";
        String current = preferences.getString(PREF_CONTENT_SIZE, "standard");
        if (next.equals(current)) {
            updateContentSizeUi();
            return;
        }
        preferences.edit().putString(PREF_CONTENT_SIZE, next).commit();
        recreate();
    }

    private void updateContentSizeUi() {
        if (preferences == null) return;
        String size = preferences.getString(PREF_CONTENT_SIZE, "standard");
        if (!"compact".equals(size) && !"large".equals(size)) size = "standard";

        TextView compact = findViewById(R.id.contentSizeCompactButton);
        TextView standard = findViewById(R.id.contentSizeStandardButton);
        TextView large = findViewById(R.id.contentSizeLargeButton);
        TextView summary = findViewById(R.id.contentSizeSummary);

        int active = RankedSettingsStyler.accentFor(launcherTheme);
        int inactive = getColor(R.color.dmz_muted);
        if (compact != null) compact.setTextColor("compact".equals(size) ? active : inactive);
        if (standard != null) standard.setTextColor("standard".equals(size) ? active : inactive);
        if (large != null) large.setTextColor("large".equals(size) ? active : inactive);

        if (summary != null) {
            if ("compact".equals(size)) {
                summary.setText("Compact • smaller cards, controls, text, and website content.");
            } else if ("large".equals(size)) {
                summary.setText("Large • larger cards, controls, text, and website content.");
            } else {
                summary.setText("Standard • default app and website sizing.");
            }
        }
    }

    private void runEntryAnimations() {
        if (preferences != null && !preferences.getBoolean(PREF_APP_ANIMATIONS, true)) return;
        View search = findViewById(R.id.settingsSearch);
        View scroll = findViewById(R.id.settingsScroll);
        if (search != null) {
            search.animate().cancel();
            search.setAlpha(0f);
            search.setTranslationY(-10f);
            search.animate().alpha(1f).translationY(0f).setDuration(180L).start();
        }
        if (scroll != null) {
            scroll.animate().cancel();
            scroll.setAlpha(0f);
            scroll.setTranslationY(18f);
            scroll.animate().alpha(1f).translationY(0f).setDuration(240L).setStartDelay(45L).start();
        }
    }

    private void handleDeveloperUnlockTap() {
        long now = SystemClock.elapsedRealtime();
        if (developerTapWindowStartedAt == 0L
                || now - developerTapWindowStartedAt > DEV_TAP_WINDOW_MS) {
            developerTapWindowStartedAt = now;
            developerTapCount = 0;
        }

        developerTapCount++;
        if (developerTapCount < DEV_UNLOCK_TAPS) return;

        developerTapCount = 0;
        developerTapWindowStartedAt = 0L;
        promptForDeveloperPin();
    }

    private void promptForDeveloperPin() {
        long now = SystemClock.elapsedRealtime();
        if (developerPinLockoutUntil > now) {
            long seconds = Math.max(1L, (developerPinLockoutUntil - now + 999L) / 1000L);
            Toast.makeText(this,
                    "Developer PIN temporarily locked. Try again in " + seconds + " seconds.",
                    Toast.LENGTH_LONG).show();
            return;
        }

        DmzDialog.input(
                this,
                "DEVELOPER ACCESS",
                "Enter the 4-digit developer PIN.",
                "Developer PIN",
                InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_VARIATION_PASSWORD,
                4,
                "UNLOCK",
                "CANCEL",
                (entered, pinInput) -> {
                    if (verifyDeveloperPin(entered)) {
                        developerPinFailures = 0;
                        developerPinLockoutUntil = 0L;
                        developerUnlocked = true;
                        setDeveloperSectionVisible(true);
                        updateDiagnosticsSummary();
                        EditText search = findViewById(R.id.settingsSearch);
                        if (search != null) applySearch(search.getText().toString());
                        Toast.makeText(this, "Developer tools unlocked.", Toast.LENGTH_SHORT).show();
                        return true;
                    }

                    developerPinFailures++;
                    pinInput.setText("");
                    pinInput.setError("Incorrect developer PIN");

                    if (developerPinFailures >= DEV_MAX_PIN_ATTEMPTS) {
                        developerPinFailures = 0;
                        developerPinLockoutUntil =
                                SystemClock.elapsedRealtime() + DEV_PIN_LOCKOUT_MS;
                        Toast.makeText(this,
                                "Too many incorrect PIN attempts. Developer access locked for 30 seconds.",
                                Toast.LENGTH_LONG).show();
                        return true;
                    }
                    return false;
                },
                null);
    }

    private boolean verifyDeveloperPin(String pin) {
        if (pin == null || pin.length() != 4) return false;
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] first = digest.digest((DEV_HASH_SALT_1 + pin)
                    .getBytes(StandardCharsets.UTF_8));
            String firstHex = toHex(first);

            digest.reset();
            byte[] second = digest.digest((DEV_HASH_SALT_2 + firstHex)
                    .getBytes(StandardCharsets.UTF_8));
            byte[] expected = hexToBytes(DEV_PIN_DOUBLE_HASH);
            return MessageDigest.isEqual(second, expected);
        } catch (Throwable error) {
            Log.e(TAG, "Developer PIN verification failed", error);
            return false;
        }
    }

    private String toHex(byte[] bytes) {
        StringBuilder out = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) {
            out.append(String.format(Locale.US, "%02x", value & 0xff));
        }
        return out.toString();
    }

    private byte[] hexToBytes(String hex) {
        if (hex == null || (hex.length() & 1) != 0) return new byte[0];
        byte[] out = new byte[hex.length() / 2];
        for (int i = 0; i < out.length; i++) {
            int hi = Character.digit(hex.charAt(i * 2), 16);
            int lo = Character.digit(hex.charAt(i * 2 + 1), 16);
            if (hi < 0 || lo < 0) return new byte[0];
            out[i] = (byte) ((hi << 4) | lo);
        }
        return out;
    }

    private void setDeveloperSectionVisible(boolean visible) {
        View section = findViewById(R.id.developerSection);
        if (section != null) {
            section.setVisibility(visible ? View.VISIBLE : View.GONE);
        }
    }

    private void lockDeveloperTools() {
        developerUnlocked = false;
        setDeveloperSectionVisible(false);
        EditText search = findViewById(R.id.settingsSearch);
        if (search != null) applySearch(search.getText().toString());
        Toast.makeText(this, "Developer tools locked.", Toast.LENGTH_SHORT).show();
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
                "dmz ranked about version build credits creator creators yolando dchinz harley studios harleytg harley-the-gamer gamer paypal ko-fi kofi support donate donation unofficial");
        if (searching && aboutMatch
                && containsAny(q, "credit", "creator", "yolando", "dchinz", "harley", "paypal", "ko-fi", "kofi", "support", "donat")) {
            creditsExpanded = true;
            findViewById(R.id.creditsContent).setVisibility(View.VISIBLE);
            ((TextView) findViewById(R.id.creditsButton)).setText("HIDE CREDITS");
        }

        boolean appearanceMatch =
                showIfMatches(R.id.contentSizeCard, q,
                        "appearance display size compact standard large zoom text content density")
                | showIfMatches(R.id.appAnimationsCard, q,
                        "appearance animation animations motion fade transition smooth");
        appearanceMatch |= showIfMatches(R.id.reducedMotionCard, q,
                "motion reduced animations startup accessibility");
        findViewById(R.id.appearanceSection).setVisibility(appearanceMatch ? View.VISIBLE : View.GONE);

        boolean widgetMatch = false;
        if (getPackageName().endsWith(".beta") && isCommunityContext()) {
            widgetMatch =
                    showIfMatches(R.id.addHomeWidgetCard, q,
                            "widget home screen pin add rank sr standing operator beta")
                    | showIfMatches(R.id.refreshWidgetsCard, q,
                            "widget refresh update reload live cached operator rank sr");
            findViewById(R.id.widgetSection)
                    .setVisibility(widgetMatch ? View.VISIBLE : View.GONE);
        } else {
            findViewById(R.id.widgetSection).setVisibility(View.GONE);
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
                        "verbose startup splash loading status steps stages percentage progress");
        findViewById(R.id.appExperienceSection).setVisibility(appMatch ? View.VISIBLE : View.GONE);

        boolean operatorMatch =
                showIfMatches(R.id.operatorStatusCard, q,
                        "operator website account profile saved backup current dmz ranked")
                | showIfMatches(R.id.operatorAutoSaveCard, q,
                        "operator auto save backup local restore website data")
                | showIfMatches(R.id.saveOperatorCard, q,
                        "operator save now backup local website data")
                | showIfMatches(R.id.restoreOperatorCard, q,
                        "operator restore recover backup local website data");
        if(!isCommunityContext()) operatorMatch = false;
        findViewById(R.id.operatorBackupSection).setVisibility(operatorMatch ? View.VISIBLE : View.GONE);

        boolean transferMatch =
                showIfMatches(R.id.peerImportCard, q,
                        "import transfer migrate migration beta stable production app data settings operators backup");
        findViewById(R.id.dataTransferSection).setVisibility(transferMatch ? View.VISIBLE : View.GONE);

        boolean notificationMatch =
                showIfMatches(R.id.siteNotificationsCard, q,
                        "website notifications alerts permission android")
                | showIfMatches(R.id.notificationSettingsCard, q,
                        "notification settings permission sound vibration android")
                | showIfMatches(R.id.testNotificationCard, q,
                        "test notification alert diagnostics");
        if (!isCommunityContext()) {
            // Hub, MW4 and ARC support Android notification permission/tools,
            // but cannot claim the original DMZRanked.com website alert feed.
            findViewById(R.id.siteNotificationsCard).setVisibility(View.GONE);
            notificationMatch = showIfMatches(R.id.notificationSettingsCard, q,
                    "notifications android alert permission settings")
                    | showIfMatches(R.id.testNotificationCard, q,
                    "notification test alert permission android");
        }
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
                        "clear cache webview temporary files");
        if(!isCommunityContext()) {
            View legacyReload=findViewById(R.id.reloadCard);
            if(legacyReload!=null)legacyReload.setVisibility(View.GONE);
            // Cache controls remain available; the legacy reload action requires MainActivity.
        }
        findViewById(R.id.pageActionsSection).setVisibility(actionMatch ? View.VISIBLE : View.GONE);

        boolean betaProgramMatch = false;
        if (getPackageName().endsWith(".beta")) {
            betaProgramMatch =
                    showIfMatches(
                            R.id.betaDiscordCard,
                            q,
                            "beta harley harleys studios discord testing early build bug report support")
                    | showIfMatches(
                            R.id.dmzTickerBuilderCard,
                            q,
                            "beta widget extended links ticker builder dmz ticker netlify overlay obs")
                    | showIfMatches(
                            R.id.dmzThemedObsBuilderCard,
                            q,
                            "beta widget extended links themed obs builder dmz overlay netlify streaming");
            findViewById(R.id.betaProgramSection)
                    .setVisibility(betaProgramMatch ? View.VISIBLE : View.GONE);
        } else {
            findViewById(R.id.betaProgramSection).setVisibility(View.GONE);
            findViewById(R.id.betaDiscordCard).setVisibility(View.GONE);
            findViewById(R.id.dmzTickerBuilderCard).setVisibility(View.GONE);
            findViewById(R.id.dmzThemedObsBuilderCard).setVisibility(View.GONE);
        }

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

        boolean developerMatch = false;
        if (developerUnlocked) {
            developerMatch =
                    showIfMatches(R.id.diagnosticsCard, q,
                            "developer diagnostics runtime android device webview version permission")
                    | showIfMatches(R.id.webviewDebugCard, q,
                            "webview debugging developer adb inspect")
                    | showIfMatches(R.id.copyDiagnosticsCard, q,
                            "copy diagnostic report support device webview")
                    | showIfMatches(R.id.lockDeveloperToolsCard, q,
                            "lock developer tools diagnostics");
            findViewById(R.id.developerSection)
                    .setVisibility(developerMatch ? View.VISIBLE : View.GONE);
        } else {
            setDeveloperSectionVisible(false);
        }

        boolean dangerMatch =
                showIfMatches(R.id.clearDataCard, q,
                        "danger clear data cookies website storage sign out reset web")
                | showIfMatches(R.id.resetSettingsCard, q,
                        "danger reset app settings defaults");
        findViewById(R.id.dangerZoneSection).setVisibility(dangerMatch ? View.VISIBLE : View.GONE);

        // The all-game navigation and portable backup center belong to Hub Settings.
        // MW4, ARC and the original community site retain their own scoped controls.
        boolean destinationsMatch = isRankedHubBuild()
                && launcherTheme == RankedHeaderView.THEME_HUB
                && (!searching || containsAny(q, "destination", "game", "ranked", "mw4", "arc", "dmz", "site"));
        boolean backupsMatch = isRankedHubBuild()
                && launcherTheme == RankedHeaderView.THEME_HUB
                && (!searching || containsAny(q, "backup", "restore", "export", "import", "encrypted", "portable"));
        findViewById(R.id.rankedDestinationsSection).setVisibility(
                destinationsMatch ? View.VISIBLE : View.GONE);
        findViewById(R.id.rankedBackupSection).setVisibility(
                backupsMatch ? View.VISIBLE : View.GONE);
        if(!isCommunityContext()){
            View refreshCard=findViewById(R.id.pullRefreshCard);
            if(refreshCard!=null)refreshCard.setVisibility(View.GONE);
            View legacyBetaCard=findViewById(R.id.dmzTickerBuilderCard);
            if(legacyBetaCard!=null)legacyBetaCard.setVisibility(View.GONE);
            legacyBetaCard=findViewById(R.id.dmzThemedObsBuilderCard);
            if(legacyBetaCard!=null)legacyBetaCard.setVisibility(View.GONE);
        }
        boolean any = destinationsMatch || backupsMatch || aboutMatch || appearanceMatch || widgetMatch || appMatch || operatorMatch
                || transferMatch || notificationMatch || updateMatch || actionMatch || betaProgramMatch
                || helpMatch || dangerMatch || developerMatch;
        findViewById(R.id.searchEmptyState).setVisibility(searching && !any ? View.VISIBLE : View.GONE);
        if (settingsNavigator != null) settingsNavigator.apply(query);
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



    private boolean isBetaBuild() {
        return BETA_PACKAGE.equals(getPackageName()) || isRankedHubBuild();
    }

    private boolean isRankedHubBuild() {
        return HUB_BETA_PACKAGE.equals(getPackageName());
    }

    private boolean isCommunityContext() {
        return !isRankedHubBuild() || launcherTheme == RankedHeaderView.THEME_COMMUNITY;
    }

    private String[] rankedHubImportSources() {
        java.util.ArrayList<String> sources = new java.util.ArrayList<>();
        for (String source : new String[]{BETA_PACKAGE, PRODUCTION_PACKAGE}) {
            if (RankedHubDataTransfer.isSourceAvailable(this, source)) {
                sources.add(source);
            }
        }
        return sources.toArray(new String[0]);
    }

    private String rankedHubSourceLabel(String source) {
        return BETA_PACKAGE.equals(source) ? "Previous DMZ Ranked Beta" : "DMZ Ranked original";
    }

    private String peerPackageName() {
        return isBetaBuild() ? PRODUCTION_PACKAGE : BETA_PACKAGE;
    }

    private String peerMigrationAuthority() {
        return peerPackageName() + ".migration";
    }

    private String peerAppLabel() {
        return isBetaBuild() ? "DMZ Ranked" : "DMZ Ranked [Beta]";
    }

    private boolean isPeerMigrationAvailable() {
        try {
            return getPackageManager().resolveContentProvider(peerMigrationAuthority(), 0) != null;
        } catch (Throwable ignored) {
            return false;
        }
    }


    private void installRankedDestinationSettings() {
        if(!isRankedHubBuild())return;
        View destinations=findViewById(R.id.rankedDestinationsSection);
        View backup=findViewById(R.id.rankedBackupSection);
        if(destinations!=null)destinations.setVisibility(View.VISIBLE);
        if(backup!=null)backup.setVisibility(View.VISIBLE);
        TextView summary=findViewById(R.id.rankedDestinationSummary);
        if(summary!=null){
            String selected=RankedSettingsStyler.pageTitleFor(launcherTheme);
            summary.setText("Selected: "+selected+
                    " • Settings are scoped by destination. Account verification is handled by the website.");
        }
        updateRankedSiteBackupSummary();
        findViewById(R.id.rankedMw4SettingsCard).setOnClickListener(v -> {
            Intent i=new Intent(this,RankedSiteActivity.class);
            i.putExtra(RankedSiteActivity.EXTRA_SITE_ID,RankedSiteActivity.SITE_DMZ_V1);
            i.putExtra(RankedSiteActivity.EXTRA_OPEN_SITE_SETTINGS,true);
            startActivity(i);
        });
        findViewById(R.id.rankedArcSettingsCard).setOnClickListener(v -> {
            Intent i=new Intent(this,RankedSiteActivity.class);
            i.putExtra(RankedSiteActivity.EXTRA_SITE_ID,RankedSiteActivity.SITE_ARC);
            i.putExtra(RankedSiteActivity.EXTRA_OPEN_SITE_SETTINGS,true);
            startActivity(i);
        });
        findViewById(R.id.rankedCommunitySettingsCard)
                .setOnClickListener(v -> startActivity(new Intent(this,MainActivity.class)));
        findViewById(R.id.rankedBackupExportCard)
                .setOnClickListener(v -> beginRankedBackup(true));
        findViewById(R.id.rankedBackupImportCard)
                .setOnClickListener(v -> beginRankedBackup(false));
    }

    private void updateRankedSiteBackupSummary() {
        if (!isRankedHubBuild()) return;
        TextView status=findViewById(R.id.rankedRemoteBackupNote);
        if(status==null)return;
        String mw4=RankedSiteSafeBackupStore.read(this,RankedSiteSafeBackupStore.MW4)
                ==null ? "Not captured" : "Saved";
        String arc=RankedSiteSafeBackupStore.read(this,RankedSiteSafeBackupStore.ARC)
                ==null ? "Not captured" : "Saved";
        status.setText("MW4 local preferences: "+mw4+"  •  ARC preferences: "+arc+
                ". Open MW4 or ARC, choose the site-header options menu, then "+
                "Capture safe site preferences. After importing a backup, reopen "+
                "the site and select Restore saved site preferences. "+
                "Website backup requires site support; server accounts are not exported.");
    }

    private void beginRankedBackup(boolean export) {
        if(export){
            chooseRankedBackupExportSites();
            return;
        }
        beginRankedBackupFile(false);
    }

    private void chooseRankedBackupExportSites(){
        String[] ids={"hub","community","dmz-v1","arc-raiders"};
        boolean hasMw4=RankedSiteSafeBackupStore.read(this,"dmz-v1")!=null;
        boolean hasArc=RankedSiteSafeBackupStore.read(this,"arc-raiders")!=null;
        String[] labels={
            "Ranked Hub app settings",
            "DMZRanked.com operator snapshots",
            hasMw4?"MW4 DMZ local preferences":"MW4 DMZ — capture inside site first",
            hasArc?"ARC Raiders graphics preference":"ARC Raiders — capture inside site first"
        };
        boolean[] checked={true,true,hasMw4,hasArc};
        new AlertDialog.Builder(this).setTitle("CHOOSE BACKUP DATA")
                .setMultiChoiceItems(labels,checked,(dialog,which,isChecked)->
                        checked[which]=isChecked)
                .setNegativeButton("CANCEL",null)
                .setPositiveButton("CONTINUE",(dialog,which)->{
                    java.util.Set<String> selected=new java.util.HashSet<>();
                    for(int i=0;i<ids.length;i++)if(checked[i])selected.add(ids[i]);
                    if(selected.isEmpty()
                            ||(selected.contains("dmz-v1")&&!hasMw4)
                            ||(selected.contains("arc-raiders")&&!hasArc)){
                        android.widget.Toast.makeText(this,
                                "Select at least one available site. Capture MW4/ARC preferences first.",
                                android.widget.Toast.LENGTH_LONG).show();
                        return;
                    }
                    selectedExportSites=selected;
                    beginRankedBackupFile(true);
                }).show();
    }

    private void beginRankedBackupFile(boolean export) {
        EditText field=new EditText(this);
        field.setSingleLine(true);
        field.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        field.setHint("Passphrase, 8+ characters");
        int pad=(int)(20*getResources().getDisplayMetrics().density);
        field.setPadding(pad,pad,pad,pad);
        new AlertDialog.Builder(this)
                .setTitle(export?"ENCRYPT BACKUP":"UNLOCK BACKUP")
                .setMessage(export
                        ?"Create a passphrase to encrypt Ranked Hub preferences, sanitized "+
                        "DMZRanked.com operator backups and any saved MW4 / ARC local "+
                        "preference snapshots. First capture site preferences inside "+
                        "each ranked site. Lost passphrases cannot be recovered."
                        :"Enter the passphrase used to encrypt the selected backup.")
                .setView(field)
                .setNegativeButton("CANCEL",null)
                .setPositiveButton("CONTINUE",(dialog,which)->{
                    char[] password=field.getText().toString().toCharArray();
                    field.setText("");
                    if(password.length<8){
                        java.util.Arrays.fill(password,'\0');
                        android.widget.Toast.makeText(this,"Use at least 8 characters.",
                                android.widget.Toast.LENGTH_LONG).show();
                        return;
                    }
                    clearPendingPassword();
                    pendingBackupPassword=password;
                    pendingBackupExport=export;
                    Intent intent=new Intent(export ? Intent.ACTION_CREATE_DOCUMENT : Intent.ACTION_OPEN_DOCUMENT);
                    intent.setType("application/octet-stream");
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    if(export)intent.putExtra(Intent.EXTRA_TITLE,"ranked-hub.rankedhubbackup");
                    startActivityForResult(intent,export ?
                            EXPORT_RANKED_BACKUP_REQUEST : IMPORT_RANKED_BACKUP_REQUEST);
                }).show();
    }

    private void clearPendingPassword() {
        if(pendingBackupPassword!=null)java.util.Arrays.fill(pendingBackupPassword,'\0');
        pendingBackupPassword=null;
    }

    private void handleRankedBackup(int requestCode, int resultCode, Intent data) {
        if(resultCode!=RESULT_OK||data==null||data.getData()==null){
            clearPendingPassword();return;
        }
        if(pendingBackupPassword==null)return;
        final char[] password=pendingBackupPassword;
        pendingBackupPassword=null;
        final Uri uri=data.getData();
        if(requestCode==EXPORT_RANKED_BACKUP_REQUEST){
            new Thread(()->{
                try{
                    java.util.Set<String> selected=new java.util.HashSet<>(selectedExportSites);
                    RankedBackupManager.exportBackup(this,uri,password,selected);
                    runOnUiThread(()->android.widget.Toast.makeText(this,
                            "Encrypted backup exported.",android.widget.Toast.LENGTH_LONG).show());
                }catch(Exception e){
                    runOnUiThread(()->android.widget.Toast.makeText(this,
                            "Backup export failed. Check storage and retry.",
                            android.widget.Toast.LENGTH_LONG).show());
                }finally{java.util.Arrays.fill(password,'\0');}
            },"ranked-backup-export").start();
        }else{
            new Thread(()->{
                try{
                    RankedBackupManager.Preview preview=RankedBackupManager.inspectBackup(this,uri,password);
                    runOnUiThread(()->confirmBackupImport(preview));
                }catch(Exception e){
                    runOnUiThread(()->android.widget.Toast.makeText(this,
                            "Backup invalid or wrong passphrase.",
                            android.widget.Toast.LENGTH_LONG).show());
                }finally{java.util.Arrays.fill(password,'\0');}
            },"ranked-backup-preview").start();
        }
    }

    private void confirmBackupImport(RankedBackupManager.Preview preview) {
        if(isFinishing())return;
        String[] ids={"hub","community","dmz-v1","arc-raiders"};
        String[] labels={
            "Ranked Hub: "+preview.settingCount()+" settings",
            "DMZRanked.com: "+preview.operatorCount()+" operators",
            "MW4 V1: local preferences",
            "ARC Raiders: graphics preference"
        };
        boolean[] checked={
            preview.backupEntries>0 && preview.settings.length()>0,
            preview.operatorBackups.length()>0,
            preview.siteSnapshots.has("dmz-v1"),
            preview.siteSnapshots.has("arc-raiders")
        };
        boolean[] available={
            preview.settings.length()>0,
            preview.operatorBackups.length()>0,
            preview.siteSnapshots.has("dmz-v1"),
            preview.siteSnapshots.has("arc-raiders")
        };
        new AlertDialog.Builder(this)
                .setTitle("CHOOSE WHAT TO RESTORE")
                .setMessage("Only checked data will be replaced. Local MW4/ARC settings "
                        +"are staged in Ranked Hub; explicitly apply them inside "
                        +"the corresponding website after restore. Passwords, "
                        +"sessions and server rankings are excluded.")
                .setMultiChoiceItems(labels,checked,(dialog,which,isChecked)->
                        checked[which]=isChecked)
                .setNegativeButton("CANCEL",null)
                .setPositiveButton("RESTORE",(dialog,which)->{
                    java.util.Set<String> selected=new java.util.HashSet<>();
                    for(int i=0;i<ids.length;i++) {
                        if(checked[i] && available[i])selected.add(ids[i]);
                    }
                    if(selected.isEmpty()){
                        android.widget.Toast.makeText(this,"Choose at least one available backup entry.",
                                android.widget.Toast.LENGTH_LONG).show();
                        return;
                    }
                    new Thread(()->{
                        try{
                            int n=RankedBackupManager.restoreBackup(this,preview,selected);
                            int sites=(selected.contains("dmz-v1")?1:0)
                                    +(selected.contains("arc-raiders")?1:0);
                            runOnUiThread(()->{
                                android.widget.Toast.makeText(this,
                                        "Restored selected settings, "+n+" operator(s) and "+
                                        sites+" site snapshot(s).",
                                        android.widget.Toast.LENGTH_LONG).show();
                                recreate();
                            });
                        }catch(Exception e){
                            runOnUiThread(()->android.widget.Toast.makeText(this,
                                    "Restore failed; original data was preserved where possible.",
                                    android.widget.Toast.LENGTH_LONG).show());
                        }
                    },"ranked-backup-restore").start();
                }).show();
    }

    private void updatePeerImportUi() {
        TextView title = findViewById(R.id.peerImportTitle);
        TextView summary = findViewById(R.id.peerImportSummary);
        TextView action = findViewById(R.id.peerImportAction);
        View card = findViewById(R.id.peerImportCard);
        if (title == null || summary == null || action == null || card == null) return;

        if (isRankedHubBuild()) {
            String[] sources = rankedHubImportSources();
            boolean available = sources.length > 0;
            title.setText("Import from previous app");
            summary.setText(available
                    ? "Transfer supported app preferences and up to 2 locally saved DMZRanked.com operators. "
                        + "Choose your previous app; passwords, PINs, sessions, and website cookies are excluded."
                    : "Install or keep your previous DMZ Ranked Beta or original app to transfer compatible "
                        + "settings and operator backups. Website accounts require sign-in again.");
            action.setText(available ? "TRANSFER" : "NOT FOUND");
            card.setEnabled(available);
            card.setAlpha(available ? 1f : 0.62f);
            return;
        }

        String peer = peerAppLabel();
        boolean available = isPeerMigrationAvailable();
        title.setText("Import from " + peer);
        if (available) {
            summary.setText("Copy app settings and up to 2 app-managed operator backups from "
                    + peer + ". Website cookies and sign-in sessions stay separate.");
            action.setText("IMPORT");
            card.setEnabled(true);
            card.setAlpha(1f);
        } else {
            summary.setText(peer + " is not installed or is too old to export app data.");
            action.setText("NOT FOUND");
            card.setEnabled(false);
            card.setAlpha(0.62f);
        }
    }

    private void confirmPeerImport() {
        if (isRankedHubBuild()) {
            confirmRankedHubImport();
            return;
        }
        if (!isPeerMigrationAvailable()) {
            updatePeerImportUi();
            Toast.makeText(this, peerAppLabel() + " is not available to import from.",
                    Toast.LENGTH_LONG).show();
            return;
        }

        DmzDialog.confirm(
                this,
                "IMPORT FROM " + peerAppLabel().toUpperCase(Locale.US) + "?",
                "This copies supported Android app settings and up to 2 app-managed operator backups. "
                        + "Website cookies, sign-in sessions, passwords, and PINs are not copied. "
                        + "Matching settings in this app will be replaced.",
                "IMPORT",
                "CANCEL",
                false,
                this::importFromPeerApp);
    }


    // Import is deliberately user-initiated. Changing the Android package ID
    // does not grant access to another app's sandbox or WebView cookies.
    private void confirmRankedHubImport() {
        String[] sources = rankedHubImportSources();
        if (sources.length == 0) {
            Toast.makeText(this, "Open or install the previous DMZ Ranked app, then retry.",
                    Toast.LENGTH_LONG).show();
            updatePeerImportUi();
            return;
        }
        if (sources.length == 1) {
            confirmRankedHubSource(sources[0]);
            return;
        }
        String[] names = new String[sources.length];
        for (int i = 0; i < sources.length; i++) {
            names[i] = rankedHubSourceLabel(sources[i]);
        }
        new AlertDialog.Builder(this)
                .setTitle("CHOOSE PREVIOUS APP")
                .setItems(names, (dialog, which) -> {
                    if (which >= 0 && which < sources.length) {
                        confirmRankedHubSource(sources[which]);
                    }
                })
                .setNegativeButton("CANCEL", (dialog, which) -> dialog.dismiss())
                .show();
    }

    private void confirmRankedHubSource(String sourcePackage) {
        String label = rankedHubSourceLabel(sourcePackage);
        DmzDialog.confirm(this,
                "TRANSFER FROM " + label.toUpperCase(Locale.US) + "?",
                "Copy compatible Android preferences and up to 2 app-managed DMZRanked.com operator "
                        + "backups into Ranked Hub Beta. Existing data with the same name may be replaced. "
                        + "The previous app stays installed. Cookies, sessions, PINs, passwords, "
                        + "authentication tokens, and server account data will not transfer.",
                "TRANSFER", "CANCEL", false,
                () -> importRankedHubSource(sourcePackage));
    }

    private void importRankedHubSource(String sourcePackage) {
        try {
            RankedHubDataTransfer.Result imported =
                    RankedHubDataTransfer.importFrom(this, sourcePackage, preferences);
            Toast.makeText(this,
                    "Imported " + imported.settings + " app preference(s) and "
                            + imported.operators + " saved operator(s) from "
                            + rankedHubSourceLabel(sourcePackage) + ". Sign into websites again.",
                    Toast.LENGTH_LONG).show();
            updateOperatorBackupStatus();
            recreate();
        } catch (SecurityException denied) {
            Log.w(TAG, "Data transfer refused: source identity or signature failed", denied);
            Toast.makeText(this, "Data transfer blocked: the previous app's signature "
                    + "does not match this Ranked Hub build.", Toast.LENGTH_LONG).show();
        } catch (Throwable error) {
            Log.w(TAG, "Could not import previous app data", error);
            Toast.makeText(this, "Transfer unavailable. Keep the original app installed, "
                    + "open it once, and retry.", Toast.LENGTH_LONG).show();
        } finally {
            updatePeerImportUi();
        }
    }

    private void importFromPeerApp() {
        Cursor cursor = null;
        try {
            Uri uri = Uri.parse("content://" + peerMigrationAuthority() + "/export");
            cursor = getContentResolver().query(uri, new String[]{"payload"}, null, null, null);
            if (cursor == null || !cursor.moveToFirst()) {
                throw new IllegalStateException("No migration payload returned");
            }
            int column = cursor.getColumnIndex("payload");
            if (column < 0) throw new IllegalStateException("Migration payload column missing");

            String raw = cursor.getString(column);
            if (raw == null || raw.trim().isEmpty()) {
                throw new IllegalStateException("Migration payload was empty");
            }

            JSONObject payload = new JSONObject(raw);
            String sourcePackage = payload.optString("sourcePackage", "");
            if (!peerPackageName().equals(sourcePackage)) {
                throw new SecurityException("Unexpected migration source: " + sourcePackage);
            }

            JSONObject importedPrefs = payload.optJSONObject("preferences");
            SharedPreferences.Editor editor = preferences.edit();
            int importedSettings = 0;
            if (importedPrefs != null) {
                Iterator<String> keys = importedPrefs.keys();
                while (keys.hasNext()) {
                    String key = keys.next();
                    Object value = importedPrefs.opt(key);
                    if (value instanceof Boolean) {
                        editor.putBoolean(key, (Boolean) value);
                        importedSettings++;
                    } else if (value instanceof Number) {
                        editor.putLong(key, ((Number) value).longValue());
                        importedSettings++;
                    } else if (value instanceof String) {
                        editor.putString(key, (String) value);
                        importedSettings++;
                    }
                }
            }
            editor.apply();

            int importedOperators = OperatorBackupStore.importJson(
                    this, payload.optString("operatorBackups", "{}"));

            Toast.makeText(
                    this,
                    "Imported " + importedSettings + " app setting"
                            + (importedSettings == 1 ? "" : "s")
                            + " and " + importedOperators + " operator backup"
                            + (importedOperators == 1 ? "" : "s")
                            + " from " + peerAppLabel() + ".",
                    Toast.LENGTH_LONG).show();

            updateOperatorBackupStatus();
            recreate();
        } catch (SecurityException denied) {
            Log.w(TAG, "Peer app import was denied", denied);
            Toast.makeText(this,
                    "Could not import from " + peerAppLabel()
                            + ". Update both app versions, then try again.",
                    Toast.LENGTH_LONG).show();
        } catch (Throwable error) {
            Log.e(TAG, "Could not import peer app data", error);
            Toast.makeText(this,
                    "Import failed. Open " + peerAppLabel()
                            + " once, then return here and retry.",
                    Toast.LENGTH_LONG).show();
        } finally {
            if (cursor != null) cursor.close();
            updatePeerImportUi();
        }
    }

    private void showOperatorPicker() {
        if (preferences == null) return;

        String[] names = OperatorBackupStore.operatorNames(this);
        if (names.length == 0) {
            Toast.makeText(this,
                    "No imported operators yet. Use an operator on DMZRanked.com, then refresh the list.",
                    Toast.LENGTH_LONG).show();
            return;
        }

        String current = preferences.getString(PREF_SELECTED_OPERATOR, "");
        current = current == null ? "" : current.trim();
        int checked = -1;
        for (int i = 0; i < names.length; i++) {
            if (names[i].equalsIgnoreCase(current)) {
                checked = i;
                break;
            }
        }

        DmzDialog.singleChoice(
                this,
                "CHOOSE OPERATOR",
                "Select the operator profile this app should use on DMZ Ranked.",
                names,
                checked,
                "CANCEL",
                (which, selected) -> {
                    if (which < 0 || which >= names.length) return;

                    JSONObject backup = OperatorBackupStore.get(this, selected);
                    boolean protectedFlag = OperatorBackupStore.isProtected(backup);

                    preferences.edit()
                            .putString(PREF_SELECTED_OPERATOR, selected)
                            .putBoolean(PREF_OPERATOR_VERIFIED, false)
                            .putBoolean(PREF_OPERATOR_PROTECTED, protectedFlag)
                            .putString(PREF_OPERATOR_SOURCE, "App operator picker")
                            .putLong(PREF_OPERATOR_SYNC_MS, System.currentTimeMillis())
                            .apply();
                    DmzRankedWidgetProvider.requestUpdateAll(this);

                    Intent result = new Intent()
                            .putExtra(EXTRA_ACTION, ACTION_SELECT_OPERATOR)
                            .putExtra(EXTRA_OPERATOR_NAME, selected);
                    setResult(RESULT_OK, result);

                    Toast.makeText(this,
                            "Selected " + selected + ". Applying it to DMZ Ranked…",
                            Toast.LENGTH_SHORT).show();
                    finish();
                });
    }

    private void updateOperatorBackupStatus() {
        TextView status = findViewById(R.id.operatorStatusText);
        TextView list = findViewById(R.id.operatorListText);
        TextView count = findViewById(R.id.operatorCountText);
        TextView active = findViewById(R.id.operatorActiveBadge);
        TextView backupSummary = findViewById(R.id.operatorBackupSummaryText);
        if (status == null || preferences == null) return;

        String selected = preferences.getString(PREF_SELECTED_OPERATOR, "");
        selected = selected == null ? "" : selected.trim();
        boolean verified = preferences.getBoolean(PREF_OPERATOR_VERIFIED, false);
        boolean protectedFlag = preferences.getBoolean(PREF_OPERATOR_PROTECTED, false);

        JSONObject selectedBackup = OperatorBackupStore.get(this, selected);
        JSONObject latestBackup = selectedBackup != null
                ? selectedBackup
                : OperatorBackupStore.latest(this);

        if (selected.isEmpty()) {
            status.setText("No operator detected\nOpen DMZRanked.com and select an operator.");
            status.setTextColor(getColor(R.color.dmz_muted));
            if (active != null) {
                active.setText("○ Not detected");
                active.setTextColor(getColor(R.color.dmz_muted));
            }
        } else {
            StringBuilder current = new StringBuilder();
            current.append(selected);
            current.append("\n");
            current.append(verified ? "✓ Verified on this device" : "Detected from website selection");
            current.append(protectedFlag ? "  •  PIN protected" : "  •  No PIN detected");
            if (selectedBackup != null) {
                current.append("  •  ")
                        .append(OperatorBackupStore.entryCount(selectedBackup))
                        .append(" entries");
            }
            status.setText(current.toString());
            status.setTextColor(getColor(R.color.dmz_green));
            if (active != null) {
                active.setText("● Active on DMZRanked.com");
                active.setTextColor(getColor(R.color.dmz_green));
            }
        }

        String[] names = OperatorBackupStore.operatorNames(this);
        if (count != null) count.setText(names.length + " / 2 imported");

        TextView picker = findViewById(R.id.operatorPickerCard);
        if (picker != null) {
            boolean available = names.length > 0;
            picker.setEnabled(available);
            picker.setAlpha(available ? 1f : 0.45f);
            picker.setText(available
                    ? "▾  CHOOSE OPERATOR"
                    : "▾  NO OPERATORS TO CHOOSE");
        }
        if (list != null) {
            list.setClickable(names.length > 0);
            list.setFocusable(names.length > 0);
            if (names.length == 0) {
                list.setText("No imported operators yet.");
                list.setTextColor(getColor(R.color.dmz_muted));
            } else {
                StringBuilder imported = new StringBuilder();
                for (int i = 0; i < names.length; i++) {
                    if (i > 0) imported.append("\n\n");
                    String name = names[i];
                    boolean current = !selected.isEmpty() && selected.equalsIgnoreCase(name);
                    imported.append(current ? "◉  " : "○  ").append(name);
                    JSONObject row = OperatorBackupStore.get(this, name);
                    if (current) imported.append("\n    ● Current");
                    if (row != null) {
                        imported.append(current ? "  •  " : "\n    ")
                                .append("Saved on this device");
                    }
                }
                list.setText(imported.toString());
                list.setTextColor(getColor(R.color.dmz_white));
            }
        }

        if (backupSummary != null) {
            if (latestBackup == null) {
                backupSummary.setText("No local operator backup yet.");
            } else {
                long savedAt = OperatorBackupStore.savedAt(latestBackup);
                String when = savedAt <= 0L
                        ? "Unknown time"
                        : DateFormat.getDateTimeInstance(DateFormat.MEDIUM, DateFormat.SHORT)
                                .format(new Date(savedAt));
                backupSummary.setText("Last backup: " + when
                        + "  •  " + OperatorBackupStore.entryCount(latestBackup) + " entries");
            }
        }
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

        NotificationManager manager =
                (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        boolean headsUpEnabled = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && manager != null) {
            NotificationChannel channel = manager.getNotificationChannel(SITE_NOTIFICATION_CHANNEL);
            headsUpEnabled = channel == null
                    || channel.getImportance() >= NotificationManager.IMPORTANCE_HIGH;
        }

        if(isRankedHubBuild() && enabled && permissionGranted){
            HubNotificationChannels.ensure(this);
            status.setText("Channels: MW4 DMZ, ARC Raiders, DMZRanked.com, Ranked Hub App."
                    +"\nCommunity background checks are supported. First-party website alerts"
                    +" require a supported site event while the site is open.");
            status.setTextColor(getColor(R.color.dmz_green));
            return;
        }
        if (!enabled) {
            status.setText("Website notifications are off");
            status.setTextColor(getColor(R.color.dmz_muted));
        } else if (!permissionGranted) {
            status.setText("Permission needed • tap Android notification settings");
            status.setTextColor(getColor(R.color.dmz_gold));
        } else if (!headsUpEnabled) {
            status.setText("Enabled • pop-up alerts disabled by Android");
            status.setTextColor(getColor(R.color.dmz_gold));
        } else {
            String syncResult = preferences == null
                    ? ""
                    : preferences.getString(NotificationSync.PREF_LAST_SYNC_RESULT, "");
            long syncMs = preferences == null
                    ? 0L
                    : preferences.getLong(NotificationSync.PREF_LAST_SYNC_MS, 0L);
            String syncText = syncResult == null || syncResult.trim().isEmpty()
                    ? "waiting for first background check"
                    : syncResult.trim();
            if (syncMs > 0L) {
                long ageMinutes = Math.max(0L, (System.currentTimeMillis() - syncMs) / 60000L);
                syncText += ageMinutes == 0L ? " • just now" : " • " + ageMinutes + "m ago";
            }
            status.setText("Enabled • live in-app alerts + Play-safe background checks\nBackground: " + syncText);
            status.setTextColor(syncResult != null && syncResult.startsWith("ERROR")
                    ? getColor(R.color.dmz_gold)
                    : getColor(R.color.dmz_green));
        }
    }

    private void ensureNotificationChannel() {
        if(isRankedHubBuild()){
            HubNotificationChannels.ensure(this);
            return;
        }
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;
        NotificationChannel channel = new NotificationChannel(
                SITE_NOTIFICATION_CHANNEL,
                "DMZ Ranked pop-up alerts",
                NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("Heads-up reports, reviews, approvals, system, update, website, season, and test alerts.");
        channel.enableVibration(true);
        channel.setVibrationPattern(new long[]{0L, 180L, 90L, 220L});
        channel.enableLights(true);
        channel.setShowBadge(true);
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        manager.createNotificationChannel(channel);
    }

    private void postTestNotification() {
        if(isRankedHubBuild()){
            HubNotificationChannels.notifyApp(this,"App test notification",
                    "Ranked Hub notifications are working.","test:"+System.currentTimeMillis());
            Toast.makeText(this,"Sent to Ranked Hub App channel.",Toast.LENGTH_SHORT).show();
            return;
        }
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

        builder.setSmallIcon(R.drawable.ic_notification_dmz)
                .setContentTitle("DMZ Ranked")
                .setContentText("[System] Test notification • Heads-up notifications are working.")
                .setStyle(new Notification.BigTextStyle()
                        .bigText("[System] Test notification\nHeads-up notifications are working on this device. This is a local app test."))
                .setContentIntent(pendingIntent)
                .setAutoCancel(true)
                .setOnlyAlertOnce(false)
                .setColor(getColor(R.color.dmz_gold))
                .setCategory(Notification.CATEGORY_EVENT)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setPriority(Notification.PRIORITY_HIGH)
                .setDefaults(Notification.DEFAULT_ALL);

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
            if(isRankedHubBuild()){
                HubNotificationChannels.ensure(this);
                startActivity(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                        .putExtra(Settings.EXTRA_APP_PACKAGE,getPackageName()));
                return;
            }
            Intent intent;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                intent = new Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS)
                        .putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName())
                        .putExtra(Settings.EXTRA_CHANNEL_ID, SITE_NOTIFICATION_CHANNEL);
            } else {
                intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                        .putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName());
            }
            startActivity(intent);
        } catch (Throwable error) {
            Toast.makeText(this, "Could not open Android notification settings.", Toast.LENGTH_SHORT).show();
        }
    }

    private void startLivePlayUpdateMonitoring() {
        livePlayUpdateMonitoring = true;
        if (playUpdateHandler != null && playUpdatePoller != null) {
            playUpdateHandler.removeCallbacks(playUpdatePoller);
        }
        checkForPlayUpdate(false);
        if (playUpdateHandler != null && playUpdatePoller != null) {
            playUpdateHandler.postDelayed(playUpdatePoller, LIVE_PLAY_UPDATE_POLL_MS);
        }
    }

    private void stopLivePlayUpdateMonitoring() {
        livePlayUpdateMonitoring = false;
        if (playUpdateHandler != null && playUpdatePoller != null) {
            playUpdateHandler.removeCallbacks(playUpdatePoller);
        }
    }

    private String liveUpdateCheckLabel() {
        if (lastPlayUpdateCheckAt <= 0L) return "Live monitoring";
        String time = DateFormat.getTimeInstance(DateFormat.SHORT)
                .format(new Date(lastPlayUpdateCheckAt));
        return "Live • checked " + time;
    }

    private void checkForPlayUpdate(boolean userRequested) {
        TextView status = findViewById(R.id.updateVersionText);
        if (appUpdateManager == null) {
            if (status != null) {
                status.setText("Google Play update service is unavailable • Open Google Play.");
            }
            if (userRequested) openPlayStore();
            return;
        }

        if (playUpdateCheckInFlight) {
            if (userRequested) {
                Toast.makeText(this, "A Google Play update check is already running.",
                        Toast.LENGTH_SHORT).show();
            }
            return;
        }

        playUpdateCheckInFlight = true;
        if (status != null && userRequested) {
            status.setText(installedVersionLabel() + " • Checking Google Play now…");
        }

        appUpdateManager.getAppUpdateInfo()
                .addOnSuccessListener(info -> {
                    playUpdateCheckInFlight = false;
                    lastPlayUpdateCheckAt = System.currentTimeMillis();
                    handlePlayUpdateInfo(info, userRequested);
                })
                .addOnFailureListener(error -> {
                    playUpdateCheckInFlight = false;
                    lastPlayUpdateCheckAt = System.currentTimeMillis();
                    Log.w(TAG, "Google Play update check failed", error);
                    if (status != null) {
                        status.setText(installedVersionLabel()
                                + " • Play check unavailable • " + liveUpdateCheckLabel());
                    }
                    if (userRequested) {
                        Toast.makeText(this,
                                "Could not check in-app. Opening Google Play instead.",
                                Toast.LENGTH_SHORT).show();
                        openPlayStore();
                    }
                });
    }

    private void handlePlayUpdateInfo(AppUpdateInfo info, boolean userRequested) {
        TextView status = findViewById(R.id.updateVersionText);
        if (info == null) {
            if (status != null) status.setText(installedVersionLabel() + " • Update status unavailable.");
            if (userRequested) openPlayStore();
            return;
        }

        if (info.installStatus() == InstallStatus.DOWNLOADED) {
            if (status != null) {
                status.setText("Update downloaded from Google Play • Ready to install.");
            }
            showCompleteUpdateDialog();
            return;
        }

        int availability = info.updateAvailability();
        if (availability == UpdateAvailability.UPDATE_AVAILABLE) {
            long availableBuild = info.availableVersionCode();
            if (status != null) {
                status.setText("Update available • Build "
                        + availableBuild + " • " + liveUpdateCheckLabel()
                        + " • Tap CHECK to update.");
            }

            if (userRequested) {
                startFlexiblePlayUpdate(info);
            } else if (availableBuild != lastAnnouncedUpdateBuild) {
                lastAnnouncedUpdateBuild = availableBuild;
                NotificationSync.postNotification(
                        this,
                        "[System] Update available",
                        "Google Play has DMZ Ranked build " + availableBuild + " ready to install.",
                        "play-update:" + availableBuild);
                Toast.makeText(this,
                        "Google Play update available • Build " + availableBuild + ".",
                        Toast.LENGTH_LONG).show();
            }
            return;
        }

        if (availability == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS) {
            if (status != null) {
                status.setText("Google Play update in progress • " + liveUpdateCheckLabel());
            }
            return;
        }

        if (availability == UpdateAvailability.UPDATE_NOT_AVAILABLE) {
            if (status != null) {
                status.setText("Up to date • " + installedVersionLabel()
                        + " • " + liveUpdateCheckLabel());
            }
            if (userRequested) {
                Toast.makeText(this, "DMZ Ranked is up to date.", Toast.LENGTH_SHORT).show();
            }
            return;
        }

        if (status != null) {
            status.setText(installedVersionLabel()
                    + " • Google Play could not determine update availability • "
                    + liveUpdateCheckLabel());
        }
        if (userRequested) {
            Toast.makeText(this,
                    "Update status is unavailable. Opening Google Play.",
                    Toast.LENGTH_SHORT).show();
            openPlayStore();
        }
    }

    private void startFlexiblePlayUpdate(AppUpdateInfo info) {
        if (appUpdateManager == null || info == null) return;

        AppUpdateOptions options = AppUpdateOptions.newBuilder(AppUpdateType.FLEXIBLE).build();
        if (!info.isUpdateTypeAllowed(options)) {
            Toast.makeText(this,
                    "In-app update is not available for this release. Opening Google Play.",
                    Toast.LENGTH_LONG).show();
            openPlayStore();
            return;
        }

        try {
            boolean started = appUpdateManager.startUpdateFlowForResult(
                    info,
                    this,
                    options,
                    PLAY_UPDATE_REQUEST);
            if (!started) {
                Toast.makeText(this,
                        "Google Play could not start the update. Opening the Play Store.",
                        Toast.LENGTH_LONG).show();
                openPlayStore();
            }
        } catch (Throwable error) {
            Log.e(TAG, "Could not start Google Play update flow", error);
            Toast.makeText(this,
                    "Could not start the in-app update. Opening Google Play.",
                    Toast.LENGTH_LONG).show();
            openPlayStore();
        }
    }

    private void handlePlayInstallState(int installStatus, long bytesDownloaded, long totalBytes) {
        TextView status = findViewById(R.id.updateVersionText);
        if (status == null) return;

        if (installStatus == InstallStatus.DOWNLOADING) {
            if (totalBytes > 0L) {
                long percent = Math.min(100L, Math.max(0L, (bytesDownloaded * 100L) / totalBytes));
                status.setText("Downloading update from Google Play… " + percent + "%");
            } else {
                status.setText("Downloading update from Google Play…");
            }
        } else if (installStatus == InstallStatus.DOWNLOADED) {
            status.setText("Update downloaded from Google Play • Ready to install.");
            showCompleteUpdateDialog();
        } else if (installStatus == InstallStatus.INSTALLING) {
            status.setText("Installing Google Play update…");
        } else if (installStatus == InstallStatus.INSTALLED) {
            status.setText("Update installed • refreshing Google Play status…");
            if (playUpdateHandler != null) {
                playUpdateHandler.postDelayed(() -> checkForPlayUpdate(false), 1200L);
            }
        } else if (installStatus == InstallStatus.FAILED) {
            status.setText("Google Play update failed • Tap CHECK to retry.");
        } else if (installStatus == InstallStatus.CANCELED) {
            status.setText("Update canceled • Tap CHECK to retry.");
        } else if (installStatus == InstallStatus.PENDING) {
            status.setText("Preparing Google Play update…");
        }
    }

    private void showCompleteUpdateDialog() {
        if (appUpdateManager == null || updateReadyDialogShown || isFinishing()) return;
        updateReadyDialogShown = true;

        AlertDialog dialog = DmzDialog.confirm(
                this,
                "UPDATE READY",
                "Google Play finished downloading the DMZ Ranked update. Install it now and restart the app?",
                "INSTALL & RESTART",
                "LATER",
                false,
                () -> {
                    TextView status = findViewById(R.id.updateVersionText);
                    if (status != null) status.setText("Installing Google Play update…");
                    appUpdateManager.completeUpdate()
                            .addOnFailureListener(error -> {
                                Log.e(TAG, "Could not complete Google Play update", error);
                                Toast.makeText(this,
                                        "Could not install the update. Tap CHECK to retry.",
                                        Toast.LENGTH_LONG).show();
                                if (status != null) {
                                    status.setText("Install failed • Tap CHECK to retry.");
                                }
                            });
                });

        dialog.setOnDismissListener(ignored -> updateReadyDialogShown = false);
    }

    private String installedVersionLabel() {
        PackageInfo packageInfo = getPackageInfoSafe();
        if (packageInfo == null) return "Installed version unknown";

        String versionName = packageInfo.versionName == null ? "Unknown" : packageInfo.versionName;
        long versionCode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                ? packageInfo.getLongVersionCode()
                : packageInfo.versionCode;
        return "Installed " + versionName + " (" + versionCode + ")";
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if(requestCode == EXPORT_RANKED_BACKUP_REQUEST
                ||requestCode == IMPORT_RANKED_BACKUP_REQUEST){
            handleRankedBackup(requestCode,resultCode,data);
            return;
        }
        if (requestCode != PLAY_UPDATE_REQUEST) return;

        if (resultCode == RESULT_OK) {
            TextView status = findViewById(R.id.updateVersionText);
            if (status != null) {
                status.setText("Google Play accepted the update • Downloading live…");
            }
            if (playUpdateHandler != null) {
                playUpdateHandler.postDelayed(() -> checkForPlayUpdate(false), 1200L);
            }
        } else {
            TextView status = findViewById(R.id.updateVersionText);
            if (status != null) {
                status.setText("Update canceled or could not start • Tap CHECK to retry.");
            }
        }
    }

    private void openPlayStore() {
        try {
            Intent market = new Intent(Intent.ACTION_VIEW,
                    Uri.parse(PLAY_STORE_MARKET_PREFIX + getPackageName()));
            market.setPackage("com.android.vending");
            startActivity(market);
        } catch (Throwable ignored) {
            openExternal(PLAY_STORE_HTTPS_PREFIX + getPackageName());
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
        showDangerConfirmation(
                "CLEAR WEBSITE DATA",
                "This removes WebView cache, cookies, and website storage. You may be signed out of DMZ Ranked. App-managed operator backups are kept.",
                "CLEAR DATA",
                this::clearWebData);
    }

    private void clearWebData() {
        try {
            WebView tempWebView = new WebView(this);
            tempWebView.clearCache(true);
            tempWebView.clearHistory();
            tempWebView.destroy();

            WebStorage.getInstance().deleteAllData();
            preferences.edit()
                    .remove(PREF_LAST_PAGE_URL)
                    .remove(PREF_SELECTED_OPERATOR)
                    .remove(PREF_OPERATOR_VERIFIED)
                    .remove(PREF_OPERATOR_PROTECTED)
                    .remove(PREF_OPERATOR_SOURCE)
                    .remove(PREF_OPERATOR_SYNC_MS)
                    .apply();

            CookieManager.getInstance().removeAllCookies(value -> runOnUiThread(() -> {
                CookieManager.getInstance().flush();
                Toast.makeText(SettingsActivity.this,
                        "Website data cleared. App operator backups were kept.",
                        Toast.LENGTH_SHORT).show();
            }));
        } catch (Throwable error) {
            Log.e(TAG, "Could not clear web data", error);
            Toast.makeText(this, "Could not clear website data.", Toast.LENGTH_LONG).show();
        }
    }

    private void confirmResetSettings() {
        showDangerConfirmation(
                "RESET APP SETTINGS",
                "This restores Android app settings to their defaults. Website cookies, site storage, and saved operator backups are not deleted.",
                "RESET SETTINGS",
                () -> {
                    preferences.edit().clear().apply();
                    Toast.makeText(this, "App settings reset to defaults.", Toast.LENGTH_SHORT).show();
                    recreate();
                });
    }

    private void showDangerConfirmation(
            String title,
            String message,
            String confirmLabel,
            Runnable action) {
        DmzDialog.confirm(
                this,
                title,
                message,
                confirmLabel,
                "CANCEL",
                true,
                action);
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
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
                + "Verbose startup and loading: " + onOff(PREF_VERBOSE_LOADING, isRankedHubBuild()) + "\n"
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


    private void installRankedSettingsHeader() {
        View oldBar = findViewById(R.id.titleBar);
        if (oldBar != null) oldBar.setVisibility(View.GONE);
        FrameLayout slot = findViewById(R.id.settingsHeaderSlot);
        if (slot == null) return;
        slot.setVisibility(View.VISIBLE);
        // The XML slot height is only a fallback; match Android/system
        // compact sizing and the in-app Content Size setting on creation.
        android.view.ViewGroup.LayoutParams headerParams = slot.getLayoutParams();
        headerParams.height = Math.round(RankedHeaderView.heightDp(this)
                * getResources().getDisplayMetrics().density);
        slot.setLayoutParams(headerParams);
        settingsHeader = RankedHeaderView.createSettings(this, launcherTheme, this::handleSettingsBack);
        slot.addView(settingsHeader, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));
        TextView scope = findViewById(R.id.settingsScopeText);
        if (scope != null) scope.setText(
                RankedSettingsStyler.pageTitleFor(launcherTheme) + " / SYSTEM CONFIGURATION");
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
