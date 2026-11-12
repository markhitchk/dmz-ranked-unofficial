package com.harleytg.dmzranked;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.res.ColorStateList;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.content.SharedPreferences;
import android.content.Context;
import android.webkit.WebResourceError;
import android.webkit.SslErrorHandler;
import android.net.http.SslError;
import android.widget.FrameLayout;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.Toast;


/**
 * Isolated, allowlisted browser for Harley's Studios ranked websites.
 * Original DMZRanked.com keeps its existing full-featured MainActivity.
 */
public final class RankedSiteActivity extends Activity {
    public static final String EXTRA_SITE_ID = "ranked_site_id";
    public static final String EXTRA_OPEN_SITE_SETTINGS = "ranked_open_site_settings";
    public static final String SITE_DMZ_V1 = "dmz-v1";
    public static final String SITE_ARC = "arc-raiders";

    private static final int FILE_PICKER_REQUEST = 6101;
    private static final int DARK = Color.rgb(8, 12, 19);

    private WebView webView;
    private WebView brandedHeader;
    private RankedLoadCoordinator loadCoordinator;
    private ProgressBar progress;
    private ValueCallback<Uri[]> fileCallback;
    private String homeUrl;
    private String allowedHost;
    private String siteTitle;
    private int sourceHeaderTheme = RankedHeaderView.THEME_DMZ_V1;
    private boolean requestedWebsiteSettings;
    private boolean openedWebsiteSettings;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        String site = getIntent().getStringExtra(EXTRA_SITE_ID);
        requestedWebsiteSettings = getIntent().getBooleanExtra(EXTRA_OPEN_SITE_SETTINGS, false);
        if (SITE_DMZ_V1.equals(site)) {
            homeUrl = "https://dmz-ranked.vercel.app/#v1";
            allowedHost = "dmz-ranked.vercel.app";
            siteTitle = "DMZ Ranked · MW4 V1";
        } else if (SITE_ARC.equals(site)) {
            homeUrl = "https://arc-raiders-ranked.vercel.app/";
            allowedHost = "arc-raiders-ranked.vercel.app";
            siteTitle = "ARC Raiders Ranked";
        } else {
            // Reject arbitrary URLs/hosts passed to the activity.
            finish();
            return;
        }

        getWindow().setStatusBarColor(DARK);
        getWindow().setNavigationBarColor(DARK);
        // Android 15/16 may force edge-to-edge; keep status icons readable.
        getWindow().getDecorView().setSystemUiVisibility(0);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(DARK);

        int theme = SITE_DMZ_V1.equals(site)
                ? RankedHeaderView.THEME_DMZ_V1 : RankedHeaderView.THEME_ARC;
        sourceHeaderTheme = theme;
        brandedHeader = RankedHeaderView.create(this, theme, this::showLauncherMenu);
        root.addView(brandedHeader, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(RankedHeaderView.HEIGHT_DP)));

        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setMax(100);
        progress.setProgressTintList(ColorStateList.valueOf(
                SITE_DMZ_V1.equals(site) ? Color.rgb(244, 193, 95) : Color.rgb(98, 216, 229)));
        root.addView(progress, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(3)));

        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        // Respect each ranked website's mobile viewport rather than shrinking
        // the desktop layout into a phone-width WebView.
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(false);
        settings.setTextZoom(100);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSafeBrowsingEnabled(true);

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (request == null || !request.isForMainFrame()) return false;
                Uri uri = request.getUrl();
                if (isApprovedSite(uri)) return false;
                openExternal(uri);
                return true;
            }

            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                if (loadCoordinator != null) loadCoordinator.onPageStarted();
            }
            @Override
            public void onPageCommitVisible(WebView view, String url) {
                if (loadCoordinator != null) loadCoordinator.onPageCommitVisible();
            }
            @Override
            public void onReceivedError(WebView view, WebResourceRequest request,
                                        WebResourceError error) {
                if (loadCoordinator != null && request != null && request.isForMainFrame()
                        && error != null) {
                    loadCoordinator.onNetworkError(error.getErrorCode());
                }
            }
            @Override
            public void onReceivedSslError(WebView view, SslErrorHandler handler,
                                           SslError error) {
                if (handler != null) handler.cancel();
                if (loadCoordinator != null) loadCoordinator.onTlsError();
            }
            @Override
            public void onPageFinished(WebView view, String url) {
                progress.setVisibility(View.GONE);
                if (loadCoordinator != null) loadCoordinator.onPageFinished();
                if (requestedWebsiteSettings && !openedWebsiteSettings
                        && SITE_ARC.equals(getIntent().getStringExtra(EXTRA_SITE_ID))
                        && isApprovedSite(Uri.parse(url))) {
                    openedWebsiteSettings = true;
                    // Only first-party ARC site, and only after explicit user action.
                    view.evaluateJavascript("(function(){var b=document.getElementById('siteSettingsButton');if(b)b.click();})()",null);
                }
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int value) {
                progress.setVisibility(value < 100 ? View.VISIBLE : View.GONE);
                progress.setProgress(value);
                if (loadCoordinator != null) loadCoordinator.onPageProgress(value);
            }

            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                try {
                    startActivityForResult(params.createIntent(), FILE_PICKER_REQUEST);
                    return true;
                } catch (ActivityNotFoundException error) {
                    fileCallback.onReceiveValue(null);
                    fileCallback = null;
                    Toast.makeText(RankedSiteActivity.this,
                            "No file picker is available.", Toast.LENGTH_SHORT).show();
                    return false;
                }
            }
        });

        FrameLayout browserLayer = new FrameLayout(this);
        browserLayer.addView(webView, new FrameLayout.LayoutParams(-1,-1));
        SharedPreferences pref = getSharedPreferences("dmz_ranked_settings", Context.MODE_PRIVATE);
        boolean verbose = pref.getBoolean("verbose_loading", false);
        loadCoordinator = new RankedLoadCoordinator(this, browserLayer, site, allowedHost,
                verbose, () -> webView.loadUrl(homeUrl), this::finish, this::openCurrentPageInBrowser);
        root.addView(browserLayer, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        setContentView(root);
        // The previous build drew the toolbar under the clock/battery and let
        // the websites extend behind the gesture-navigation bar. Insets belong
        // on the activity root so both DMZ V1 and ARC receive usable space.
        RankedSafeArea.apply(root);

        if (savedInstanceState == null || webView.restoreState(savedInstanceState) == null) {
            String initial = homeUrl;
            if (requestedWebsiteSettings && SITE_DMZ_V1.equals(site))
                initial = "https://dmz-ranked.vercel.app/#v1/settings";
            webView.loadUrl(initial);
        }
    }

    private boolean isApprovedSite(Uri uri) {
        return uri != null
                && "https".equalsIgnoreCase(uri.getScheme())
                && allowedHost.equalsIgnoreCase(uri.getHost());
    }

    private void openCurrentPageInBrowser() {
        String current = webView.getUrl();
        Uri url = current == null ? null : Uri.parse(current);
        openExternal(isApprovedSite(url) ? url : Uri.parse(homeUrl));
    }

    private void openExternal(Uri uri) {
        if (uri == null) return;
        String scheme = uri.getScheme();
        if (!"https".equalsIgnoreCase(scheme) && !"http".equalsIgnoreCase(scheme)) {
            Toast.makeText(this, "Unsupported external link.", Toast.LENGTH_SHORT).show();
            return;
        }
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri)
                    .addCategory(Intent.CATEGORY_BROWSABLE));
        } catch (ActivityNotFoundException error) {
            Toast.makeText(this, "No browser can open this link.", Toast.LENGTH_SHORT).show();
        }
    }

    private void showLauncherMenu() {
        String[] options = {
                "Reload this website",
                "Open in browser",
                "Return to Ranked Hub",
                "App settings"
        };
        new AlertDialog.Builder(this)
                .setTitle(siteTitle)
                .setItems(options, (dialog, index) -> {
                    switch (index) {
                        case 0:
                            webView.reload();
                            break;
                        case 1:
                            openCurrentPageInBrowser();
                            break;
                        case 2:
                            finish();
                            break;
                        case 3:
                            startActivity(new Intent(this, SettingsActivity.class)
                                    .putExtra(SettingsActivity.EXTRA_LAUNCHER_THEME,
                                            sourceHeaderTheme));
                            break;
                        default:
                            break;
                    }
                }).show();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_PICKER_REQUEST && fileCallback != null) {
            fileCallback.onReceiveValue(
                    WebChromeClient.FileChooserParams.parseResult(resultCode, data));
            fileCallback = null;
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (loadCoordinator != null) { loadCoordinator.dispose(); loadCoordinator = null; }
        if (brandedHeader != null) {
            ViewGroup parent = (ViewGroup) brandedHeader.getParent();
            if (parent != null) parent.removeView(brandedHeader);
            brandedHeader.destroy();
            brandedHeader = null;
        }
        if (fileCallback != null) {
            fileCallback.onReceiveValue(null);
            fileCallback = null;
        }
        if (webView != null) {
            ViewGroup parent = (ViewGroup) webView.getParent();
            if (parent != null) parent.removeView(webView);
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    private int dp(float value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
