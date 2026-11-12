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
import org.json.JSONObject;
import org.json.JSONTokener;


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
    private SharedPreferences sitePreferences;

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

        sitePreferences=getSharedPreferences("dmz_ranked_settings",Context.MODE_PRIVATE);
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
        applySiteDisplayPreferences();
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
                rememberSafeSitePage(url);
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
        loadCoordinator = new RankedLoadCoordinator(this, browserLayer, site, allowedHost,
                false, () -> webView.loadUrl(homeUrl), this::finish, this::openCurrentPageInBrowser);
        root.addView(browserLayer, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        setContentView(root);
        // The previous build drew the toolbar under the clock/battery and let
        // the websites extend behind the gesture-navigation bar. Insets belong
        // on the activity root so both DMZ V1 and ARC receive usable space.
        RankedSafeArea.apply(root);

        if (savedInstanceState == null || webView.restoreState(savedInstanceState) == null) {
            String initial = homeUrl;
            if (requestedWebsiteSettings && SITE_DMZ_V1.equals(site)) {
                initial = "https://dmz-ranked.vercel.app/#v1/settings";
            } else if (!requestedWebsiteSettings &&
                    sitePreferences.getBoolean("remember_last_page",true)) {
                String last=sitePreferences.getString("ranked_last_page_"+site,"");
                if(last!=null && isSafeStoredPage(last)) initial=last;
            }
            webView.loadUrl(initial);
        }
    }


    /** Apply global settings supported by this first-party site browser.
     * Unsupported legacy widgets/operator controls are hidden in Settings.
     */
    private void applySiteDisplayPreferences() {
        if(webView==null || sitePreferences==null)return;
        WebSettings web=webView.getSettings();
        String size=sitePreferences.getString("content_size","standard");
        int zoom="compact".equals(size)?90:"large".equals(size)?115:100;
        web.setTextZoom(zoom);
        if(sitePreferences.getBoolean("desktop_site",false)){
            web.setUserAgentString("Mozilla/5.0 (X11; Linux x86_64) "
                    +"AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36");
        }else{
            web.setUserAgentString(null); // reset to the actual Android WebView UA
        }
        if(sitePreferences.getBoolean("keep_awake",false)){
            getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        }else{
            getWindow().clearFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        }
    }

    private boolean isSafeStoredPage(String value) {
        try{
            Uri url=Uri.parse(value);
            if(!isApprovedSite(url) || url.getQuery()!=null) return false;
            // Both first-party ranked sites are single-page apps at the origin root.
            // Never persist OAuth callback paths or arbitrary profile URL segments.
            String path=url.getPath();
            if(path!=null && !path.isEmpty() && !"/".equals(path))return false;
            String fragment=url.getFragment();
            return fragment==null || (fragment.length()<=72 &&
                    fragment.matches("[A-Za-z0-9/_-]*"));
        }catch(Exception ignored){return false;}
    }
    private void rememberSafeSitePage(String value) {
        if(sitePreferences==null || !sitePreferences.getBoolean("remember_last_page",true)
                ||requestedWebsiteSettings || !isSafeStoredPage(value)) return;
        String site=getIntent().getStringExtra(EXTRA_SITE_ID);
        if(site==null)return;
        sitePreferences.edit().putString("ranked_last_page_"+site,value).apply();
    }

    @Override
    protected void onResume() {
        super.onResume();
        applySiteDisplayPreferences();
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
                "App settings",
                "Capture safe site preferences",
                "Restore saved site preferences"
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
                        case 4:
                            captureSiteBackup();
                            break;
                        case 5:
                            restoreSiteBackup();
                            break;
                        default:
                            break;
                    }
                }).show();
    }


    private String currentSite() {
        return SITE_DMZ_V1.equals(getIntent().getStringExtra(EXTRA_SITE_ID))
                ? SITE_DMZ_V1 : SITE_ARC;
    }

    private boolean safeMainFrame() {
        String url = webView == null ? null : webView.getUrl();
        if(url == null || !isApprovedSite(Uri.parse(url))){
            Toast.makeText(this,"Site backup only works on its verified HTTPS website.",
                    Toast.LENGTH_LONG).show();
            return false;
        }
        return true;
    }

    /** Explicit user-initiated export. It never scrapes WebView storage. */
    private void captureSiteBackup() {
        if(!safeMainFrame())return;
        String site=currentSite();
        String script="(function(){var api=window.RankedHubBackupV1;"
                +"if(!api||api.siteId!=="+JSONObject.quote(site)
                +")return null;return JSON.stringify(api.exportSafeState());})()";
        webView.evaluateJavascript(script, result->{
            try{
                if(!safeMainFrame())return; // origin may change while callback is pending
                Object parsed=new JSONTokener(result).nextValue();
                if(!(parsed instanceof String))throw new IllegalArgumentException("No website contract");
                JSONObject document=new JSONObject((String)parsed);
                RankedSiteSafeBackupStore.save(this,site,document);
                Toast.makeText(this,siteTitle+" preferences captured for encrypted backup.",
                        Toast.LENGTH_LONG).show();
            }catch(Exception error){
                Toast.makeText(this,
                        "Website backup unavailable. Update the site or try again after loading.",
                        Toast.LENGTH_LONG).show();
            }
        });
    }

    private void restoreSiteBackup() {
        if(!safeMainFrame())return;
        String site=currentSite();
        JSONObject saved=RankedSiteSafeBackupStore.read(this,site);
        if(saved==null){
            Toast.makeText(this,"No saved "+siteTitle+" preferences yet. Capture or import a backup first.",
                    Toast.LENGTH_LONG).show();
            return;
        }
        new AlertDialog.Builder(this)
            .setTitle("RESTORE LOCAL SITE PREFERENCES?")
            .setMessage("Restore the saved "+siteTitle+" preferences to this verified website? "
                +"Your website account, PIN, session, ranked records, and server standings "
                +"will not be changed.")
            .setNegativeButton("CANCEL",null)
            .setPositiveButton("RESTORE",(d,w)->{
                if(!safeMainFrame())return;
                try{
                    // Build a quoted JSON literal, not direct string interpolation from HTML.
                    String serialized=JSONObject.quote(saved.toString());
                    String script="(function(){var api=window.RankedHubBackupV1;"
                        +"if(!api||api.siteId!=="+JSONObject.quote(site)
                        +")return {ok:false};return api.importSafeState(JSON.parse("
                        +serialized+"));})()";
                    webView.evaluateJavascript(script,result->{
                        try{
                            if(!safeMainFrame())return;
                            JSONObject status=new JSONObject(result);
                            if(status.optBoolean("ok",false)){
                                Toast.makeText(this,"Safe site preferences restored.",
                                    Toast.LENGTH_LONG).show();
                            }else{
                                Toast.makeText(this,"Website backup contract unavailable or invalid.",
                                    Toast.LENGTH_LONG).show();
                            }
                        }catch(Exception ignored){
                            Toast.makeText(this,"Website did not accept the safe restore.",
                                Toast.LENGTH_LONG).show();
                        }
                    });
                }catch(Exception error){
                    Toast.makeText(this,"Invalid saved site backup.",Toast.LENGTH_LONG).show();
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
