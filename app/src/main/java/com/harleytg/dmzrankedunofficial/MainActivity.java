package com.harleytg.dmzrankedunofficial;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.ProgressBar;
import android.widget.Switch;
import android.widget.TextView;
import android.widget.Toast;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Locale;

public class MainActivity extends Activity {
    private static final String HOME_URL = "https://dmzranked.com/";
    private static final String PAYPAL_SHARE_URL = "https://share.google/9nj1GcaYNu3qJTTeu";
    private static final String YOLANDO_AVATAR_URL = "https://cdn.discordapp.com/avatars/645842556898377728/b2c3a2a0001bc2d946ae52aeaa9abe1c.webp?size=3072";
    private static final String DCHINZ_AVATAR_URL = "https://cdn.discordapp.com/avatars/364411414787653642/71fc7b2b2cae4b81c38ad148aed61df3.webp?size=3072";
    private static final int FILE_REQUEST = 2001;

    private static final String PREFS = "dmz_ranked_settings";
    private static final String PREF_DESKTOP = "desktop_site";
    private static final String PREF_KEEP_AWAKE = "keep_awake";
    private static final String PREF_VERBOSE_LOADING = "verbose_loading";

    private static final String INSTALL_SECTION_NAV_SCRIPT =
            "(function(){if(window.__dmzSectionNavInstalled){return 'already';}" +
            "var labels=['LEADERBOARD','HOW TO PLAY','LOG A RAID','COMMUNITY','CHAMPIONSHIP','HISTORY','RULES','UPDATES','OVERLAYS','CONTACT'];" +
            "function norm(v){return String(v||'').replace(/\\s+/g,' ').trim().toUpperCase();}" +
            "function known(v){return labels.indexOf(norm(v))>=0?norm(v):null;}" +
            "function labelFrom(el){var n=el;for(var i=0;i<7&&n;i++,n=n.parentElement){var a=null;try{a=known(n.getAttribute&&(n.getAttribute('aria-label')||n.getAttribute('data-tab')||n.getAttribute('data-section')||n.getAttribute('data-page')||n.getAttribute('title')));}catch(e){}if(a){return a;}var t=null;try{t=known(n.innerText||n.textContent);}catch(e){}if(t){return t;}}return null;}" +
            "function candidateElements(){try{return document.querySelectorAll('button,a,[role=button],[data-tab],[data-section],[data-page],.tab,.nav-button,.menu-button');}catch(e){return [];}}" +
            "function findControl(label){var list=candidateElements();for(var i=0;i<list.length;i++){if(labelFrom(list[i])===label){return list[i];}}return null;}" +
            "function detectCurrent(){var list=candidateElements();for(var i=0;i<list.length;i++){var el=list[i];var lab=labelFrom(el);if(!lab){continue;}var cls=norm(el.className);var aria='';try{aria=norm(el.getAttribute('aria-selected'));}catch(e){}if(aria==='TRUE'||cls.indexOf('ACTIVE')>=0||cls.indexOf('SELECTED')>=0||cls.indexOf('CURRENT')>=0){return lab;}}return 'LEADERBOARD';}" +
            "var initial=detectCurrent();var state={stack:[initial],current:initial,suppress:false};window.__dmzSectionNav=state;window.__dmzSectionNavInstalled=true;" +
            "document.addEventListener('click',function(ev){if(state.suppress){return;}var lab=labelFrom(ev.target);if(!lab){return;}setTimeout(function(){if(!state.suppress&&state.current!==lab){state.stack.push(lab);state.current=lab;}},0);},true);" +
            "window.__dmzAndroidSectionBack=function(){try{if(state.stack.length<=1){return 'empty';}state.stack.pop();var prev=state.stack[state.stack.length-1];var control=findControl(prev);if(!control){return 'missing';}state.current=prev;state.suppress=true;try{control.click();}catch(e){}setTimeout(function(){state.suppress=false;},120);return 'handled';}catch(e){return 'error';}};return 'installed';})()";

    private WebView webView;
    private ProgressBar topProgressBar;
    private View loadingOverlay;
    private ProgressBar loadingProgressBar;
    private TextView loadingVerboseText;
    private ValueCallback<Uri[]> fileCallback;
    private SharedPreferences preferences;
    private String mobileUserAgent;
    private boolean handlingBack;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        preferences = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        webView = findViewById(R.id.webView);
        topProgressBar = findViewById(R.id.progressBar);
        loadingOverlay = findViewById(R.id.loadingOverlay);
        loadingProgressBar = findViewById(R.id.loadingProgressBar);
        loadingVerboseText = findViewById(R.id.loadingVerboseText);

        findViewById(R.id.settingsButton).setOnClickListener(v -> showSettings());

        Bitmap logo = LogoData.decode();
        ((ImageView) findViewById(R.id.titleLogo)).setImageBitmap(logo);
        ((ImageView) findViewById(R.id.loadingLogo)).setImageBitmap(logo);

        configureWebView();
        applyKeepAwakePreference();
        showLoadingScreen("Starting DMZ Ranked…", 0);

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            webView.loadUrl(HOME_URL);
        }

        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT,
                    this::handleBack
            );
        }
    }

    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadsImagesAutomatically(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);

        mobileUserAgent = settings.getUserAgentString();
        applyDesktopMode(false);

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(webView, true);

        webView.setBackgroundColor(Color.rgb(9, 9, 9));
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return route(request.getUrl());
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
                if (isDmzUrl(Uri.parse(url))) {
                    showLoadingScreen("Connecting to dmzranked.com…", 5);
                }
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                if (isDmzUrl(Uri.parse(url))) {
                    view.evaluateJavascript(INSTALL_SECTION_NAV_SCRIPT, null);
                }
                hideLoadingScreen();
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                if (request.isForMainFrame()) {
                    updateLoadingVerbose("Connection failed — showing offline message.");
                    String html = "<html><meta name='viewport' content='width=device-width,initial-scale=1'>" +
                            "<body style='margin:0;background:#101010;color:#eee;font-family:sans-serif;display:grid;place-items:center;min-height:100vh;text-align:center'>" +
                            "<div><h2>DMZ Ranked could not load</h2><p>Check your connection and try again.</p>" +
                            "<p><a style='color:#67ff18' href='" + HOME_URL + "'>Retry</a></p></div></body></html>";
                    view.loadDataWithBaseURL(HOME_URL, html, "text/html", "UTF-8", HOME_URL);
                }
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) {
                    fileCallback.onReceiveValue(null);
                }
                fileCallback = callback;
                try {
                    startActivityForResult(params.createIntent(), FILE_REQUEST);
                    return true;
                } catch (ActivityNotFoundException ex) {
                    fileCallback = null;
                    Toast.makeText(MainActivity.this, "No file picker is available.", Toast.LENGTH_SHORT).show();
                    return false;
                }
            }

            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                topProgressBar.setProgress(newProgress);
                topProgressBar.setVisibility(newProgress >= 100 ? View.GONE : View.VISIBLE);

                loadingProgressBar.setProgress(newProgress);
                if (newProgress < 20) {
                    updateLoadingVerbose("Connecting… " + newProgress + "%");
                } else if (newProgress < 65) {
                    updateLoadingVerbose("Loading DMZ Ranked… " + newProgress + "%");
                } else if (newProgress < 95) {
                    updateLoadingVerbose("Loading page assets… " + newProgress + "%");
                } else {
                    updateLoadingVerbose("Finishing up… " + newProgress + "%");
                }
            }
        });

        webView.setDownloadListener((url, userAgent, contentDisposition, mimetype, contentLength) ->
                Toast.makeText(MainActivity.this, "External downloads are disabled in this client.", Toast.LENGTH_SHORT).show());
    }

    private void showLoadingScreen(String status, int progress) {
        loadingProgressBar.setProgress(progress);
        loadingOverlay.setVisibility(View.VISIBLE);
        updateLoadingVerbose(status);
    }

    private void hideLoadingScreen() {
        loadingProgressBar.setProgress(100);
        updateLoadingVerbose("Ready.");
        loadingOverlay.postDelayed(() -> loadingOverlay.setVisibility(View.GONE), 180);
    }

    private void updateLoadingVerbose(String status) {
        boolean verbose = preferences.getBoolean(PREF_VERBOSE_LOADING, false);
        loadingVerboseText.setText(status);
        loadingVerboseText.setVisibility(verbose ? View.VISIBLE : View.GONE);
    }

    private boolean route(Uri uri) {
        if (uri == null) return false;
        String scheme = uri.getScheme();
        if (scheme == null) return false;

        if (scheme.equalsIgnoreCase("http") || scheme.equalsIgnoreCase("https")) {
            if (isDmzUrl(uri)) {
                return false;
            }

            if (isAllowedPayPalLink(uri)) {
                openExternal(uri);
            } else {
                Toast.makeText(this, "Only the approved PayPal link can open outside DMZ Ranked.", Toast.LENGTH_SHORT).show();
            }
            return true;
        }

        Toast.makeText(this, "External link blocked.", Toast.LENGTH_SHORT).show();
        return true;
    }

    private boolean isDmzUrl(Uri uri) {
        if (uri == null || uri.getHost() == null) return false;
        String host = uri.getHost().toLowerCase(Locale.US);
        return host.equals("dmzranked.com") || host.endsWith(".dmzranked.com");
    }

    private boolean isAllowedPayPalLink(Uri uri) {
        return uri != null && uri.toString().startsWith(PAYPAL_SHARE_URL);
    }

    private void openExternal(Uri uri) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException ignored) {
            Toast.makeText(this, "No app can open this link.", Toast.LENGTH_SHORT).show();
        }
    }

    private void showSettings() {
        View content = getLayoutInflater().inflate(R.layout.dialog_settings, null, false);
        Switch desktopSite = content.findViewById(R.id.desktopSiteSwitch);
        Switch keepAwake = content.findViewById(R.id.keepAwakeSwitch);
        Switch verboseLoading = content.findViewById(R.id.verboseLoadingSwitch);
        TextView versionText = content.findViewById(R.id.versionText);
        ImageView settingsLogo = content.findViewById(R.id.settingsLogo);
        ImageView yolandoAvatar = content.findViewById(R.id.yolandoAvatar);
        ImageView dchinzAvatar = content.findViewById(R.id.dchinzAvatar);
        Button paypalButton = content.findViewById(R.id.paypalButton);
        Button reloadButton = content.findViewById(R.id.reloadButton);
        Button clearButton = content.findViewById(R.id.clearDataButton);

        desktopSite.setChecked(preferences.getBoolean(PREF_DESKTOP, false));
        keepAwake.setChecked(preferences.getBoolean(PREF_KEEP_AWAKE, false));
        verboseLoading.setChecked(preferences.getBoolean(PREF_VERBOSE_LOADING, false));
        versionText.setText("Version " + getVersionName());
        settingsLogo.setImageBitmap(LogoData.decode());

        loadRemoteAvatar(YOLANDO_AVATAR_URL, yolandoAvatar);
        loadRemoteAvatar(DCHINZ_AVATAR_URL, dchinzAvatar);

        AlertDialog dialog = new AlertDialog.Builder(this)
                .setTitle("Settings")
                .setView(content)
                .setPositiveButton("Done", null)
                .create();

        desktopSite.setOnCheckedChangeListener((buttonView, isChecked) -> {
            preferences.edit().putBoolean(PREF_DESKTOP, isChecked).apply();
            applyDesktopMode(true);
        });

        keepAwake.setOnCheckedChangeListener((buttonView, isChecked) -> {
            preferences.edit().putBoolean(PREF_KEEP_AWAKE, isChecked).apply();
            applyKeepAwakePreference();
        });

        verboseLoading.setOnCheckedChangeListener((buttonView, isChecked) -> {
            preferences.edit().putBoolean(PREF_VERBOSE_LOADING, isChecked).apply();
            updateLoadingVerbose(loadingVerboseText.getText().toString());
        });

        paypalButton.setOnClickListener(v -> openExternal(Uri.parse(PAYPAL_SHARE_URL)));

        reloadButton.setOnClickListener(v -> {
            showLoadingScreen("Reloading DMZ Ranked…", 0);
            webView.reload();
            dialog.dismiss();
        });

        clearButton.setOnClickListener(v -> {
            webView.clearCache(true);
            CookieManager.getInstance().removeAllCookies(value -> {
                CookieManager.getInstance().flush();
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "Web cache and cookies cleared.", Toast.LENGTH_SHORT).show());
            });
        });

        dialog.show();
    }

    private void loadRemoteAvatar(String url, ImageView target) {
        new Thread(() -> {
            HttpURLConnection connection = null;
            InputStream input = null;
            try {
                connection = (HttpURLConnection) new URL(url).openConnection();
                connection.setConnectTimeout(5000);
                connection.setReadTimeout(5000);
                connection.setInstanceFollowRedirects(true);
                input = connection.getInputStream();
                Bitmap bitmap = BitmapFactory.decodeStream(input);
                if (bitmap != null && !isFinishing()) {
                    runOnUiThread(() -> target.setImageBitmap(bitmap));
                }
            } catch (Exception ignored) {
                // Keep the bundled DMZ Ranked fallback icon if an avatar cannot be fetched.
            } finally {
                try {
                    if (input != null) input.close();
                } catch (Exception ignored) {
                }
                if (connection != null) connection.disconnect();
            }
        }).start();
    }

    private void applyDesktopMode(boolean reload) {
        if (mobileUserAgent == null) return;
        boolean desktop = preferences.getBoolean(PREF_DESKTOP, false);
        String ua = mobileUserAgent;
        if (desktop) {
            ua = mobileUserAgent.replace("; wv", "")
                    .replace("Android", "X11; Linux x86_64")
                    .replaceAll("Mobile\\s*", "");
        }
        webView.getSettings().setUserAgentString(ua + " DMZRankedUnofficial/1.0.10");
        if (reload && webView.getUrl() != null) {
            showLoadingScreen("Applying desktop mode…", 0);
            webView.reload();
        }
    }

    private void applyKeepAwakePreference() {
        boolean keepAwake = preferences.getBoolean(PREF_KEEP_AWAKE, false);
        if (keepAwake) {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        } else {
            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        }
    }

    private String getVersionName() {
        try {
            PackageInfo info = getPackageManager().getPackageInfo(getPackageName(), 0);
            return info.versionName == null ? "Unknown" : info.versionName;
        } catch (Exception e) {
            return "Unknown";
        }
    }

    private void handleBack() {
        if (handlingBack) return;
        handlingBack = true;
        webView.evaluateJavascript(
                "(function(){try{if(window.__dmzAndroidSectionBack){return window.__dmzAndroidSectionBack();}return 'missing';}catch(e){return 'error';}})()",
                result -> {
                    String clean = result == null ? "" : result.replace("\"", "").trim();
                    if ("handled".equals(clean)) {
                        handlingBack = false;
                        return;
                    }
                    handleBrowserHistoryOrExit();
                }
        );
    }

    private void handleBrowserHistoryOrExit() {
        if (webView.canGoBack()) {
            webView.goBack();
            handlingBack = false;
        } else {
            finish();
        }
    }

    @Override
    @Deprecated
    public void onBackPressed() {
        handleBack();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_REQUEST && fileCallback != null) {
            Uri[] result = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
            fileCallback.onReceiveValue(result);
            fileCallback = null;
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.stopLoading();
            webView.destroy();
        }
        if (fileCallback != null) {
            fileCallback.onReceiveValue(null);
            fileCallback = null;
        }
        super.onDestroy();
    }
}
