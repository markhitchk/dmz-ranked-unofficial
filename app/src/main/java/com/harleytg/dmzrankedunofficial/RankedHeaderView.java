package com.harleytg.dmzranked;

import android.app.Activity;
import android.content.pm.PackageInfo;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.view.View;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * Shared beta-launcher header matching the original DMZ Ranked native layout:
 * logo, name, optional beta badge, installed version/build and settings gear.
 * Colors and original offline logos vary by ranked destination.
 *
 * A lightweight JavaScript-free local WebView is used because the source
 * website's DMZ crest is SVG. No generated or substituted logos are shown.
 */
final class RankedHeaderView {
    static final int THEME_HUB = 0;
    static final int THEME_DMZ_V1 = 1;
    static final int THEME_ARC = 2;
    static final int HEIGHT_DP = 78;

    private RankedHeaderView() {}

    static WebView create(Activity activity, int theme, Runnable onSettings) {
        String background = theme == THEME_DMZ_V1 ? "#101010"
                : theme == THEME_ARC ? "#071A29" : "#091923";
        WebView header = new WebView(activity);
        header.setBackgroundColor(Color.parseColor(background));
        header.setOverScrollMode(View.OVER_SCROLL_NEVER);
        header.setVerticalScrollBarEnabled(false);
        header.setHorizontalScrollBarEnabled(false);
        WebSettings settings = header.getSettings();
        settings.setJavaScriptEnabled(false);
        settings.setDomStorageEnabled(false);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setSupportMultipleWindows(false);
        settings.setSupportZoom(false);
        settings.setDefaultTextEncodingName("UTF-8");

        header.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (request == null || !request.isForMainFrame()) return true;
                Uri uri = request.getUrl();
                if ("rankedhub".equals(uri.getScheme())
                        && "action".equals(uri.getHost())
                        && "/settings".equals(uri.getPath())) {
                    onSettings.run();
                }
                return true;
            }
        });
        header.loadDataWithBaseURL("file:///android_asset/ranked-hub/",
                buildHtml(activity, theme), "text/html", "UTF-8", null);
        return header;
    }

    private static String buildHtml(Activity activity, int theme) {
        final String title;
        final String logo;
        final String logoAlt;
        final String accent;
        final String background;
        if (theme == THEME_DMZ_V1) {
            title = "DMZ Ranked";
            logo = "dmz-v1.svg";
            logoAlt = "DMZ Ranked V1 official website crest";
            accent = "#F4C15F";
            background = "#101010";
        } else if (theme == THEME_ARC) {
            title = "ARC Raiders Ranked";
            logo = "arc-ranked.webp";
            logoAlt = "ARC Raiders Ranked official website logo";
            accent = "#62D8E5";
            background = "#071A29";
        } else {
            title = "Ranked Hub";
            logo = "official_studio.png";
            logoAlt = "Harley's Studios official puppy logo";
            accent = "#33D4E7";
            background = "#091923";
        }

        String versionName = "Unknown";
        long buildCode = 0;
        try {
            PackageInfo packageInfo = activity.getPackageManager()
                    .getPackageInfo(activity.getPackageName(), 0);
            if (packageInfo != null) {
                if (packageInfo.versionName != null) versionName = packageInfo.versionName;
                buildCode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                        ? packageInfo.getLongVersionCode() : packageInfo.versionCode;
            }
        } catch (Exception ignored) {
            // Keep a visible fallback without hiding the header.
        }
        boolean beta = activity.getPackageName().endsWith(".beta");
        String badge = beta ? "<span class='badge'>BETA</span>" : "";
        String meta = "Version " + escape(versionName) + " &#8226; Build " + buildCode;

        return "<!doctype html><html lang='en'><head>"
                + "<meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>"
                + "<style>"
                + "*{box-sizing:border-box}html,body{margin:0;min-height:0;height:100%;overflow:hidden;}"
                + "body{font-family:Arial,Roboto,sans-serif;background:" + background + ";color:#f5f7f8}"
                + ".bar{height:78px;border-bottom:3px solid " + accent + ";padding:7px 10px;"
                + "display:flex;align-items:center;gap:10px;overflow:hidden}"
                + ".logo{width:53px;height:53px;flex:0 0 53px;object-fit:contain}"
                + ".copy{flex:1;min-width:0;overflow:hidden}"
                + ".name-row{display:flex;gap:7px;align-items:center;min-width:0}"
                + ".name{font-size:20px;font-weight:850;letter-spacing:.01em;white-space:nowrap;"
                + "overflow:hidden;text-overflow:ellipsis;min-width:0}"
                + ".badge{flex:0 0 auto;display:inline-block;background:" + accent + ";color:#091119;"
                + "font-size:10px;letter-spacing:.09em;font-weight:900;border-radius:6px;padding:5px 7px}"
                + ".meta{font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"
                + "color:#a7b5be;margin-top:6px;letter-spacing:.025em}"
                + ".settings{flex:0 0 44px;height:48px;display:flex;align-items:center;justify-content:center;"
                + "font-size:30px;line-height:1;color:" + accent + ";text-decoration:none}"
                + ".settings:focus-visible{outline:2px solid white;border-radius:7px}"
                + "@media(max-width:355px){.bar{gap:7px;padding-left:7px;padding-right:5px}"
                + ".logo{width:43px;height:43px;flex-basis:43px}.name{font-size:17px}"
                + ".badge{font-size:9px;padding:4px 5px}.meta{font-size:10px}"
                + ".settings{flex-basis:38px;font-size:26px}}"
                + "</style></head><body><div class='bar'>"
                + "<img class='logo' src='" + logo + "' alt='" + escape(logoAlt) + "'>"
                + "<div class='copy'><div class='name-row'><span class='name'>" + escape(title)
                + "</span>" + badge + "</div><div class='meta'>" + meta + "</div></div>"
                + "<a class='settings' href='rankedhub://action/settings' aria-label='Open app settings'>&#9881;</a>"
                + "</div></body></html>";
    }

    private static String escape(String text) {
        return text.replace("&", "&amp;").replace("<", "&lt;")
                .replace(">", "&gt;").replace("'", "&#39;")
                .replace("\"", "&quot;");
    }
}
