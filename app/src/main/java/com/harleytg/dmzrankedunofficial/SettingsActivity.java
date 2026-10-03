package com.harleytg.dmzrankedunofficial;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.WebStorage;
import android.webkit.WebView;
import android.widget.ImageView;
import android.widget.Switch;
import android.widget.TextView;
import android.widget.Toast;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class SettingsActivity extends Activity {
    private static final String TAG = "DMZRankedSettings";
    private static final String PAYPAL_SHARE_URL = "https://share.google/9nj1GcaYNu3qJTTeu";
    private static final String APP_SUPPORT_DISCORD_URL = "https://discord.gg/kdHneTZkyd";
    private static final String MAIN_DISCORD_URL = "https://discord.gg/jTaTHqw45F";
    private static final String BETA_GROUP_URL = "https://groups.google.com/g/dmz-ranked";
    private static final String YOLANDO_AVATAR_URL = "https://cdn.discordapp.com/avatars/645842556898377728/b2c3a2a0001bc2d946ae52aeaa9abe1c.webp?size=3072";
    private static final String DCHINZ_AVATAR_URL = "https://cdn.discordapp.com/avatars/364411414787653642/71fc7b2b2cae4b81c38ad148aed61df3.webp?size=3072";

    private static final String PREFS = "dmz_ranked_settings";
    private static final String PREF_DESKTOP = "desktop_site";
    private static final String PREF_KEEP_AWAKE = "keep_awake";
    private static final String PREF_VERBOSE_LOADING = "verbose_loading";

    public static final String EXTRA_ACTION = "settings_action";
    public static final String ACTION_RELOAD = "reload";

    private SharedPreferences preferences;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        preferences = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        setContentView(R.layout.activity_settings);
        configureSystemBars();

        applyBrandLogo(findViewById(R.id.settingsLogo));
        applyBrandLogo(findViewById(R.id.aboutLogo));

        TextView versionText = findViewById(R.id.versionText);
        versionText.setText("Version " + getVersionName());

        Switch desktopSite = findViewById(R.id.desktopSiteSwitch);
        Switch keepAwake = findViewById(R.id.keepAwakeSwitch);
        Switch verboseLoading = findViewById(R.id.verboseLoadingSwitch);

        desktopSite.setChecked(preferences.getBoolean(PREF_DESKTOP, false));
        keepAwake.setChecked(preferences.getBoolean(PREF_KEEP_AWAKE, false));
        verboseLoading.setChecked(preferences.getBoolean(PREF_VERBOSE_LOADING, false));

        desktopSite.setOnCheckedChangeListener((buttonView, checked) ->
                preferences.edit().putBoolean(PREF_DESKTOP, checked).apply());
        keepAwake.setOnCheckedChangeListener((buttonView, checked) ->
                preferences.edit().putBoolean(PREF_KEEP_AWAKE, checked).apply());
        verboseLoading.setOnCheckedChangeListener((buttonView, checked) ->
                preferences.edit().putBoolean(PREF_VERBOSE_LOADING, checked).apply());

        findViewById(R.id.desktopSiteCard).setOnClickListener(v ->
                desktopSite.setChecked(!desktopSite.isChecked()));
        findViewById(R.id.keepAwakeCard).setOnClickListener(v ->
                keepAwake.setChecked(!keepAwake.isChecked()));
        findViewById(R.id.verboseLoadingCard).setOnClickListener(v ->
                verboseLoading.setChecked(!verboseLoading.isChecked()));

        findViewById(R.id.backButton).setOnClickListener(v -> finish());
        findViewById(R.id.reloadCard).setOnClickListener(v -> {
            setResult(RESULT_OK, new Intent().putExtra(EXTRA_ACTION, ACTION_RELOAD));
            finish();
        });
        findViewById(R.id.clearDataCard).setOnClickListener(v -> clearWebData());
        findViewById(R.id.paypalCard).setOnClickListener(v -> openPayPal());
        findViewById(R.id.feedbackCard).setOnClickListener(v ->
                startActivity(new Intent(this, FeedbackActivity.class)));
        findViewById(R.id.appSupportDiscordCard).setOnClickListener(v -> openExternal(APP_SUPPORT_DISCORD_URL));
        findViewById(R.id.mainDiscordCard).setOnClickListener(v -> openExternal(MAIN_DISCORD_URL));
        findViewById(R.id.betaGroupCard).setOnClickListener(v -> openExternal(BETA_GROUP_URL));

        setupCollapsible(R.id.pageControlsHeader, R.id.pageControlsContent, R.id.pageControlsArrow, false);
        setupCollapsible(R.id.helpFeedbackHeader, R.id.helpFeedbackContent, R.id.helpFeedbackArrow, false);
        setupCollapsible(R.id.creditsHeader, R.id.creditsContent, R.id.creditsArrow, false);

        loadRemoteAvatar(YOLANDO_AVATAR_URL, findViewById(R.id.yolandoAvatar));
        loadRemoteAvatar(DCHINZ_AVATAR_URL, findViewById(R.id.dchinzAvatar));
    }

    private void setupCollapsible(int headerId, int contentId, int arrowId, boolean expandedByDefault) {
        View header = findViewById(headerId);
        View content = findViewById(contentId);
        TextView arrow = findViewById(arrowId);
        if (header == null || content == null || arrow == null) return;

        setCollapsedState(content, arrow, expandedByDefault);
        header.setOnClickListener(v -> {
            boolean expand = content.getVisibility() != View.VISIBLE;
            setCollapsedState(content, arrow, expand);
        });
    }

    private void setCollapsedState(View content, TextView arrow, boolean expanded) {
        content.setVisibility(expanded ? View.VISIBLE : View.GONE);
        arrow.setText(expanded ? "▴" : "▾");
        arrow.setContentDescription(expanded ? "Collapse section" : "Expand section");
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

    private void clearWebData() {
        try {
            WebView tempWebView = new WebView(this);
            tempWebView.clearCache(true);
            tempWebView.clearHistory();
            tempWebView.destroy();

            WebStorage.getInstance().deleteAllData();
            CookieManager.getInstance().removeAllCookies(value -> runOnUiThread(() -> {
                CookieManager.getInstance().flush();
                Toast.makeText(SettingsActivity.this,
                        "Web cache, cookies, and site storage cleared.",
                        Toast.LENGTH_SHORT).show();
            }));
        } catch (Throwable error) {
            Log.e(TAG, "Could not clear web data", error);
            Toast.makeText(this, "Could not clear web data.", Toast.LENGTH_LONG).show();
        }
    }

    private void openPayPal() {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(PAYPAL_SHARE_URL)));
        } catch (ActivityNotFoundException error) {
            Toast.makeText(this, "No app can open the PayPal support link.", Toast.LENGTH_SHORT).show();
        }
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
                connection.setRequestProperty("User-Agent", "DMZRankedUnofficial/1.0.17");
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

    private String getVersionName() {
        try {
            PackageInfo info = getPackageManager().getPackageInfo(getPackageName(), 0);
            return info.versionName == null ? "Unknown" : info.versionName;
        } catch (Exception error) {
            return "Unknown";
        }
    }
}
