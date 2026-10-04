package com.harleytg.dmzranked;

import android.Manifest;
import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.graphics.Insets;
import android.view.Gravity;
import android.view.View;
import android.view.WindowInsets;
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
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import java.util.Iterator;
import java.util.LinkedHashSet;
import java.util.Locale;

import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONTokener;

public class MainActivity extends Activity {
    private static final String TAG = "DMZRanked";
    private static final String HOME_URL = "https://dmzranked.com/";
    private static final String PAYPAL_SHARE_URL = "https://share.google/9nj1GcaYNu3qJTTeu";
    private static final String APP_SUPPORT_DISCORD_URL = "https://discord.gg/kdHneTZkyd";
    private static final String MAIN_DISCORD_URL = "https://discord.gg/jTaTHqw45F";
    private static final String BETA_GROUP_URL = "https://groups.google.com/g/dmz-ranked";
    private static final int FILE_REQUEST = 2001;
    private static final int SETTINGS_REQUEST = 2002;
    private static final int NOTIFICATION_PERMISSION_REQUEST = 2003;
    private static final String SITE_NOTIFICATION_CHANNEL = "dmz_site_notifications";

    private static final String PREFS = "dmz_ranked_settings";
    private static final String PREF_DESKTOP = "desktop_site";
    private static final String PREF_KEEP_AWAKE = "keep_awake";
    private static final String PREF_VERBOSE_LOADING = "verbose_loading";
    private static final String PREF_SITE_NOTIFICATIONS = "site_notifications";
    private static final String PREF_SELECTED_OPERATOR = "website_selected_operator";
    private static final String PREF_OPERATOR_VERIFIED = "website_operator_verified";
    private static final String PREF_OPERATOR_PROTECTED = "website_operator_protected";
    private static final String PREF_OPERATOR_SOURCE = "website_operator_source";
    private static final String PREF_OPERATOR_SYNC_MS = "website_operator_sync_ms";

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

    private static final String READ_SITE_STATUS_SCRIPT =
            "(function(){try{" +
            "var t=((document.body&&document.body.innerText)||'').replace(/\\s+/g,' ');" +
            "var live=/\\bLIVE\\b/i.test(t);" +
            "var sm=t.match(/\\bSYNCED\\s+([0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?\\s*(?:AM|PM)?)/i);" +
            "var pm=t.match(/\\b([0-9][0-9,]*)\\s+PLAYERS?\\b/i);" +
            "var sync=sm?('SYNCED '+sm[1].toUpperCase()):'';" +
            "var players=pm?(pm[1]+' PLAYERS'):'';" +
            "return [live?'LIVE':'',sync,players].join('|||');" +
            "}catch(e){return '||||||';}})()";

    private static final String READ_CURRENT_OPERATOR_SCRIPT =
            "(function(){try{" +
            "function clean(v){return String(v==null?'':v).replace(/\\s+/g,' ').trim();}" +
            "function badLabel(v){return !v||/SELECT EXISTING OPERATOR|PICK YOUR NAME|RETURNING OPERATOR|YOUR OPERATOR NAME|CHANGE PIN|OPERATOR KILLS/i.test(v);}" +
            "function valid(v){v=clean(v);return v.length>0&&v.length<=80&&!badLabel(v)&&!/[\\r\\n]/.test(v);}" +
            "function ctx(el){var out='',n=el;for(var i=0;i<6&&n;i++,n=n.parentElement){try{out+=' '+clean((n.getAttribute&&((n.getAttribute('aria-label')||'')+' '+(n.getAttribute('placeholder')||'')+' '+(n.getAttribute('data-label')||'')+' '+(n.getAttribute('title')||'')))+' '+(n.id||'')+' '+(n.name||'')+' '+((n.tagName==='LABEL'||i>0)?(n.innerText||''):''));}catch(e){}}return out;}" +
            "var name='',source='';" +
            "var inputs=[].slice.call(document.querySelectorAll('input:not([type=hidden]):not([type=password]),textarea'));" +
            "for(var i=0;i<inputs.length&&!name;i++){var el=inputs[i],c=ctx(el);if(!/OPERATOR NAME|YOUR OPERATOR|RETURNING OPERATOR/i.test(c)){continue;}var v=clean(el.value||el.getAttribute('value')||'');if(valid(v)){name=v;source='Operator name field';}}" +
            "var selects=[].slice.call(document.querySelectorAll('select'));" +
            "for(var j=0;j<selects.length&&!name;j++){var sel=selects[j],sc=ctx(sel);if(!/RETURNING OPERATOR|PICK YOUR NAME|SELECT EXISTING OPERATOR/i.test(sc)){continue;}try{if(sel.selectedIndex>=0){var sv=clean(sel.options[sel.selectedIndex].textContent||sel.options[sel.selectedIndex].value||'');if(valid(sv)){name=sv;source='Returning operator';}}}catch(e){}}" +
            "function safeKey(k){return /operator|player.?name|user.?name|callsign|display.?name/i.test(k)&&!/pin|pass|token|auth|session|secret|key/i.test(k);}" +
            "function fromObject(obj,depth){if(!obj||depth>4)return '';if(typeof obj==='string'){return valid(obj)?clean(obj):'';}if(typeof obj!=='object')return '';for(var k in obj){if(!Object.prototype.hasOwnProperty.call(obj,k)||!safeKey(k))continue;var vv=obj[k];if(typeof vv==='string'&&valid(vv))return clean(vv);if(vv&&typeof vv==='object'){var nested=fromObject(vv,depth+1);if(nested)return nested;}}for(var k2 in obj){if(!Object.prototype.hasOwnProperty.call(obj,k2))continue;var child=obj[k2];if(child&&typeof child==='object'){var nested2=fromObject(child,depth+1);if(nested2)return nested2;}}return '';}" +
            "function fromStorage(st,label){try{for(var x=0;x<st.length;x++){var k=st.key(x)||'';if(!safeKey(k))continue;var raw=st.getItem(k)||'';if(valid(raw))return {n:clean(raw),s:label+' '+k};try{var parsed=JSON.parse(raw);var found=fromObject(parsed,0);if(found)return {n:found,s:label+' '+k};}catch(e){}}}catch(e){}return null;}" +
            "if(!name){var a=fromStorage(window.localStorage,'localStorage');if(a){name=a.n;source=a.s;}}" +
            "if(!name){var b=fromStorage(window.sessionStorage,'sessionStorage');if(b){name=b.n;source=b.s;}}" +
            "if(!name){try{var cookies=String(document.cookie||'').split(';');for(var cidx=0;cidx<cookies.length&&!name;cidx++){var p=cookies[cidx].split('='),ck=clean(p.shift()||'');if(!safeKey(ck))continue;var cv='';try{cv=decodeURIComponent(p.join('='));}catch(e){cv=p.join('=');}if(valid(cv)){name=clean(cv);source='cookie '+ck;}}}catch(e){}}" +
            "var body=clean((document.body&&document.body.innerText)||'');" +
            "var statusVisible=/VERIFIED ON THIS DEVICE|CHANGE PIN|PROTECTED/i.test(body);" +
            "var verified=/VERIFIED ON THIS DEVICE/i.test(body);" +
            "var protectedFlag=/PROTECTED/i.test(body)&&/CHANGE PIN|VERIFIED ON THIS DEVICE/i.test(body);" +
            "return JSON.stringify({name:name,verified:verified,protected:protectedFlag,statusVisible:statusVisible,source:source});" +
            "}catch(e){return JSON.stringify({name:'',verified:false,protected:false,statusVisible:false,source:''});}})()";

    private static final String READ_SITE_NOTIFICATIONS_SCRIPT =
            "(function(){try{" +
            "function clean(v){return String(v||'').replace(/\\s+/g,' ').trim();}" +
            "function visible(el){try{var st=getComputedStyle(el),r=el.getBoundingClientRect();return st.display!=='none'&&st.visibility!=='hidden'&&r.width>0&&r.height>0;}catch(e){return true;}}" +
            "var q='[role=alert],.toast,.notification,[class*=toast],[class*=notification],[data-notification]';" +
            "var nodes=[].slice.call(document.querySelectorAll(q)),seen={},out=[];" +
            "for(var i=0;i<nodes.length;i++){var el=nodes[i];if(!visible(el))continue;var t=clean(el.innerText||el.textContent||'');" +
            "if(t.length<4||t.length>320||/^notifications?$/i.test(t)||/^no notifications/i.test(t))continue;" +
            "if(!seen[t]){seen[t]=1;out.push(t);}if(out.length>=12)break;}" +
            "return JSON.stringify(out);" +
            "}catch(e){return '[]';}})()";

    private SharedPreferences preferences;
    private WebView webView;
    private ProgressBar topProgressBar;
    private View loadingOverlay;
    private ProgressBar loadingProgressBar;
    private TextView loadingStageText;
    private TextView loadingVerboseText;
    private TextView loadingConnectionText;
    private TextView loadingSyncedText;
    private TextView loadingPlayersText;
    private TextView loadingLiveDot;
    private int loadingStatusPollToken;
    private int siteNotificationMonitorToken;
    private boolean siteNotificationBaselineReady;
    private final LinkedHashSet<String> seenSiteNotifications = new LinkedHashSet<>();
    private int operatorMonitorToken;
    private ValueCallback<Uri[]> fileCallback;
    private String mobileUserAgent;
    private boolean handlingBack;
    private boolean desktopModeBeforeSettings;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        try {
            preferences = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            setContentView(R.layout.activity_main);
            configureSystemBars();

            webView = findViewById(R.id.webView);
            topProgressBar = findViewById(R.id.progressBar);
            loadingOverlay = findViewById(R.id.loadingOverlay);
            loadingProgressBar = findViewById(R.id.loadingProgressBar);
            loadingStageText = findViewById(R.id.loadingStageText);
            loadingVerboseText = findViewById(R.id.loadingVerboseText);
            loadingConnectionText = findViewById(R.id.loadingConnectionText);
            loadingSyncedText = findViewById(R.id.loadingSyncedText);
            loadingPlayersText = findViewById(R.id.loadingPlayersText);
            loadingLiveDot = findViewById(R.id.loadingLiveDot);

            applyBrandLogo(findViewById(R.id.titleLogo));
            applyBrandLogo(findViewById(R.id.loadingLogo));

            findViewById(R.id.settingsButton).setOnClickListener(v -> showSettings());

            configureWebView();
            ensureSiteNotificationChannel();
            requestSiteNotificationPermissionIfNeeded();
            applyKeepAwakePreference();
            showLoadingScreen("Starting DMZ Ranked…", 0);

            if (savedInstanceState != null) {
                webView.restoreState(savedInstanceState);
            } else {
                webView.loadUrl(HOME_URL);
            }
        } catch (Throwable error) {
            Log.e(TAG, "Startup failure", error);
            showStartupRecovery(error);
        }
    }

    private void configureSystemBars() {
        View root = findViewById(R.id.rootContainer);
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

    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setLoadsImagesAutomatically(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);

        mobileUserAgent = settings.getUserAgentString();
        applyDesktopMode(false);

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(webView, true);

        webView.setBackgroundColor(Color.rgb(8, 10, 9));
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return route(request == null ? null : request.getUrl());
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
                if (url != null && isDmzUrl(Uri.parse(url))) {
                    loadingStatusPollToken++;
                    operatorMonitorToken++;
                    siteNotificationMonitorToken++;
                    siteNotificationBaselineReady = false;
                    seenSiteNotifications.clear();
                    resetLoadingSiteStatus();
                    showLoadingScreen("Connecting to dmzranked.com…", 5);
                }
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                try {
                    if (url != null && isDmzUrl(Uri.parse(url))) {
                        view.evaluateJavascript(INSTALL_SECTION_NAV_SCRIPT, null);
                        int token = ++loadingStatusPollToken;
                        updateLoadingVerbose("Page loaded • reading LIVE status…");
                        readLiveSiteStatus(token, 0);
                        startOperatorMonitor();
                        startSiteNotificationMonitor();
                        return;
                    }
                } catch (Throwable ignored) {
                }
                hideLoadingScreen();
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                if (request != null && request.isForMainFrame()) {
                    hideLoadingScreen();
                    showOfflinePage();
                }
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) {
                    fileCallback.onReceiveValue(null);
                }
                fileCallback = callback;
                try {
                    Intent chooser = params == null ? new Intent(Intent.ACTION_OPEN_DOCUMENT) : params.createIntent();
                    if (params == null) {
                        chooser.setType("*/*");
                        chooser.addCategory(Intent.CATEGORY_OPENABLE);
                    }
                    startActivityForResult(chooser, FILE_REQUEST);
                    return true;
                } catch (ActivityNotFoundException ex) {
                    fileCallback = null;
                    Toast.makeText(MainActivity.this, "No file picker is available.", Toast.LENGTH_SHORT).show();
                    return false;
                }
            }

            @Override
            public void onProgressChanged(WebView view, int progress) {
                if (topProgressBar != null) {
                    topProgressBar.setProgress(progress);
                    topProgressBar.setVisibility(progress >= 100 ? View.GONE : View.VISIBLE);
                }
                if (loadingProgressBar != null) {
                    loadingProgressBar.setProgress(progress);
                }

                if (progress < 20) {
                    updateLoadingVerbose("Connecting… " + progress + "%");
                } else if (progress < 65) {
                    updateLoadingVerbose("Loading DMZ Ranked… " + progress + "%");
                } else if (progress < 95) {
                    updateLoadingVerbose("Loading page assets… " + progress + "%");
                } else {
                    updateLoadingVerbose("Finishing up… " + progress + "%");
                }

                if (progress >= 100) {
                    updateLoadingVerbose("Page loaded • waiting for live sync…");
                }
            }
        });

        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) ->
                Toast.makeText(MainActivity.this, "Downloads are disabled in this unofficial client.", Toast.LENGTH_SHORT).show());
    }

    private void resetLoadingSiteStatus() {
        if (loadingConnectionText != null) loadingConnectionText.setText("CONNECTING…");
        if (loadingSyncedText != null) loadingSyncedText.setText("SYNCING…");
        if (loadingPlayersText != null) loadingPlayersText.setText("— PLAYERS");
        if (loadingLiveDot != null) loadingLiveDot.setTextColor(getColor(R.color.dmz_gold));
    }

    private void readLiveSiteStatus(int token, int attempt) {
        if (webView == null || token != loadingStatusPollToken || isFinishing()) return;

        webView.evaluateJavascript(READ_SITE_STATUS_SCRIPT, result -> {
            if (token != loadingStatusPollToken || isFinishing()) return;

            String decoded = decodeJavascriptString(result);
            String[] parts = decoded.split("\\|\\|\\|", -1);
            String live = parts.length > 0 ? parts[0].trim() : "";
            String synced = parts.length > 1 ? parts[1].trim() : "";
            String players = parts.length > 2 ? parts[2].trim() : "";

            boolean hasLive = "LIVE".equalsIgnoreCase(live);
            boolean hasSynced = synced.toUpperCase(Locale.US).startsWith("SYNCED ");
            boolean hasPlayers = players.toUpperCase(Locale.US).endsWith(" PLAYERS");

            if (hasLive) {
                if (loadingConnectionText != null) loadingConnectionText.setText("LIVE");
                if (loadingLiveDot != null) loadingLiveDot.setTextColor(getColor(R.color.dmz_green));
            } else if (attempt >= 12) {
                if (loadingConnectionText != null) loadingConnectionText.setText("CONNECTED");
                if (loadingLiveDot != null) loadingLiveDot.setTextColor(getColor(R.color.dmz_green));
            }

            if (hasSynced && loadingSyncedText != null) loadingSyncedText.setText(synced);
            if (hasPlayers && loadingPlayersText != null) loadingPlayersText.setText(players);

            if ((hasLive && hasSynced && hasPlayers) || attempt >= 20) {
                if (!hasSynced && loadingSyncedText != null) loadingSyncedText.setText("SYNCED");
                if (!hasPlayers && loadingPlayersText != null) loadingPlayersText.setText("PLAYERS");
                updateLoadingVerbose(hasLive ? "Live data connected." : "Site connected.");
                hideLoadingScreenDelayed(850);
                return;
            }

            if (loadingOverlay != null) {
                loadingOverlay.postDelayed(() -> readLiveSiteStatus(token, attempt + 1), 250);
            }
        });
    }

    private void startOperatorMonitor() {
        if (webView == null || isFinishing()) return;
        int token = ++operatorMonitorToken;
        pollCurrentOperator(token);
    }

    private void pollCurrentOperator(int token) {
        if (webView == null || isFinishing() || token != operatorMonitorToken) return;

        Uri current;
        try {
            String url = webView.getUrl();
            current = url == null ? null : Uri.parse(url);
        } catch (Throwable ignored) {
            current = null;
        }
        if (!isDmzUrl(current)) return;

        captureCurrentOperator(() -> {
            if (webView != null && !isFinishing() && token == operatorMonitorToken) {
                webView.postDelayed(() -> pollCurrentOperator(token), 1500);
            }
        });
    }

    private void captureCurrentOperator(Runnable after) {
        if (webView == null || isFinishing()) {
            if (after != null) after.run();
            return;
        }

        try {
            webView.evaluateJavascript(READ_CURRENT_OPERATOR_SCRIPT, result -> {
                try {
                    if (preferences != null) {
                        String decoded = decodeJavascriptString(result);
                        JSONObject payload = new JSONObject(decoded);
                        String name = payload.optString("name", "").trim();
                        boolean statusVisible = payload.optBoolean("statusVisible", false);
                        String source = payload.optString("source", "").trim();

                        if (!name.isEmpty()) {
                            SharedPreferences.Editor editor = preferences.edit()
                                    .putString(PREF_SELECTED_OPERATOR, name)
                                    .putString(PREF_OPERATOR_SOURCE, source)
                                    .putLong(PREF_OPERATOR_SYNC_MS, System.currentTimeMillis());

                            if (statusVisible) {
                                editor.putBoolean(PREF_OPERATOR_VERIFIED, payload.optBoolean("verified", false))
                                        .putBoolean(PREF_OPERATOR_PROTECTED, payload.optBoolean("protected", false));
                            }
                            editor.apply();
                        }
                    }
                } catch (Throwable error) {
                    Log.d(TAG, "Operator state not available yet", error);
                } finally {
                    if (after != null) after.run();
                }
            });
        } catch (Throwable error) {
            Log.d(TAG, "Could not read operator state", error);
            if (after != null) after.run();
        }
    }

    private void ensureSiteNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null || manager.getNotificationChannel(SITE_NOTIFICATION_CHANNEL) != null) return;

        NotificationChannel channel = new NotificationChannel(
                SITE_NOTIFICATION_CHANNEL,
                "DMZ Ranked website notifications",
                NotificationManager.IMPORTANCE_DEFAULT);
        channel.setDescription("Notifications mirrored from dmzranked.com while the app is running.");
        manager.createNotificationChannel(channel);
    }

    private void requestSiteNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT < 33 || preferences == null
                || !preferences.getBoolean(PREF_SITE_NOTIFICATIONS, true)) {
            return;
        }
        if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(
                    new String[]{Manifest.permission.POST_NOTIFICATIONS},
                    NOTIFICATION_PERMISSION_REQUEST);
        }
    }

    private void startSiteNotificationMonitor() {
        if (webView == null || isFinishing() || preferences == null
                || !preferences.getBoolean(PREF_SITE_NOTIFICATIONS, true)) {
            return;
        }
        int token = ++siteNotificationMonitorToken;
        pollSiteNotifications(token);
    }

    private void pollSiteNotifications(int token) {
        if (webView == null || isFinishing() || token != siteNotificationMonitorToken
                || preferences == null || !preferences.getBoolean(PREF_SITE_NOTIFICATIONS, true)) {
            return;
        }

        Uri current;
        try {
            String url = webView.getUrl();
            current = url == null ? null : Uri.parse(url);
        } catch (Throwable ignored) {
            current = null;
        }
        if (!isDmzUrl(current)) return;

        try {
            webView.evaluateJavascript(READ_SITE_NOTIFICATIONS_SCRIPT, result -> {
                if (isFinishing() || token != siteNotificationMonitorToken) return;

                try {
                    String decoded = decodeJavascriptString(result);
                    JSONArray items = new JSONArray(decoded);

                    if (!siteNotificationBaselineReady) {
                        for (int i = 0; i < items.length(); i++) {
                            String text = items.optString(i, "").trim();
                            if (!text.isEmpty()) seenSiteNotifications.add(text);
                        }
                        siteNotificationBaselineReady = true;
                    } else {
                        for (int i = 0; i < items.length(); i++) {
                            String text = items.optString(i, "").trim();
                            if (!text.isEmpty() && seenSiteNotifications.add(text)) {
                                postNativeSiteNotification(text);
                            }
                        }
                    }

                    while (seenSiteNotifications.size() > 120) {
                        Iterator<String> iterator = seenSiteNotifications.iterator();
                        if (!iterator.hasNext()) break;
                        iterator.next();
                        iterator.remove();
                    }
                } catch (Throwable error) {
                    Log.d(TAG, "Could not parse site notifications", error);
                }

                if (webView != null && !isFinishing() && token == siteNotificationMonitorToken) {
                    webView.postDelayed(() -> pollSiteNotifications(token), 1800);
                }
            });
        } catch (Throwable error) {
            Log.d(TAG, "Could not read site notifications", error);
            if (webView != null && !isFinishing() && token == siteNotificationMonitorToken) {
                webView.postDelayed(() -> pollSiteNotifications(token), 1800);
            }
        }
    }

    private void postNativeSiteNotification(String message) {
        if (message == null || message.trim().isEmpty() || preferences == null
                || !preferences.getBoolean(PREF_SITE_NOTIFICATIONS, true)) {
            return;
        }
        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            return;
        }

        ensureSiteNotificationChannel();
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;

        Intent launch = new Intent(this, MainActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent contentIntent = PendingIntent.getActivity(
                this,
                4100,
                launch,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        String body = message.trim();
        if (body.length() > 320) body = body.substring(0, 319) + "…";

        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(this, SITE_NOTIFICATION_CHANNEL)
                : new Notification.Builder(this);

        builder.setSmallIcon(R.drawable.ic_notification)
                .setContentTitle("DMZ Ranked")
                .setContentText(body)
                .setStyle(new Notification.BigTextStyle().bigText(body))
                .setContentIntent(contentIntent)
                .setAutoCancel(true)
                .setOnlyAlertOnce(true)
                .setColor(getColor(R.color.dmz_gold))
                .setCategory(Notification.CATEGORY_STATUS);

        try {
            Bitmap logo = BitmapFactory.decodeResource(getResources(), R.drawable.dmz_ranked_logo);
            if (logo != null) builder.setLargeIcon(logo);
        } catch (Throwable ignored) {
        }

        manager.notify(12000 + Math.abs(body.hashCode() % 8000), builder.build());
    }

    private String decodeJavascriptString(String result) {
        if (result == null || "null".equals(result)) return "";
        try {
            Object value = new JSONTokener(result).nextValue();
            return value instanceof String ? (String) value : String.valueOf(value);
        } catch (Throwable ignored) {
            return result.replace("\\\"", "\"");
        }
    }

    private void hideLoadingScreenDelayed(long delayMs) {
        if (loadingProgressBar != null) loadingProgressBar.setProgress(100);
        if (loadingOverlay != null) {
            loadingOverlay.postDelayed(() -> {
                if (!isFinishing() && loadingOverlay != null) {
                    loadingOverlay.setVisibility(View.GONE);
                }
            }, delayMs);
        }
    }

    private void showOfflinePage() {
        if (webView == null) return;
        String html = "<!doctype html><html><head><meta name='viewport' content='width=device-width,initial-scale=1'>" +
                "<style>html,body{margin:0;background:#080a09;color:#f1f3ef;font-family:Arial,sans-serif;min-height:100%}" +
                "body{display:grid;place-items:center;min-height:100vh;padding:24px;box-sizing:border-box}" +
                ".card{width:min(460px,100%);background:linear-gradient(135deg,#14191d,#0b0f11);border:1px solid #4a504d;border-left:4px solid #f6c453;border-radius:16px;padding:28px;box-sizing:border-box}" +
                ".eyebrow{color:#e2b24d;letter-spacing:.22em;font-size:12px;font-weight:800}.title{font-size:38px;line-height:.95;font-weight:900;letter-spacing:.06em;margin:10px 0 8px}.title span{color:#f6c453}.copy{color:#999f9b;line-height:1.5}" +
                ".live{display:inline-block;margin:14px 0;color:#f1f3ef;background:#101512;border:1px solid #374039;border-radius:6px;padding:8px 12px;font-weight:800;font-size:13px}.dot{color:#55d582}" +
                ".retry{display:block;margin-top:20px;text-align:center;background:linear-gradient(#f9d16a,#d8a433);color:#080a09;text-decoration:none;font-weight:900;letter-spacing:.08em;padding:13px;border-radius:6px}" +
                "</style></head><body><div class='card'><div class='eyebrow'>DMZ RANKED</div><div class='title'>RANKED <span>OFFLINE</span></div>" +
                "<div class='live'><span class='dot'>●</span> CONNECTION LOST</div><div class='copy'>DMZ Ranked could not load. Check your connection, then reconnect to the leaderboard.</div>" +
                "<a class='retry' href='" + HOME_URL + "'>RETRY DMZ RANKED</a></div></body></html>";
        webView.loadDataWithBaseURL(HOME_URL, html, "text/html", "UTF-8", HOME_URL);
    }

    private void showLoadingScreen(String status, int progress) {
        if (loadingProgressBar != null) loadingProgressBar.setProgress(progress);
        if (loadingOverlay != null) loadingOverlay.setVisibility(View.VISIBLE);
        updateLoadingVerbose(status);
    }

    private void hideLoadingScreen() {
        loadingStatusPollToken++;
        if (loadingProgressBar != null) loadingProgressBar.setProgress(100);
        updateLoadingVerbose("Ready.");
        hideLoadingScreenDelayed(120);
    }

    private void updateLoadingVerbose(String status) {
        String safeStatus = status == null ? "" : status;
        if (loadingStageText != null) {
            loadingStageText.setText(safeStatus.replaceFirst("\\s+\\d+%$", ""));
        }

        if (loadingVerboseText == null || preferences == null) return;
        boolean verbose = preferences.getBoolean(PREF_VERBOSE_LOADING, false);
        loadingVerboseText.setText(safeStatus);
        loadingVerboseText.setVisibility(verbose ? View.VISIBLE : View.GONE);
    }

    private boolean route(Uri uri) {
        if (uri == null) return false;
        String scheme = uri.getScheme();
        if (scheme == null) return false;

        if ("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme)) {
            if (isDmzUrl(uri)) {
                return false;
            }

            if (isAllowedExternalLink(uri)) {
                openExternal(uri);
            } else {
                Toast.makeText(this, "External link blocked. Allowed links are the approved PayPal, DMZ Ranked Discord invites, and app beta group.", Toast.LENGTH_SHORT).show();
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

    private boolean isAllowedExternalLink(Uri uri) {
        if (uri == null) return false;
        String value = uri.toString();
        if (value.startsWith(PAYPAL_SHARE_URL)
                || value.startsWith(APP_SUPPORT_DISCORD_URL)
                || value.startsWith(MAIN_DISCORD_URL)
                || value.startsWith(BETA_GROUP_URL)) {
            return true;
        }

        String host = uri.getHost();
        if (host == null) return false;
        host = host.toLowerCase(Locale.US);
        String path = uri.getPath();
        if (path == null) return false;

        if (host.equals("discord.gg") || host.equals("www.discord.gg") || host.equals("discord.com")) {
            return path.contains("kdHneTZkyd") || path.contains("jTaTHqw45F");
        }

        if (host.equals("groups.google.com") || host.equals("www.groups.google.com")) {
            return path.equals("/g/dmz-ranked") || path.startsWith("/g/dmz-ranked/");
        }

        return false;
    }

    private void openExternal(Uri uri) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException ignored) {
            Toast.makeText(this, "No app can open this link.", Toast.LENGTH_SHORT).show();
        }
    }

    private void showSettings() {
        try {
            desktopModeBeforeSettings = preferences.getBoolean(PREF_DESKTOP, false);
            captureCurrentOperator(this::openSettingsActivity);
        } catch (Throwable error) {
            Log.e(TAG, "Settings failure", error);
            openSettingsActivity();
        }
    }

    private void openSettingsActivity() {
        try {
            startActivityForResult(new Intent(this, SettingsActivity.class), SETTINGS_REQUEST);
        } catch (Throwable error) {
            Log.e(TAG, "Settings failure", error);
            Toast.makeText(this, "Settings could not open: " + safeMessage(error), Toast.LENGTH_LONG).show();
        }
    }

    private void applyDesktopMode(boolean reload) {
        if (webView == null || mobileUserAgent == null) return;
        boolean desktop = preferences != null && preferences.getBoolean(PREF_DESKTOP, false);
        String ua = mobileUserAgent;
        if (desktop) {
            ua = mobileUserAgent.replace("; wv", "")
                    .replace("Android", "X11; Linux x86_64")
                    .replaceAll("Mobile\\s*", "");
        }
        String appIdentity = "DMZRankedApp/1.0.22 (HarleysStudios; AndroidClient; com.harleytg.dmzranked)";
        webView.getSettings().setUserAgentString(ua + " " + appIdentity);
        if (reload && webView.getUrl() != null) {
            showLoadingScreen("Applying desktop mode…", 0);
            webView.reload();
        }
    }

    private void applyKeepAwakePreference() {
        boolean keepAwake = preferences != null && preferences.getBoolean(PREF_KEEP_AWAKE, false);
        if (keepAwake) {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        } else {
            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        }
    }

    private void applyBrandLogo(ImageView imageView) {
        if (imageView == null) return;
        imageView.setBackgroundColor(Color.TRANSPARENT);
        imageView.setScaleType(ImageView.ScaleType.CENTER_INSIDE);
        imageView.setImageResource(R.drawable.dmz_ranked_logo);
    }

    private void handleBack() {
        if (webView == null) {
            finish();
            return;
        }
        if (handlingBack) return;

        handlingBack = true;
        try {
            webView.evaluateJavascript(
                    "(function(){try{if(window.__dmzAndroidSectionBack){return window.__dmzAndroidSectionBack();}return 'missing';}catch(e){return 'error';}})()",
                    result -> {
                        String clean = result == null ? "" : result.replace("\"", "").trim();
                        if ("handled".equals(clean)) {
                            handlingBack = false;
                        } else {
                            handleBrowserHistoryOrExit();
                        }
                    }
            );
        } catch (Throwable ignored) {
            handleBrowserHistoryOrExit();
        }
    }

    private void handleBrowserHistoryOrExit() {
        try {
            if (webView != null && webView.canGoBack()) {
                webView.goBack();
                handlingBack = false;
            } else {
                finish();
            }
        } catch (Throwable ignored) {
            finish();
        }
    }

    private void showStartupRecovery(Throwable error) {
        try {
            LinearLayout root = new LinearLayout(this);
            root.setOrientation(LinearLayout.VERTICAL);
            root.setGravity(Gravity.CENTER);
            root.setPadding(48, 48, 48, 48);
            root.setBackgroundColor(Color.rgb(8, 10, 9));

            TextView title = new TextView(this);
            title.setText("RANKED CLIENT ERROR");
            title.setTextColor(Color.rgb(246, 196, 83));
            title.setTextSize(26);
            title.setGravity(Gravity.CENTER);

            TextView message = new TextView(this);
            message.setText("The app hit a startup error instead of closing.\n\n" + error.getClass().getSimpleName() + ": " + safeMessage(error));
            message.setTextColor(Color.rgb(157, 163, 157));
            message.setTextSize(14);
            message.setGravity(Gravity.CENTER);
            message.setPadding(0, 24, 0, 24);

            Button retry = new Button(this);
            retry.setText("RETRY DMZ RANKED");
            retry.setTextColor(Color.rgb(8, 10, 9));
            retry.setBackgroundColor(Color.rgb(242, 182, 50));
            retry.setOnClickListener(v -> recreate());

            root.addView(title);
            root.addView(message);
            root.addView(retry);
            setContentView(root);
        } catch (Throwable ignored) {
            finish();
        }
    }

    private String safeMessage(Throwable error) {
        if (error == null || error.getMessage() == null || error.getMessage().trim().isEmpty()) {
            return "Unknown error";
        }
        return error.getMessage();
    }

    @Override
    @Deprecated
    public void onBackPressed() {
        handleBack();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) {
            try {
                String url = webView.getUrl();
                if (url != null && isDmzUrl(Uri.parse(url))) {
                    startOperatorMonitor();
                    startSiteNotificationMonitor();
                }
            } catch (Throwable ignored) {
            }
        }
    }

    @Override
    protected void onPause() {
        operatorMonitorToken++;
        siteNotificationMonitorToken++;
        super.onPause();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        try {
            if (webView != null) webView.saveState(outState);
        } catch (Throwable ignored) {
        }
        super.onSaveInstanceState(outState);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode == SETTINGS_REQUEST) {
            applyKeepAwakePreference();
            requestSiteNotificationPermissionIfNeeded();
            if (preferences.getBoolean(PREF_SITE_NOTIFICATIONS, true)) {
                startSiteNotificationMonitor();
            } else {
                siteNotificationMonitorToken++;
            }
            updateLoadingVerbose(loadingVerboseText == null ? "" : loadingVerboseText.getText().toString());

            boolean desktopNow = preferences.getBoolean(PREF_DESKTOP, false);
            boolean desktopChanged = desktopNow != desktopModeBeforeSettings;
            String action = data == null ? null : data.getStringExtra(SettingsActivity.EXTRA_ACTION);
            boolean reloadRequested = SettingsActivity.ACTION_RELOAD.equals(action);

            if (desktopChanged) {
                applyDesktopMode(false);
            }

            if ((desktopChanged || reloadRequested) && webView != null && webView.getUrl() != null) {
                showLoadingScreen(desktopChanged ? "Applying display mode…" : "Reloading DMZ Ranked…", 0);
                webView.reload();
            }
            return;
        }

        if (requestCode == FILE_REQUEST && fileCallback != null) {
            Uri[] result = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
            fileCallback.onReceiveValue(result);
            fileCallback = null;
        }
    }

    @Override
    protected void onDestroy() {
        operatorMonitorToken++;
        siteNotificationMonitorToken++;
        try {
            if (webView != null) {
                webView.stopLoading();
                webView.setWebChromeClient(null);
                webView.setWebViewClient(null);
                webView.destroy();
            }
        } catch (Throwable ignored) {
        }

        if (fileCallback != null) {
            fileCallback.onReceiveValue(null);
            fileCallback = null;
        }
        super.onDestroy();
    }
}
