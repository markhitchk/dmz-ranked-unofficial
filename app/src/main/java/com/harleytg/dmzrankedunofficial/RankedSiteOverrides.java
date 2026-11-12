package com.harleytg.dmzranked;

import android.app.Activity;
import android.content.Context;
import android.net.Uri;
import android.webkit.WebView;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/** Bundled app-only CSS: only two verified Harley's Studios ranked origins. */
final class RankedSiteOverrides {
    static final String PREF_CSS_OVERRIDES="first_party_css_overrides";
    private RankedSiteOverrides() {}

    static void apply(Activity activity, WebView webView, String site, String approvedHost) {
        if (webView == null) return;
        String location = webView.getUrl();
        Uri uri = location == null ? null : Uri.parse(location);
        if (uri == null || !"https".equalsIgnoreCase(uri.getScheme())
                || !approvedHost.equalsIgnoreCase(uri.getHost())) return;
        final String path;
        if (RankedSiteActivity.SITE_DMZ_V1.equals(site)) path="ranked-overrides/mw4.css";
        else if (RankedSiteActivity.SITE_ARC.equals(site)) path="ranked-overrides/arc.css";
        else return;
        boolean enabled=activity.getSharedPreferences(
                NotificationSync.PREFS,Context.MODE_PRIVATE)
                .getBoolean(PREF_CSS_OVERRIDES,true);
        String css="";
        if(enabled) {
            try(InputStream input=activity.getAssets().open(path);
                ByteArrayOutputStream output=new ByteArrayOutputStream()) {
                byte[] buffer=new byte[4096];int n;
                while((n=input.read(buffer))!=-1) {
                    if(output.size()+n>100000) return;
                    output.write(buffer,0,n);
                }
                css=output.toString(StandardCharsets.UTF_8.name());
            } catch(Exception ignored){return;}
        }
        // Check the origin again inside JS. No addJavascriptInterface.
        String javascript="(function(){"
                +"if(location.protocol!=='https:'||location.hostname!=="
                +JSONObject.quote(approvedHost)+")return;"
                +"var id='ranked-hub-android-css',s=document.getElementById(id);"
                +"if(!s){s=document.createElement('style');s.id=id;"
                +"(document.head||document.documentElement).appendChild(s);}"
                +"document.documentElement.setAttribute('data-ranked-hub-site',"
                +JSONObject.quote(site)+");"
                +"s.textContent="+JSONObject.quote(css)+";})()";
        webView.evaluateJavascript(javascript,null);
    }
}
