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
    static final int THEME_COMMUNITY = 3;
    static final int HEIGHT_DP = 78;

    private RankedHeaderView() {}

    static WebView create(Activity activity, int theme, Runnable onSettings) {
        return createInternal(activity, theme, onSettings, false);
    }

    static WebView createSettings(Activity activity, int theme, Runnable onBack) {
        return createInternal(activity, theme, onBack, true);
    }

    private static WebView createInternal(Activity activity, int theme,
                                          Runnable action, boolean settingsMode) {
        String background = theme == THEME_DMZ_V1 ? "#101010"
                : theme == THEME_ARC ? "#071A29"
                : theme == THEME_COMMUNITY ? "#111B19" : "#091923";
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
                        && "action".equals(uri.getHost())) {
                    String expected = settingsMode ? "/back" : "/settings";
                    if (expected.equals(uri.getPath())) action.run();
                }
                return true;
            }
        });
        header.loadDataWithBaseURL("file:///android_asset/ranked-hub/",
                buildHtml(activity, theme, settingsMode), "text/html", "UTF-8", null);
        return header;
    }

    private static String buildHtml(Activity activity, int theme, boolean settingsMode) {
        final String title;
        final String logo;
        final String logoAlt;
        final String accent;
        final String background;
        if (theme == THEME_DMZ_V1) {
            title = "DMZ Ranked";
            logo = "dmz-v1-discord.webp";
            logoAlt = "DMZ Ranked MW4 V1 Discord server icon";
            accent = "#F4C15F";
            background = "#101010";
        } else if (theme == THEME_ARC) {
            title = "ARC Raiders Ranked";
            logo = "arc-ranked.webp";
            logoAlt = "ARC Raiders Ranked official website logo";
            accent = "#62D8E5";
            background = "#071A29";
        } else if (theme == THEME_COMMUNITY) {
            title = "DMZ Ranked";
            logo = "dmz_community.png";
            logoAlt = "Original DMZRanked.com Android app artwork";
            accent = "#B6C695";
            background = "#111B19";
        } else {
            title = "Ranked Hub";
            logo = "ranked-hub-selected.webp";
            logoAlt = "Ranked Hub puppy shield logo";
            accent = "#33D4E7";
            background = "#091923";
        }

        String versionName = "Unknown";
        long buildCode = 0;
        try {
            PackageInfo packageInfo = activity.getPackageManager().getPackageInfo(
                    activity.getPackageName(), 0);
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
        String actionHref = settingsMode
                ? "rankedhub://action/back" : "rankedhub://action/settings";
        String actionLabel = settingsMode ? "Back to launcher" : "Open app settings";
        // An SVG gear is consistently rendered on Android WebView (unlike Unicode U+2699).
        String actionIcon = settingsMode ? "&#10094;"
                : "<svg viewBox='0 0 24 24' width='28' height='28' fill='none' "
                + "stroke='currentColor' stroke-width='1.8' stroke-linecap='round' "
                + "stroke-linejoin='round' aria-hidden='true'>"
                + "<path d='M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z'/>"
                + "<path d='M19.4 13.3a7.7 7.7 0 0 0 0-2.6l2-1.5-2-3.5-2.4 1a8 8 0 0 0-2.2-1.3L14.5 3h-5l-.3 2.4A8 8 0 0 0 7 6.7l-2.4-1-2 3.5 2 1.5a7.7 7.7 0 0 0 0 2.6l-2 1.5 2 3.5 2.4-1a8 8 0 0 0 2.2 1.3l.3 2.4h5l.3-2.4a8 8 0 0 0 2.2-1.3l2.4 1 2-3.5-2-1.5Z'/>"
                + "</svg>";

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
                + ".settings svg{width:28px;height:28px;display:block;transition:transform 180ms ease}"
                + ".settings:active svg{transform:rotate(35deg) scale(.92)}"
                + "@media(prefers-reduced-motion:reduce){.settings svg{transition:none}}"
                + "@media(max-width:355px){.bar{gap:7px;padding-left:7px;padding-right:5px}"
                + ".logo{width:43px;height:43px;flex-basis:43px}.name{font-size:17px}"
                + ".badge{font-size:9px;padding:4px 5px}.meta{font-size:10px}"
                + ".settings{flex-basis:38px;font-size:26px}}"
                + "</style></head><body><div class='bar'>"
                + "<img class='logo' src='" + logo + "' alt='" + escape(logoAlt) + "'>"
                + "<div class='copy'><div class='name-row'><span class='name'>" + escape(title)
                + "</span>" + badge + "</div><div class='meta'>" + meta + "</div></div>"
                + "<a class='settings' href='" + actionHref
                + "' aria-label='" + actionLabel + "'>" + actionIcon + "</a>"
                + "</div></body></html>";
    }

    private static String escape(String text) {
        return text.replace("&", "&amp;").replace("<", "&lt;")
                .replace(">", "&gt;").replace("'", "&#39;")
                .replace("\"", "&quot;");
    }
}
