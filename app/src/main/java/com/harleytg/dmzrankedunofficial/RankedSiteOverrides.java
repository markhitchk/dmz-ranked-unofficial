package com.harleytg.dmzranked;

import android.app.Activity;
import android.content.Context;
import android.net.Uri;
import android.util.Base64;
import android.webkit.WebView;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/**
 * First-party app-only CSS and shared Ranked Hub welcome banner.
 * Neither the public MW4/ARC site code nor the independent DMZRanked.com
 * community site is modified. Never run this on an unapproved origin.
 */
final class RankedSiteOverrides {
    static final String PREF_CSS_OVERRIDES="first_party_css_overrides";
    private static final String STYLE_ID="ranked-hub-android-css";
    private RankedSiteOverrides() {}

    private static String readAsset(Activity activity,String name,int limit) {
        try(InputStream input=activity.getAssets().open(name);
            ByteArrayOutputStream output=new ByteArrayOutputStream()){
            byte[] buffer=new byte[4096];
            int read;
            while((read=input.read(buffer))!=-1){
                if(output.size()+read>limit)return null;
                output.write(buffer,0,read);
            }
            return output.toString(StandardCharsets.UTF_8.name());
        }catch(Exception ignored){return null;}
    }
    private static String logoDataUrl(Activity activity) {
        try(InputStream input=activity.getAssets().open(
                "ranked-hub/ranked-hub-selected.webp");
            ByteArrayOutputStream output=new ByteArrayOutputStream()){
            byte[] buffer=new byte[4096];
            int read;
            while((read=input.read(buffer))!=-1){
                if(output.size()+read>100000)return "";
                output.write(buffer,0,read);
            }
            return "data:image/webp;base64,"+
                    Base64.encodeToString(output.toByteArray(),Base64.NO_WRAP);
        }catch(Exception ignored){return "";}
    }

    static void apply(Activity activity,WebView webView,String site,String approvedHost) {
        if(webView==null||activity==null)return;
        String location=webView.getUrl();
        Uri uri=location==null?null:Uri.parse(location);
        if(uri==null||!"https".equalsIgnoreCase(uri.getScheme())
                ||!approvedHost.equalsIgnoreCase(uri.getHost()))return;

        final String siteFile;
        if(RankedSiteActivity.SITE_DMZ_V1.equals(site))siteFile="ranked-overrides/mw4.css";
        else if(RankedSiteActivity.SITE_ARC.equals(site))siteFile="ranked-overrides/arc.css";
        else return;

        boolean enabled=activity.getSharedPreferences(
                NotificationSync.PREFS,Context.MODE_PRIVATE)
                .getBoolean(PREF_CSS_OVERRIDES,true);
        String css="";
        String welcomeJs="";
        if(enabled){
            String siteCss=readAsset(activity,siteFile,100000);
            String welcomeCss=readAsset(activity,"ranked-overrides/welcome.css",20000);
            welcomeJs=readAsset(activity,"ranked-overrides/welcome.js",20000);
            if(siteCss==null||welcomeCss==null||welcomeJs==null)return;
            css=siteCss+"\n"+welcomeCss;
        }
        String script="(function(){"
                +"if(location.protocol!=='https:'||location.hostname!=="
                +JSONObject.quote(approvedHost)+")return;"
                +"var styleId="+JSONObject.quote(STYLE_ID)+",s=document.getElementById(styleId);"
                +"if(!s){s=document.createElement('style');s.id=styleId;"
                +"(document.head||document.documentElement).appendChild(s);}"
                +"document.documentElement.setAttribute('data-ranked-hub-site',"
                +JSONObject.quote(site)+");"
                +"s.textContent="+JSONObject.quote(css)+";";
        if(enabled){
            script+="window.__rankedHubWelcomeConfig={site:"
                    +JSONObject.quote(site)+",logo:"
                    +JSONObject.quote(logoDataUrl(activity))+"};"
                    +welcomeJs;
        }else{
            script+="if(window.__rankedHubWelcome&&window.__rankedHubWelcome.destroy)"
                    +"window.__rankedHubWelcome.destroy();";
        }
        webView.evaluateJavascript(script+"})()",null);
    }
}
