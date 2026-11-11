package com.harleytg.dmzranked;

import android.app.Activity;
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
import android.widget.Toast;

/**
 * Offline, logo-authentic two-column launcher. HTML and site logos are
 * bundled as trusted app assets; JavaScript and external navigation are disabled.
 * Existing site clients remain separate Activities.
 */
public final class RankedHubActivity extends Activity {
    private static final String HUB_URL = "file:///android_asset/ranked-hub/index.html";
    private WebView hub;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        final int background = Color.rgb(6, 16, 25);
        getWindow().setStatusBarColor(background);
        getWindow().setNavigationBarColor(background);
        getWindow().getDecorView().setSystemUiVisibility(0);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(background);
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

        root.addView(hub, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);
        RankedSafeArea.apply(root);
        hub.loadUrl(HUB_URL);
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
    public void onBackPressed() {
        finish();
    }

    @Override
    protected void onDestroy() {
        if (hub != null) {
            ViewGroup parent = (ViewGroup) hub.getParent();
            if (parent != null) parent.removeView(hub);
            hub.destroy();
            hub = null;
        }
        super.onDestroy();
    }
}
