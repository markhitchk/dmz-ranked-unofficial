package com.harleytg.dmzranked;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

/**
 * Native entry point for the multi-game hub.
 * The existing dmzranked.com client remains unchanged in MainActivity.
 */
public final class RankedHubActivity extends Activity {
    private static final int BACKGROUND = Color.rgb(8, 12, 19);
    private static final int PANEL = Color.rgb(21, 29, 40);
    private static final int PRIMARY = Color.rgb(245, 247, 251);
    private static final int SECONDARY = Color.rgb(174, 185, 199);

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(BACKGROUND);
        getWindow().setNavigationBarColor(BACKGROUND);

        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(BACKGROUND);

        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(dp(20), dp(28), dp(20), dp(24));
        scroll.addView(content);

        TextView eyebrow = label("HARLEY'S STUDIOS", 12, Color.rgb(255, 195, 89), true);
        eyebrow.setLetterSpacing(0.16f);
        content.addView(eyebrow);

        TextView heading = label("Ranked Hub", 34, PRIMARY, true);
        heading.setPadding(0, dp(12), 0, dp(8));
        content.addView(heading);

        TextView subtitle = label("Choose your battlefield. Each ranked game keeps its own profile, sessions and standings.", 15, SECONDARY, false);
        subtitle.setLineSpacing(dp(3), 1.0f);
        content.addView(subtitle);

        addSection(content, "HARLEY'S RANKED GAMES");
        addCard(content, "DMZ Ranked", "MW4 · V1", 
                "Our MW4 DMZ ranked experience, operator accounts and season standings.",
                Color.rgb(246, 182, 79),
                () -> openSite(RankedSiteActivity.SITE_DMZ_V1));
        addCard(content, "ARC Raiders Ranked", "ARC RAIDERS",
                "Our ARC Raiders leaderboard, rankings and player features.",
                Color.rgb(115, 201, 224),
                () -> openSite(RankedSiteActivity.SITE_ARC));

        addSection(content, "ORIGINAL COMMUNITY");
        addCard(content, "DMZRanked.com", "UNOFFICIAL CLIENT",
                "Open the existing DMZ Ranked community site using the original Android client.",
                Color.rgb(193, 208, 174),
                () -> startActivity(new Intent(this, MainActivity.class)));

        TextView footer = label("DMZRanked.com is a separate third-party project by YoLando and dCHINZ. Website ownership and trademarks remain with their respective owners.", 12, SECONDARY, false);
        footer.setPadding(0, dp(20), 0, 0);
        footer.setLineSpacing(dp(2), 1f);
        content.addView(footer);

        setContentView(scroll);
    }

    private void openSite(String siteId) {
        Intent intent = new Intent(this, RankedSiteActivity.class);
        intent.putExtra(RankedSiteActivity.EXTRA_SITE_ID, siteId);
        startActivity(intent);
    }

    private void addSection(LinearLayout content, String title) {
        TextView label = label(title, 12, SECONDARY, true);
        label.setLetterSpacing(0.12f);
        label.setPadding(0, dp(30), 0, dp(12));
        content.addView(label);
    }

    private void addCard(LinearLayout content, String title, String tag,
                         String description, int accentColor, Runnable action) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(20), dp(18), dp(20), dp(19));
        GradientDrawable background = new GradientDrawable();
        background.setColor(PANEL);
        background.setCornerRadius(dp(16));
        background.setStroke(dp(1), Color.rgb(57, 70, 84));
        card.setBackground(background);
        card.setClickable(true);
        card.setFocusable(true);
        card.setContentDescription("Open " + title);
        card.setOnClickListener(view -> action.run());

        TextView tagView = label(tag, 11, accentColor, true);
        tagView.setLetterSpacing(0.08f);
        card.addView(tagView);

        TextView titleView = label(title + "  ›", 23, PRIMARY, true);
        titleView.setPadding(0, dp(7), 0, dp(7));
        card.addView(titleView);

        TextView summary = label(description, 14, SECONDARY, false);
        summary.setLineSpacing(dp(2), 1f);
        card.addView(summary);

        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        params.bottomMargin = dp(13);
        content.addView(card, params);
    }

    private TextView label(String text, float size, int color, boolean bold) {
        TextView result = new TextView(this);
        result.setText(text);
        result.setTextSize(size);
        result.setTextColor(color);
        result.setGravity(Gravity.START | Gravity.CENTER_VERTICAL);
        if (bold) result.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        return result;
    }

    private int dp(float value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
