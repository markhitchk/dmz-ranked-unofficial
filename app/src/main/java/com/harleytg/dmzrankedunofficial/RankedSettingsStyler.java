package com.harleytg.dmzranked;

import android.app.Activity;
import android.content.res.ColorStateList;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.RippleDrawable;
import android.view.View;
import android.view.ViewGroup;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.Switch;
import android.widget.TextView;

import java.io.InputStream;

/**
 * Presentation-only settings styling. Existing setting IDs, listeners, saved
 * preferences, search, developer access and update flows are unchanged.
 */
final class RankedSettingsStyler {
    private static final int TEXT = Color.rgb(242, 248, 249);
    private static final int MUTED = Color.rgb(172, 191, 204);
    private static final int BG = Color.rgb(6, 16, 25);

    private RankedSettingsStyler() { }

    static int accentFor(int theme) {
        if (theme == RankedHeaderView.THEME_DMZ_V1) return Color.parseColor("#F4C15F");
        if (theme == RankedHeaderView.THEME_ARC) return Color.parseColor("#62D8E5");
        if (theme == RankedHeaderView.THEME_COMMUNITY) return Color.parseColor("#B6C695");
        return Color.parseColor("#33D4E7");
    }

    static String pageTitleFor(int theme) {
        if (theme == RankedHeaderView.THEME_DMZ_V1) return "DMZ RANKED V1";
        if (theme == RankedHeaderView.THEME_ARC) return "ARC RAIDERS RANKED";
        if (theme == RankedHeaderView.THEME_COMMUNITY) return "DMZRANKED.COM";
        return "RANKED HUB";
    }

    static void apply(Activity activity, int theme) {
        int accent = accentFor(theme);
        View root = activity.findViewById(R.id.settingsRoot);
        if (root == null) return;
        GradientDrawable background = new GradientDrawable(
                GradientDrawable.Orientation.TL_BR,
                new int[]{Color.rgb(14, 34, 47), BG, BG});
        root.setBackground(background);
        styleViews(activity, root, theme, accent);

        // Keep the Settings search box inset like the launcher grid cards.
        EditText search = activity.findViewById(R.id.settingsSearch);
        if (search != null) {
            search.setBackground(panel(activity, accent, false, false));
            search.setCompoundDrawableTintList(ColorStateList.valueOf(MUTED));
            int h = dp(activity, 14), v = dp(activity, 11);
            search.setPadding(h, v, h, v);
        }
    }

    static void applyAboutLogo(Activity activity, int theme) {
        ImageView about = activity.findViewById(R.id.aboutLogo);
        if (about == null) return;
        if (theme == RankedHeaderView.THEME_HUB) {
            try (InputStream stream = activity.getAssets()
                    .open("ranked-hub/ranked-hub-selected.webp")) {
                about.setImageBitmap(BitmapFactory.decodeStream(stream));
            } catch (Exception ignored) {
                about.setImageResource(R.drawable.harleys_studios_official);
            }
        } else if (theme == RankedHeaderView.THEME_DMZ_V1) {
            try (InputStream stream = activity.getAssets()
                    .open("ranked-hub/dmz-v1-discord.webp")) {
                about.setImageBitmap(BitmapFactory.decodeStream(stream));
            } catch (Exception ignored) {
                // The original DMZ app artwork remains the fallback.
            }
        } else if (theme == RankedHeaderView.THEME_ARC) {
            try (InputStream stream = activity.getAssets()
                    .open("ranked-hub/arc-ranked.webp")) {
                about.setImageBitmap(BitmapFactory.decodeStream(stream));
            } catch (Exception ignored) {
                // Original DMZ logo stays visible if the ARC logo cannot decode.
            }
        } // Original DMZRanked.com keeps its own independent logo.
    }

    private static void styleViews(Activity activity, View view, int theme, int accent) {
        String entry = "";
        if (view.getId() != View.NO_ID) {
            try {
                entry = activity.getResources().getResourceEntryName(view.getId());
            } catch (Exception ignored) { }
        }

        if (entry.endsWith("Card") && view instanceof ViewGroup) {
            boolean danger = "clearDataCard".equals(entry) || "resetSettingsCard".equals(entry);
            boolean prominent = "aboutCard".equals(entry);
            view.setBackground(panel(activity, accent, danger, prominent));
            if (view.isClickable()) {
                view.setBackground(new RippleDrawable(
                        ColorStateList.valueOf(Color.argb(46, 255, 255, 255)),
                        view.getBackground(), null));
            }
        }

        if (view instanceof TextView) {
            TextView text = (TextView) view;
            int current = text.getCurrentTextColor();
            if (current == activity.getColor(R.color.dmz_gold)
                    || current == activity.getColor(R.color.dmz_gold_dark)
                    || current == activity.getColor(R.color.dmz_gold_soft)) {
                text.setTextColor(accent);
            } else if (current == activity.getColor(R.color.dmz_white)) {
                text.setTextColor(TEXT);
            } else if (current == activity.getColor(R.color.dmz_muted)) {
                text.setTextColor(MUTED);
            }

            if (entry.equals("settingsScopeText")) {
                text.setTextColor(accent);
            }
        }

        if (view instanceof Switch) {
            Switch toggle = (Switch) view;
            int[][] states = new int[][]{
                    new int[]{android.R.attr.state_checked},
                    new int[]{} };
            toggle.setThumbTintList(new ColorStateList(states, new int[]{
                    accent, Color.rgb(191, 204, 211)}));
            toggle.setTrackTintList(new ColorStateList(states, new int[]{
                    Color.argb(142, Color.red(accent), Color.green(accent), Color.blue(accent)),
                    Color.rgb(72, 91, 105)}));
        }

        // The existing red Danger Zone continues to be explicitly distinguished.
        if ("dangerZoneSection".equals(entry)) {
            view.setContentDescription("Danger Zone settings");
        }

        if (view instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) view;
            for (int i = 0; i < group.getChildCount(); i++) {
                styleViews(activity, group.getChildAt(i), theme, accent);
            }
        }
    }

    private static GradientDrawable panel(Activity activity, int accent,
                                          boolean danger, boolean prominent) {
        int edge = danger ? Color.rgb(189, 86, 93)
                : prominent ? withAlpha(accent, 180) : Color.rgb(62, 95, 111);
        GradientDrawable drawable = new GradientDrawable(
                GradientDrawable.Orientation.TL_BR,
                danger ? new int[]{Color.rgb(47, 28, 34), Color.rgb(23, 25, 33)}
                       : prominent ? new int[]{Color.rgb(35, 55, 66), Color.rgb(15, 29, 41)}
                                   : new int[]{Color.rgb(24, 43, 56), Color.rgb(14, 29, 40)});
        drawable.setCornerRadius(dp(activity, prominent ? 16 : 13));
        drawable.setStroke(dp(activity, 1), edge);
        return drawable;
    }

    private static int withAlpha(int color, int alpha) {
        return Color.argb(alpha, Color.red(color), Color.green(color), Color.blue(color));
    }

    private static int dp(Activity activity, int value) {
        return Math.max(1, Math.round(value * activity.getResources()
                .getDisplayMetrics().density));
    }
}
