package com.harleytg.dmzranked;

import android.app.Activity;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import android.content.SharedPreferences;
import android.content.Context;
import android.view.View;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.ViewGroup;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.Toast;

/**
 * Offline, logo-authentic two-column launcher. HTML and site logos are
 * bundled as trusted app assets; JavaScript and external navigation are disabled.
 * Existing site clients remain separate Activities.
 */
public final class RankedHubActivity extends Activity {
    private static final String HUB_URL = "file:///android_asset/ranked-hub/index.html";
    private static final String PROJECTS_ASSET = "projects.html";
    private static final String HOME_ASSET = "index.html";
    private boolean projectsPage;
    private boolean reduceMotion;
    private WebView hub;
    private View brandedHeader;
    private LinearLayout rootLayout;
    private String headerSignature;
    private RankedIntroView intro;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        final int background = Color.rgb(6, 16, 25);
        getWindow().setStatusBarColor(background);
        getWindow().setNavigationBarColor(background);
        getWindow().getDecorView().setSystemUiVisibility(0);

        LinearLayout root = new LinearLayout(this);
        rootLayout = root;
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(background);
        brandedHeader = RankedHeaderView.create(this, RankedHeaderView.THEME_HUB,
                () -> startActivity(new Intent(this, SettingsActivity.class)
                        .putExtra(SettingsActivity.EXTRA_LAUNCHER_THEME,
                                RankedHeaderView.THEME_HUB)));
        root.addView(brandedHeader, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(RankedHeaderView.heightDp(this))));
        headerSignature = RankedHeaderView.signature(this);
        hub = new WebView(this);
        hub.setBackgroundColor(background);
        hub.setOverScrollMode(WebView.OVER_SCROLL_NEVER);
        WebSettings settings = hub.getSettings();
        settings.setJavaScriptEnabled(false);
        settings.setDomStorageEnabled(false);
        settings.setAllowFileAccess(true); // only packaged Android assets
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportMultipleWindows(false);
        settings.setSupportZoom(false);
        settings.setDefaultTextEncodingName("UTF-8");

        hub.setWebViewClient(new WebViewClient() {
            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                if (intro != null) intro.setStatus("LOADING • LOCAL LAUNCHER");
            }
            @Override public void onPageFinished(WebView view, String url) {
                if (intro != null) {
                    intro.setStatus("READY • GAME SELECTOR LOADED");
                    RankedIntroView done = intro;
                    intro = null;
                    done.finish(() -> { ViewGroup p = (ViewGroup)done.getParent();
                        if (p != null) p.removeView(done); done.dispose(); });
                }
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (request == null || !request.isForMainFrame()) return false;
                Uri uri = request.getUrl();
                if ("rankedhub".equals(uri.getScheme())) {
                    openDestination(uri);
                    return true;
                }
                // All site navigation belongs to the dedicated client activities.
                // This offline launcher never navigates to arbitrary URLs.
                return true;
            }
        });

        root.addView(hub, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        FrameLayout stack = new FrameLayout(this);
        stack.addView(root, new FrameLayout.LayoutParams(-1, -1));
        setContentView(stack);
        RankedSafeArea.apply(stack);
        SharedPreferences prefs = getSharedPreferences("dmz_ranked_settings", Context.MODE_PRIVATE);
        reduceMotion = prefs.getBoolean("reduced_motion", false)
                || !prefs.getBoolean("app_animations", true);
        boolean verbose = prefs.getBoolean("verbose_loading", true);
        if (state == null && (!reduceMotion || verbose)) {
            intro = new RankedIntroView(this, reduceMotion, verbose);
            stack.addView(intro, new FrameLayout.LayoutParams(-1, -1));
        }
        loadLauncherHtml(reduceMotion);
    }

    /** Offline CSS-only launchers; no JavaScript and no externally fetched assets. */
    private void loadLauncherHtml(boolean reducedMotion) {
        loadLauncherHtml(HOME_ASSET, reducedMotion);
    }

    private void loadLauncherHtml(String assetName, boolean reducedMotion) {
        // Only constant, packaged launcher filenames may be selected.
        String safeAsset = PROJECTS_ASSET.equals(assetName) ? PROJECTS_ASSET : HOME_ASSET;
        projectsPage = PROJECTS_ASSET.equals(safeAsset);
        if (!reducedMotion) {
            hub.loadUrl("file:///android_asset/ranked-hub/" + safeAsset);
            return;
        }
        // Android's app_animations / reduced_motion preferences also disable
        // the WebView card animations, without enabling JavaScript.
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(
                getAssets().open("ranked-hub/" + safeAsset), StandardCharsets.UTF_8))) {
            StringBuilder content = new StringBuilder();
            char[] buffer = new char[4096];
            int count;
            while ((count = reader.read(buffer)) != -1) content.append(buffer, 0, count);
            String html = content.toString().replace("<html lang=\"en\">",
                    "<html lang=\"en\" class=\"reduce-motion\">");
            hub.loadDataWithBaseURL("file:///android_asset/ranked-hub/", html,
                    "text/html", "UTF-8", null);
        } catch (IOException e) {
            hub.loadUrl("file:///android_asset/ranked-hub/" + safeAsset); // Bundled fallback.
        }
    }

    private void openDestination(Uri uri) {
        if (!"open".equals(uri.getHost())) return;
        String path = uri.getPath();
        if ("/dmz-v1".equals(path)) {
            openSite(RankedSiteActivity.SITE_DMZ_V1);
        } else if ("/arc-raiders".equals(path)) {
            openSite(RankedSiteActivity.SITE_ARC);
        } else if ("/community".equals(path)) {
            startActivity(new Intent(this, MainActivity.class));
        } else if ("/projects".equals(path)) {
            loadLauncherHtml(PROJECTS_ASSET, reduceMotion);
        } else if ("/home".equals(path)) {
            loadLauncherHtml(reduceMotion);
        } else if ("/puppy-clicker".equals(path)) {
            openSite(RankedSiteActivity.SITE_PUPPY);
        } else {
            Toast.makeText(this, "This operation is not available.", Toast.LENGTH_SHORT).show();
        }
    }

    private void openSite(String site) {
        Intent intent = new Intent(this, RankedSiteActivity.class);
        intent.putExtra(RankedSiteActivity.EXTRA_SITE_ID, site);
        startActivity(intent);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (rootLayout == null || brandedHeader == null) return;
        String next = RankedHeaderView.signature(this);
        if (next.equals(headerSignature)) return;
        View old = brandedHeader;
        rootLayout.removeView(old);
        brandedHeader = RankedHeaderView.create(this, RankedHeaderView.THEME_HUB,
                () -> startActivity(new Intent(this, SettingsActivity.class)
                        .putExtra(SettingsActivity.EXTRA_LAUNCHER_THEME,
                                RankedHeaderView.THEME_HUB)));
        rootLayout.addView(brandedHeader, 0, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(RankedHeaderView.heightDp(this))));
        headerSignature = next;
    }

    @Override
    public void onBackPressed() {
        if (projectsPage) {
            loadLauncherHtml(reduceMotion);
        } else {
            finish();
        }
    }

    private int dp(int size) {
        return Math.round(size * getResources().getDisplayMetrics().density);
    }

    @Override
    protected void onDestroy() {
        if (intro != null) { intro.dispose(); intro = null; }
        if (brandedHeader != null) {
            ViewGroup parent = (ViewGroup) brandedHeader.getParent();
            if (parent != null) parent.removeView(brandedHeader);
            brandedHeader = null;
        }
        if (hub != null) {
            ViewGroup parent = (ViewGroup) hub.getParent();
            if (parent != null) parent.removeView(hub);
            hub.destroy();
            hub = null;
        }
        super.onDestroy();
    }
}
