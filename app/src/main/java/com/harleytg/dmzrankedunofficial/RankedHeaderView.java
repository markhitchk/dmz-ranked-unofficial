package com.harleytg.dmzranked;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.res.ColorStateList;
import android.content.pm.PackageInfo;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.text.TextUtils;
import android.util.DisplayMetrics;
import android.view.Gravity;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.io.InputStream;

/**
 * All ranked launchers use the same native Android title bar layout as
 * original DMZRanked.com. The old WebView header mixed CSS pixels with dp,
 * causing a taller title bar on Samsung phones despite equal nominal sizes.
 * Native dp/sp also honors Android's display-size and font-size settings.
 */
final class RankedHeaderView {
    static final int THEME_HUB = 0;
    static final int THEME_DMZ_V1 = 1;
    static final int THEME_ARC = 2;
    static final int THEME_COMMUNITY = 3;
    static final int THEME_PUPPY = 4;
    static final int HEIGHT_DP = 74;

    private RankedHeaderView() {}

    private static SharedPreferences prefs(Activity activity) {
        return activity.getSharedPreferences("dmz_ranked_settings", Context.MODE_PRIVATE);
    }

    private static String contentSize(Activity activity) {
        return prefs(activity).getString("content_size", "standard");
    }

    /** The original bar is 74dp; Compact reduces every native app header. */
    static int heightDp(Activity activity) {
        String size = contentSize(activity);
        float fontScale = activity.getResources().getConfiguration().fontScale;
        int actualDpi = activity.getResources().getDisplayMetrics().densityDpi;
        int stableDpi = DisplayMetrics.DENSITY_DEVICE_STABLE;
        boolean systemCompact = fontScale < 0.96f
                || (stableDpi > 0 && actualDpi < stableDpi * 0.95f);
        int base = "compact".equals(size)
                || ("standard".equals(size) && systemCompact)
                ? 58 : "large".equals(size) ? 82 : HEIGHT_DP;
        int extra = Math.min(12, Math.round(Math.max(0f, fontScale - 1f) * 18f));
        return base + extra;
    }

    static String signature(Activity activity) {
        return contentSize(activity) + "/" + heightDp(activity) + "/"
                + activity.getResources().getConfiguration().fontScale + "/"
                + activity.getResources().getDisplayMetrics().densityDpi;
    }

    static View create(Activity activity, int theme, Runnable onSettings) {
        return createInternal(activity, theme, onSettings, false);
    }

    static View createSettings(Activity activity, int theme, Runnable onBack) {
        return createInternal(activity, theme, onBack, true);
    }

    private static int dp(Activity activity, float value) {
        return Math.round(value * activity.getResources().getDisplayMetrics().density);
    }

    private static String titleFor(int theme) {
        if (theme == THEME_DMZ_V1) return "DMZ Ranked";
        if (theme == THEME_ARC) return "ARC Raiders Ranked";
        if (theme == THEME_COMMUNITY) return "DMZ Ranked";
        if (theme == THEME_PUPPY) return "Puppy Clicker";
        return "Ranked Hub";
    }

    private static String logoFor(int theme) {
        final String logo;
        if (theme == THEME_DMZ_V1) logo = "dmz-v1-discord.webp";
        else if (theme == THEME_ARC) logo = "arc-ranked.webp";
        else if (theme == THEME_COMMUNITY) logo = "dmz_community.png";
        else if (theme == THEME_PUPPY) logo = "puppy_clicker.png";
        else logo = "ranked-hub-selected.webp";
        return logo;
    }

    private static int accentFor(int theme) {
        if (theme == THEME_DMZ_V1) return Color.parseColor("#F4C15F");
        if (theme == THEME_ARC) return Color.parseColor("#62D8E5");
        if (theme == THEME_COMMUNITY) return Color.parseColor("#B6C695");
        if (theme == THEME_PUPPY) return Color.parseColor("#F6C58F");
        return Color.parseColor("#33D4E7");
    }

    private static int backgroundFor(int theme) {
        if (theme == THEME_DMZ_V1) return Color.parseColor("#101010");
        if (theme == THEME_ARC) return Color.parseColor("#071A29");
        if (theme == THEME_COMMUNITY) return Color.parseColor("#111B19");
        if (theme == THEME_PUPPY) return Color.parseColor("#201925");
        return Color.parseColor("#091923");
    }

    private static View createInternal(Activity activity, int theme,
                                       Runnable action, boolean settingsMode) {
        final int height = heightDp(activity);
        final boolean compact = height <= 65;
        final int accent = accentFor(theme);
        LinearLayout shell = new LinearLayout(activity);
        shell.setOrientation(LinearLayout.VERTICAL);
        shell.setBackgroundColor(backgroundFor(theme));

        LinearLayout bar = new LinearLayout(activity);
        bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        bar.setPadding(dp(activity, 10), 0, dp(activity, 6), 0);
        shell.addView(bar, new LinearLayout.LayoutParams(-1, 0, 1f));

        ImageView image = new ImageView(activity);
        image.setScaleType(ImageView.ScaleType.CENTER_INSIDE);
        image.setContentDescription(titleFor(theme) + " logo");
        String logo = logoFor(theme);
        try (InputStream stream = activity.getAssets().open("ranked-hub/" + logo)) {
            image.setImageBitmap(BitmapFactory.decodeStream(stream));
        } catch (Exception ignored) {
            image.setImageResource(R.drawable.dmz_ranked_logo);
        }
        int logoSize = dp(activity, compact ? 39 : 46);
        bar.addView(image, new LinearLayout.LayoutParams(logoSize, logoSize));

        LinearLayout copy = new LinearLayout(activity);
        copy.setOrientation(LinearLayout.VERTICAL);
        copy.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout.LayoutParams copyParams = new LinearLayout.LayoutParams(0, -1, 1f);
        copyParams.leftMargin = dp(activity, 8);
        copyParams.rightMargin = dp(activity, 6);
        bar.addView(copy, copyParams);

        LinearLayout nameRow = new LinearLayout(activity);
        nameRow.setOrientation(LinearLayout.HORIZONTAL);
        nameRow.setGravity(Gravity.CENTER_VERTICAL);
        copy.addView(nameRow, new LinearLayout.LayoutParams(-1, -2));

        TextView title = new TextView(activity);
        title.setText(titleFor(theme));
        title.setTextColor(Color.WHITE);
        title.setTextSize(compact ? 18f : 21f);
        title.setTypeface(Typeface.create("sans-serif-condensed", Typeface.BOLD));
        title.setLetterSpacing(0.02f);
        title.setSingleLine(true);
        title.setEllipsize(TextUtils.TruncateAt.END);
        // Weight constrains ARC's longer name so its BETA badge stays visible.
        nameRow.addView(title, new LinearLayout.LayoutParams(0, -2, 1f));

        if (activity.getPackageName().endsWith(".beta")) {
            TextView badge = new TextView(activity);
            badge.setText("BETA");
            badge.setTextColor(Color.rgb(9, 17, 25));
            badge.setTextSize(compact ? 9f : 10f);
            badge.setTypeface(Typeface.create("sans-serif-condensed", Typeface.BOLD));
            badge.setLetterSpacing(0.08f);
            badge.setGravity(Gravity.CENTER);
            badge.setMinWidth(dp(activity, compact ? 35 : 40));
            badge.setPadding(dp(activity, 7), dp(activity, 2),
                    dp(activity, 7), dp(activity, 2));
            GradientDrawable badgeBackground = new GradientDrawable();
            badgeBackground.setColor(accent);
            badgeBackground.setCornerRadius(dp(activity, 5));
            badge.setBackground(badgeBackground);
            LinearLayout.LayoutParams badgeParams = new LinearLayout.LayoutParams(-2, -2);
            badgeParams.leftMargin = dp(activity, 7);
            nameRow.addView(badge, badgeParams);
        }

        TextView meta = new TextView(activity);
        meta.setSingleLine(true);
        meta.setEllipsize(TextUtils.TruncateAt.END);
        meta.setTextColor(Color.rgb(166, 183, 194));
        meta.setTextSize(compact ? 9.5f : 10.5f);
        meta.setTypeface(Typeface.create("sans-serif-condensed", Typeface.NORMAL));
        meta.setLetterSpacing(0.01f);
        String versionName = "Unknown";
        long buildCode = 0;
        try {
            PackageInfo info = activity.getPackageManager()
                    .getPackageInfo(activity.getPackageName(), 0);
            if (info.versionName != null) versionName = info.versionName;
            buildCode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                    ? info.getLongVersionCode() : info.versionCode;
        } catch (Exception ignored) { }
        meta.setText("Version " + versionName + " \u2022 Build " + buildCode);
        LinearLayout.LayoutParams metaParams = new LinearLayout.LayoutParams(-1, -2);
        metaParams.topMargin = dp(activity, 2);
        copy.addView(meta, metaParams);

        ImageButton button = new ImageButton(activity);
        button.setImageResource(settingsMode ? R.drawable.ic_back : R.drawable.ic_settings);
        button.setImageTintList(ColorStateList.valueOf(accent));
        android.util.TypedValue outValue = new android.util.TypedValue();
        activity.getTheme().resolveAttribute(
                android.R.attr.selectableItemBackgroundBorderless, outValue, true);
        if (outValue.resourceId != 0) button.setBackgroundResource(outValue.resourceId);
        button.setPadding(dp(activity, 9), dp(activity, 9),
                dp(activity, 9), dp(activity, 9));
        button.setContentDescription(settingsMode ? "Back to launcher" : "Open app settings");
        button.setOnClickListener(v -> action.run());
        bar.addView(button, new LinearLayout.LayoutParams(
                dp(activity, 44), dp(activity, 44)));

        View bottomRule = new View(activity);
        bottomRule.setBackgroundColor(accent);
        shell.addView(bottomRule, new LinearLayout.LayoutParams(-1, dp(activity, 2)));
        return shell;
    }
}
