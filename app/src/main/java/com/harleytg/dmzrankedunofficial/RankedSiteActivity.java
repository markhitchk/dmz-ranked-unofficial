package com.harleytg.dmzranked;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import java.util.Locale;

/**
 * Isolated, allowlisted browser for Harley's Studios ranked websites.
 * Original DMZRanked.com keeps its existing full-featured MainActivity.
 */
public final class RankedSiteActivity extends Activity {
    public static final String EXTRA_SITE_ID = "ranked_site_id";
    public static final String SITE_DMZ_V1 = "dmz-v1";
    public static final String SITE_ARC = "arc-raiders";

    private static final int FILE_PICKER_REQUEST = 6101;
    private static final int DARK = Color.rgb(8, 12, 19);

    private WebView webView;
    private ProgressBar progress;
    private ValueCallback<Uri[]> fileCallback;
    private String homeUrl;
    private String allowedHost;
    private String siteTitle;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        String site = getIntent().getStringExtra(EXTRA_SITE_ID);
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

        LinearLayout toolbar = new LinearLayout(this);
        toolbar.setOrientation(LinearLayout.HORIZONTAL);
        toolbar.setGravity(Gravity.CENTER_VERTICAL);
        toolbar.setPadding(dp(10), dp(5), dp(10), dp(5));
        toolbar.setMinimumHeight(dp(56));

        TextView back = toolbarButton("‹ HUB", () -> finish());
        toolbar.addView(back);

        TextView title = new TextView(this);
        title.setText(siteTitle);
        title.setTextColor(Color.WHITE);
        title.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        title.setTextSize(15);
        title.setSingleLine(true);
        title.setEllipsize(android.text.TextUtils.TruncateAt.END);
        title.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(0, dp(48), 1f);
        titleParams.leftMargin = dp(10);
        toolbar.addView(title, titleParams);

        toolbar.addView(toolbarButton("↻", () -> webView.reload()));
        toolbar.addView(toolbarButton("↗", this::openCurrentPageInBrowser));
        root.addView(toolbar);

        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setMax(100);
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
            public void onPageFinished(WebView view, String url) {
                progress.setVisibility(View.GONE);
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int value) {
                progress.setVisibility(value < 100 ? View.VISIBLE : View.GONE);
                progress.setProgress(value);
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

        root.addView(webView, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        setContentView(root);
        // The previous build drew the toolbar under the clock/battery and let
        // the websites extend behind the gesture-navigation bar. Insets belong
        // on the activity root so both DMZ V1 and ARC receive usable space.
        RankedSafeArea.apply(root);

        if (savedInstanceState == null || webView.restoreState(savedInstanceState) == null) {
            webView.loadUrl(homeUrl);
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

    private TextView toolbarButton(String caption, Runnable action) {
        TextView button = new TextView(this);
        button.setText(caption);
        button.setTextColor(Color.rgb(248, 196, 100));
        button.setTextSize(14);
        button.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        button.setGravity(Gravity.CENTER);
        button.setMinWidth(dp(48));
        button.setMinHeight(dp(48));
        button.setContentDescription("‹ HUB".equals(caption) ? "Return to ranked hub"
                : "↻".equals(caption) ? "Reload website" : "Open website in browser");
        button.setClickable(true);
        button.setFocusable(true);
        button.setOnClickListener(view -> action.run());
        return button;
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
