package com.harleytg.dmzranked;

import android.app.Activity;
import android.content.Intent;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

/**
 * Harley's Studios' native, accessible multi-game launcher.
 * The independent dmzranked.com client is preserved in MainActivity.
 */
public final class RankedHubActivity extends Activity {
    private static final int BG = Color.rgb(8, 13, 20);
    private static final int SURFACE = Color.rgb(21, 29, 39);
    private static final int TEXT = Color.rgb(243, 248, 248);
    private static final int MUTED = Color.rgb(174, 188, 196);
    private static final int AMBER = Color.rgb(246, 191, 98);
    private static final int CYAN = Color.rgb(113, 212, 221);
    private static final int SAGE = Color.rgb(178, 198, 187);

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(BG);
        getWindow().setNavigationBarColor(BG);
        getWindow().getDecorView().setSystemUiVisibility(0);

        FrameLayout root = new FrameLayout(this);
        root.setBackground(gradient(new int[]{Color.rgb(16, 30, 37), BG, BG},
                0, 0, GradientDrawable.Orientation.TL_BR));

        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setClipToPadding(false);
        scroll.setVerticalScrollBarEnabled(false);

        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(dp(18), dp(22), dp(18), dp(32));
        scroll.addView(content);
        root.addView(scroll);

        addBrand(content);
        addHero(content);
        addSection(content, "SELECT AN OPERATION", "02  /  HARLEY'S STUDIOS");
        addOperation(content, "01", "DMZ RANKED", "MW4  /  V1",
                "Deploy to your DMZ season, operator profile, raid reporting and standings.",
                "DMZ", AMBER, Color.rgb(47, 39, 24), 
                () -> openSite(RankedSiteActivity.SITE_DMZ_V1));
        addOperation(content, "02", "ARC RAIDERS RANKED", "EXTRACTION  /  RANKED",
                "Review your raider, report extractions and climb the community rankings.",
                "ARC", CYAN, Color.rgb(17, 49, 60),
                () -> openSite(RankedSiteActivity.SITE_ARC));

        addSection(content, "COMMUNITY OPERATIONS", "01  /  EXTERNAL PARTNER");
        addOperation(content, "03", "DMZRANKED.COM", "ORIGINAL  /  UNOFFICIAL",
                "The original community DMZ Ranked experience and its existing Android tools.",
                "DMZ", SAGE, Color.rgb(31, 43, 39),
                () -> startActivity(new Intent(this, MainActivity.class)));

        TextView attribution = label(
                "BUILT BY HARLEY'S STUDIOS  •  UNOFFICIAL COMPANION\n"
                + "Original DMZRanked.com created by YoLando & dCHINZ. "
                + "Each ranked experience keeps separate accounts and standings.",
                11, MUTED, false);
        attribution.setLineSpacing(dp(4), 1f);
        attribution.setPadding(dp(4), dp(15), dp(4), 0);
        content.addView(attribution);

        setContentView(root);
        RankedSafeArea.apply(root);
    }

    private void addBrand(LinearLayout parent) {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);

        // Official Harley's Studios logo, byte-identical to the Puppy Clicker
        // source PNG and packaged inside the APK for offline availability.
        ImageView studioLogo = new ImageView(this);
        studioLogo.setImageResource(R.drawable.harleys_studios_official);
        studioLogo.setScaleType(ImageView.ScaleType.FIT_CENTER);
        studioLogo.setAdjustViewBounds(true);
        studioLogo.setContentDescription("Harley's Studios official logo");
        row.addView(studioLogo, new LinearLayout.LayoutParams(dp(78), dp(78)));

        LinearLayout copy = new LinearLayout(this);
        copy.setOrientation(LinearLayout.VERTICAL);
        LinearLayout.LayoutParams copyParams = new LinearLayout.LayoutParams(0,
                LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
        copyParams.leftMargin = dp(12);
        TextView brand = label("HARLEY'S STUDIOS", 15, TEXT, true);
        brand.setLetterSpacing(0.11f);
        copy.addView(brand);
        TextView sub = label("RANKED NETWORK  /  ANDROID", 10, MUTED, true);
        sub.setLetterSpacing(0.09f);
        sub.setPadding(0, dp(4), 0, 0);
        copy.addView(sub);
        row.addView(copy, copyParams);

        TextView version = label("HUB  /  01", 10, AMBER, true);
        version.setLetterSpacing(0.08f);
        version.setPadding(dp(10), dp(8), dp(10), dp(8));
        version.setBackground(rounded(Color.rgb(35, 42, 46),
                Color.rgb(80, 82, 71), dp(1), dp(8)));
        row.addView(version);
        parent.addView(row);
    }

    private void addHero(LinearLayout parent) {
        LinearLayout hero = new LinearLayout(this);
        hero.setOrientation(LinearLayout.VERTICAL);
        hero.setPadding(dp(19), dp(22), dp(19), dp(20));
        hero.setBackground(gradient(new int[]{Color.rgb(41, 54, 59), Color.rgb(20, 33, 42)},
                Color.rgb(89, 107, 112), dp(1), GradientDrawable.Orientation.TL_BR));
        hero.setClipToOutline(true);

        TextView eyebrow = label("OPERATIONS CENTER  //  ALL SYSTEMS READY", 10, AMBER, true);
        eyebrow.setLetterSpacing(0.11f);
        hero.addView(eyebrow);

        TextView heading = label("ONE HUB.\nTHREE BATTLEFIELDS.", 29, TEXT, true);
        heading.setLineSpacing(dp(1), 1f);
        heading.setPadding(0, dp(14), 0, dp(9));
        hero.addView(heading);

        TextView details = label(
                "Choose a game to enter its own ranked interface. "
                + "Your player data stays with that game.",
                14, MUTED, false);
        details.setLineSpacing(dp(3), 1f);
        hero.addView(details);

        View divider = new View(this);
        divider.setBackgroundColor(Color.rgb(80, 94, 98));
        LinearLayout.LayoutParams dividerParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(1));
        dividerParams.topMargin = dp(19);
        dividerParams.bottomMargin = dp(14);
        hero.addView(divider, dividerParams);

        LinearLayout stats = new LinearLayout(this);
        stats.setOrientation(LinearLayout.HORIZONTAL);
        addStat(stats, "03", "DESTINATIONS");
        addStat(stats, "02", "OUR GAMES");
        addStat(stats, "01", "COMMUNITY");
        hero.addView(stats);

        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT);
        params.topMargin = dp(25);
        parent.addView(hero, params);
    }

    private void addStat(LinearLayout stats, String value, String caption) {
        LinearLayout column = new LinearLayout(this);
        column.setOrientation(LinearLayout.VERTICAL);
        TextView number = label(value, 19, TEXT, true);
        column.addView(number);
        TextView name = label(caption, 9, MUTED, true);
        name.setLetterSpacing(0.06f);
        name.setPadding(0, dp(4), 0, 0);
        column.addView(name);
        stats.addView(column, new LinearLayout.LayoutParams(0,
                LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
    }

    private void addSection(LinearLayout parent, String heading, String count) {
        LinearLayout row = new LinearLayout(this);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setOrientation(LinearLayout.HORIZONTAL);
        TextView left = label(heading, 11, TEXT, true);
        left.setLetterSpacing(0.09f);
        row.addView(left, new LinearLayout.LayoutParams(0,
                LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
        TextView right = label(count, 10, MUTED, true);
        row.addView(right);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT);
        params.topMargin = dp(28);
        params.bottomMargin = dp(12);
        parent.addView(row, params);
    }

    private void addOperation(LinearLayout parent, String number, String heading,
                              String type, String description, String mark,
                              int accent, int emblemBackground, Runnable action) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(16), dp(16), dp(16), dp(14));
        card.setBackground(gradient(new int[]{Color.rgb(34, 45, 54), SURFACE},
                Color.rgb(73, 91, 100), dp(1), GradientDrawable.Orientation.TL_BR));
        card.setClipToOutline(true);
        card.setClickable(true);
        card.setFocusable(true);
        card.setContentDescription("Open " + heading + ", " + type);
        card.setOnClickListener(view -> action.run());

        LinearLayout top = new LinearLayout(this);
        top.setOrientation(LinearLayout.HORIZONTAL);
        top.setGravity(Gravity.CENTER_VERTICAL);

        TextView emblem = label(mark, mark.length() > 2 ? 16 : 20, accent, true);
        emblem.setGravity(Gravity.CENTER);
        emblem.setBackground(rounded(emblemBackground, accent, dp(1), dp(11)));
        top.addView(emblem, new LinearLayout.LayoutParams(dp(58), dp(58)));

        LinearLayout titles = new LinearLayout(this);
        titles.setOrientation(LinearLayout.VERTICAL);
        LinearLayout.LayoutParams tp = new LinearLayout.LayoutParams(
                0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
        tp.leftMargin = dp(12);
        TextView sub = label(type, 10, accent, true);
        sub.setLetterSpacing(0.10f);
        titles.addView(sub);
        TextView title = label(heading, 21, TEXT, true);
        title.setPadding(0, dp(4), 0, 0);
        titles.addView(title);
        top.addView(titles, tp);

        TextView arrow = label("↗", 24, accent, true);
        arrow.setGravity(Gravity.CENTER);
        top.addView(arrow, new LinearLayout.LayoutParams(dp(32), dp(48)));
        card.addView(top);

        TextView desc = label(description, 13, MUTED, false);
        desc.setLineSpacing(dp(3), 1f);
        desc.setPadding(0, dp(14), dp(2), dp(13));
        card.addView(desc);

        LinearLayout footer = new LinearLayout(this);
        footer.setOrientation(LinearLayout.HORIZONTAL);
        footer.setGravity(Gravity.CENTER_VERTICAL);
        TextView index = label("OPERATION  " + number + "  /  03", 10, MUTED, true);
        index.setLetterSpacing(0.07f);
        footer.addView(index, new LinearLayout.LayoutParams(0,
                LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
        TextView enter = label("ENTER OPERATION   ›", 11, accent, true);
        enter.setLetterSpacing(0.05f);
        footer.addView(enter);
        card.addView(footer);

        LinearLayout.LayoutParams cp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT);
        cp.bottomMargin = dp(11);
        parent.addView(card, cp);
    }

    private void openSite(String id) {
        Intent intent = new Intent(this, RankedSiteActivity.class);
        intent.putExtra(RankedSiteActivity.EXTRA_SITE_ID, id);
        startActivity(intent);
    }

    private GradientDrawable rounded(int color, int strokeColor,
                                     int stroke, int radius) {
        GradientDrawable shape = new GradientDrawable();
        shape.setColor(color);
        shape.setCornerRadius(radius);
        if (stroke > 0) shape.setStroke(stroke, strokeColor);
        return shape;
    }

    private GradientDrawable gradient(int[] colors, int strokeColor, int stroke,
                                      GradientDrawable.Orientation direction) {
        GradientDrawable shape = new GradientDrawable(direction, colors);
        shape.setCornerRadius(dp(15));
        if (stroke > 0) shape.setStroke(stroke, strokeColor);
        return shape;
    }

    private TextView label(String value, int size, int color, boolean bold) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(size);
        view.setTextColor(color);
        if (bold) view.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        return view;
    }

    private int dp(float size) {
        return Math.round(size * getResources().getDisplayMetrics().density);
    }
}
