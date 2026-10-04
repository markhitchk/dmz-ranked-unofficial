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
import android.os.SystemClock;
import android.provider.Settings;
import android.text.Editable;
import android.text.InputFilter;
import android.text.InputType;
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
import java.util.Locale;

import org.json.JSONObject;

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
    private static final String PREF_SELECTED_OPERATOR = "website_selected_operator";
    private static final String PREF_OPERATOR_VERIFIED = "website_operator_verified";
    private static final String PREF_OPERATOR_PROTECTED = "website_operator_protected";
    private static final String PREF_OPERATOR_SOURCE = "website_operator_source";
    private static final String PREF_OPERATOR_SYNC_MS = "website_operator_sync_ms";
    private static final String PREF_OPERATOR_AUTOSAVE = "operator_auto_save";

    private static final String SITE_NOTIFICATION_CHANNEL = "dmz_site_notifications";
    private static final int NOTIFICATION_PERMISSION_REQUEST = 2004;
    private static final int PLAY_UPDATE_REQUEST = 2005;

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

    public static final String EXTRA_ACTION = "settings_action";
    public static final String ACTION_RELOAD = "reload";
    public static final String ACTION_SAVE_OPERATOR = "save_operator";
    public static final String ACTION_RESTORE_OPERATOR = "restore_operator";

    private SharedPreferences preferences;
    private AppUpdateManager appUpdateManager;
    private InstallStateUpdatedListener installStateUpdatedListener;
    private boolean updateReadyDialogShown;
    private boolean pendingTestNotification;
    private boolean creditsExpanded;
    private boolean developerUnlocked;
    private int developerTapCount;
    private long developerTapWindowStartedAt;
    private int developerPinFailures;
    private long developerPinLockoutUntil;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        preferences = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        setContentView(R.layout.activity_settings);
        configureSystemBars();

        appUpdateManager = AppUpdateManagerFactory.create(this);
        installStateUpdatedListener = state -> runOnUiThread(() ->
                handlePlayInstallState(
                        state.installStatus(),
                        state.bytesDownloaded(),
                        state.totalBytesToDownload()));

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
                + " • Checking Google Play…");

        Switch desktopSite = findViewById(R.id.desktopSiteSwitch);
        Switch keepAwake = findViewById(R.id.keepAwakeSwitch);
        Switch pullRefresh = findViewById(R.id.pullRefreshSwitch);
        Switch rememberLastPage = findViewById(R.id.rememberLastPageSwitch);
        Switch verboseLoading = findViewById(R.id.verboseLoadingSwitch);
        Switch siteNotifications = findViewById(R.id.siteNotificationsSwitch);
        Switch operatorAutoSave = findViewById(R.id.operatorAutoSaveSwitch);
        Switch webviewDebug = findViewById(R.id.webviewDebugSwitch);

        desktopSite.setChecked(preferences.getBoolean(PREF_DESKTOP, false));
        keepAwake.setChecked(preferences.getBoolean(PREF_KEEP_AWAKE, false));
        pullRefresh.setChecked(preferences.getBoolean(PREF_PULL_REFRESH, true));
        rememberLastPage.setChecked(preferences.getBoolean(PREF_REMEMBER_LAST_PAGE, true));
        verboseLoading.setChecked(preferences.getBoolean(PREF_VERBOSE_LOADING, false));
        siteNotifications.setChecked(preferences.getBoolean(PREF_SITE_NOTIFICATIONS, true));
        operatorAutoSave.setChecked(preferences.getBoolean(PREF_OPERATOR_AUTOSAVE, true));
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
        operatorAutoSave.setOnCheckedChangeListener((buttonView, checked) ->
                preferences.edit().putBoolean(PREF_OPERATOR_AUTOSAVE, checked).apply());
        webviewDebug.setOnCheckedChangeListener((buttonView, checked) ->
                preferences.edit().putBoolean(PREF_WEBVIEW_DEBUG, checked).apply());

        bindToggleCard(R.id.desktopSiteCard, desktopSite);
        bindToggleCard(R.id.keepAwakeCard, keepAwake);
        bindToggleCard(R.id.pullRefreshCard, pullRefresh);
        bindToggleCard(R.id.rememberLastPageCard, rememberLastPage);
        bindToggleCard(R.id.verboseLoadingCard, verboseLoading);
        bindToggleCard(R.id.siteNotificationsCard, siteNotifications);
        bindToggleCard(R.id.operatorAutoSaveCard, operatorAutoSave);
        bindToggleCard(R.id.webviewDebugCard, webviewDebug);

        findViewById(R.id.backButton).setOnClickListener(v -> finish());
        findViewById(R.id.creditsButton).setOnClickListener(v -> toggleCredits());
        findViewById(R.id.developerUnlockTrigger).setOnClickListener(v -> handleDeveloperUnlockTap());
        findViewById(R.id.reloadCard).setOnClickListener(v -> {
            setResult(RESULT_OK, new Intent().putExtra(EXTRA_ACTION, ACTION_RELOAD));
            finish();
        });
        findViewById(R.id.clearCacheCard).setOnClickListener(v -> clearWebCacheOnly());
        findViewById(R.id.clearDataCard).setOnClickListener(v -> confirmClearWebData());
        findViewById(R.id.saveOperatorCard).setOnClickListener(v -> {
            setResult(RESULT_OK, new Intent().putExtra(EXTRA_ACTION, ACTION_SAVE_OPERATOR));
            finish();
        });
        findViewById(R.id.restoreOperatorCard).setOnClickListener(v -> {
            setResult(RESULT_OK, new Intent().putExtra(EXTRA_ACTION, ACTION_RESTORE_OPERATOR));
            finish();
        });
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
        updateOperatorBackupStatus();
        setDeveloperSectionVisible(false);
        loadRemoteAvatar(YOLANDO_AVATAR_URL, findViewById(R.id.yolandoAvatar));
        loadRemoteAvatar(DCHINZ_AVATAR_URL, findViewById(R.id.dchinzAvatar));
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
        updateNotificationStatus();
        updateOperatorBackupStatus();
        checkForPlayUpdate(false);
        if (developerUnlocked) updateDiagnosticsSummary();
    }

    @Override
    protected void onStop() {
        if (appUpdateManager != null && installStateUpdatedListener != null) {
            appUpdateManager.unregisterListener(installStateUpdatedListener);
        }
        super.onStop();
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

        EditText pinInput = new EditText(this);
        pinInput.setSingleLine(true);
        pinInput.setHint("Developer PIN");
        pinInput.setInputType(InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_VARIATION_PASSWORD);
        pinInput.setFilters(new InputFilter[]{new InputFilter.LengthFilter(4)});
        int horizontalPadding = Math.round(24 * getResources().getDisplayMetrics().density);
        pinInput.setPadding(horizontalPadding, pinInput.getPaddingTop(),
                horizontalPadding, pinInput.getPaddingBottom());

        AlertDialog dialog = new AlertDialog.Builder(this)
                .setTitle("Developer access")
                .setMessage("Enter the 4-digit developer PIN.")
                .setView(pinInput)
                .setNegativeButton("Cancel", null)
                .setPositiveButton("Unlock", null)
                .create();

        dialog.setOnShowListener(ignored -> dialog.getButton(AlertDialog.BUTTON_POSITIVE)
                .setOnClickListener(v -> {
                    String entered = pinInput.getText() == null
                            ? ""
                            : pinInput.getText().toString();
                    if (verifyDeveloperPin(entered)) {
                        developerPinFailures = 0;
                        developerPinLockoutUntil = 0L;
                        developerUnlocked = true;
                        setDeveloperSectionVisible(true);
                        updateDiagnosticsSummary();
                        EditText search = findViewById(R.id.settingsSearch);
                        if (search != null) applySearch(search.getText().toString());
                        Toast.makeText(this, "Developer tools unlocked.", Toast.LENGTH_SHORT).show();
                        dialog.dismiss();
                        return;
                    }

                    developerPinFailures++;
                    pinInput.setText("");
                    pinInput.setError("Incorrect developer PIN");

                    if (developerPinFailures >= DEV_MAX_PIN_ATTEMPTS) {
                        developerPinFailures = 0;
                        developerPinLockoutUntil =
                                SystemClock.elapsedRealtime() + DEV_PIN_LOCKOUT_MS;
                        dialog.dismiss();
                        Toast.makeText(this,
                                "Too many incorrect PIN attempts. Developer access locked for 30 seconds.",
                                Toast.LENGTH_LONG).show();
                    }
                }));
        dialog.show();
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

        boolean operatorMatch =
                showIfMatches(R.id.operatorStatusCard, q,
                        "operator website account profile saved backup current dmz ranked")
                | showIfMatches(R.id.operatorAutoSaveCard, q,
                        "operator auto save backup local restore website data")
                | showIfMatches(R.id.saveOperatorCard, q,
                        "operator save now backup local website data")
                | showIfMatches(R.id.restoreOperatorCard, q,
                        "operator restore recover backup local website data");
        findViewById(R.id.operatorBackupSection).setVisibility(operatorMatch ? View.VISIBLE : View.GONE);

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
                        "clear cache webview temporary files");
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

        boolean any = aboutMatch || appMatch || operatorMatch || notificationMatch || updateMatch
                || actionMatch || helpMatch || dangerMatch || developerMatch;
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


    private void updateOperatorBackupStatus() {
        TextView target = findViewById(R.id.operatorStatusText);
        if (target == null || preferences == null) return;

        String selected = preferences.getString(PREF_SELECTED_OPERATOR, "");
        JSONObject backup = OperatorBackupStore.get(this, selected);
        if (backup == null) backup = OperatorBackupStore.latest(this);

        int backupCount = OperatorBackupStore.backupCount(this);
        if (backup == null) {
            String current = selected == null || selected.trim().isEmpty()
                    ? "No website operator detected yet"
                    : "Current website operator: " + selected.trim();
            target.setText(current
                    + "\nNo app backup yet • " + backupCount + " saved operator"
                    + (backupCount == 1 ? "" : "s"));
            target.setTextColor(getColor(R.color.dmz_muted));
            return;
        }

        String backedUpOperator = OperatorBackupStore.operatorName(backup);
        long savedAt = OperatorBackupStore.savedAt(backup);
        int entries = OperatorBackupStore.entryCount(backup);
        String when = savedAt <= 0L
                ? "unknown time"
                : DateFormat.getDateTimeInstance(DateFormat.MEDIUM, DateFormat.SHORT)
                        .format(new Date(savedAt));
        String current = selected == null || selected.trim().isEmpty()
                ? "Website operator not currently detected"
                : "Current website operator: " + selected.trim();

        String protection = OperatorBackupStore.isProtected(backup)
                ? " • PIN protected"
                : " • No PIN detected";
        target.setText(current
                + "\nLatest app backup: " + backedUpOperator
                + protection
                + " • " + entries + " entries • " + when
                + "\nSaved operators: " + backupCount);
        target.setTextColor(getColor(R.color.dmz_green));
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

    private void checkForPlayUpdate(boolean userRequested) {
        TextView status = findViewById(R.id.updateVersionText);
        if (appUpdateManager == null) {
            if (status != null) {
                status.setText("Google Play update service is unavailable • Open Google Play.");
            }
            if (userRequested) openPlayStore();
            return;
        }

        if (status != null) {
            status.setText(installedVersionLabel() + " • Checking Google Play…");
        }

        appUpdateManager.getAppUpdateInfo()
                .addOnSuccessListener(info -> handlePlayUpdateInfo(info, userRequested))
                .addOnFailureListener(error -> {
                    Log.w(TAG, "Google Play update check failed", error);
                    if (status != null) {
                        status.setText(installedVersionLabel()
                                + " • Google Play check unavailable on this install.");
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
                status.setText("Update available on Google Play • Build "
                        + availableBuild + " • Tap CHECK to update.");
            }

            if (userRequested) {
                startFlexiblePlayUpdate(info);
            }
            return;
        }

        if (availability == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS) {
            if (status != null) {
                status.setText("A Google Play update is already in progress.");
            }
            return;
        }

        if (availability == UpdateAvailability.UPDATE_NOT_AVAILABLE) {
            if (status != null) {
                status.setText("Up to date • " + installedVersionLabel());
            }
            if (userRequested) {
                Toast.makeText(this, "DMZ Ranked is up to date.", Toast.LENGTH_SHORT).show();
            }
            return;
        }

        if (status != null) {
            status.setText(installedVersionLabel()
                    + " • Google Play could not determine update availability.");
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
            status.setText("Update installed.");
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

        AlertDialog dialog = new AlertDialog.Builder(this)
                .setTitle("Update ready")
                .setMessage("Google Play finished downloading the DMZ Ranked update. Install it now and restart the app?")
                .setNegativeButton("Later", null)
                .setPositiveButton("Install & restart", (d, which) -> {
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
                })
                .create();

        dialog.setOnDismissListener(ignored -> updateReadyDialogShown = false);
        dialog.show();
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
        if (requestCode != PLAY_UPDATE_REQUEST) return;

        if (resultCode == RESULT_OK) {
            TextView status = findViewById(R.id.updateVersionText);
            if (status != null) {
                status.setText("Google Play accepted the update • Downloading…");
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
                .setMessage("This clears WebView cache, cookies, and site storage. You may be signed out of DMZ Ranked. App-managed operator backups are kept so they can be restored afterward.")
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
        new AlertDialog.Builder(this)
                .setTitle("Reset app settings?")
                .setMessage("This restores Android app settings to defaults. Website cookies, site storage, and saved operator backups are not deleted.")
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
