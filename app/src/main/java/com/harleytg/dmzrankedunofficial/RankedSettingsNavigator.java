package com.harleytg.dmzranked;

import android.app.Activity;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Ranked Hub Beta's screenshot-style Settings navigation. This controller does
 * not duplicate any Preferences, controls or Settings listeners: it only
 * presents category tiles and selects existing XML sections as subpages.
 *
 * The original DMZRanked.com stable app remains on its legacy Settings view.
 */
final class RankedSettingsNavigator {
    private static final String STATE_CATEGORY = "ranked_settings_category";
    private static final int BORDER = Color.rgb(60, 94, 110);
    private static final int SURFACE = Color.rgb(17, 31, 41);
    private static final int CYAN = Color.rgb(30, 207, 236);
    private static final int WHITE = Color.rgb(234, 243, 247);
    private static final int MUTED = Color.rgb(166, 187, 199);

    private static final int[] DETAIL_SECTIONS = {
        R.id.aboutCard,
        R.id.rankedDestinationsSection,
        R.id.appearanceSection,
        R.id.appExperienceSection,
        R.id.rankedBackupSection,
        R.id.operatorBackupSection,
        R.id.notificationsSection,
        R.id.widgetSection,
        R.id.updatesSection,
        R.id.pageActionsSection,
        R.id.dataTransferSection,
        R.id.betaProgramSection,
        R.id.helpSection,
        R.id.developerSection,
        R.id.dangerZoneSection
    };

    private static final class Category {
        final String key;
        final String title;
        final String subtitle;
        final int icon;
        final int[] sectionIds;

        Category(String key, String title, String subtitle, int icon, int... sectionIds) {
            this.key = key;
            this.title = title;
            this.subtitle = subtitle;
            this.icon = icon;
            this.sectionIds = sectionIds;
        }
        boolean hasSection(int value) {
            for(int id:sectionIds) if(id == value) return true;
            return false;
        }
    }

    private final Activity activity;
    private final int launcherTheme;
    private final LinearLayout overview;
    private final ScrollView scroll;
    private final EditText search;
    private final View intro;
    private final TextView scope;
    private final TextView description;
    private final Runnable refresh;
    private final List<Category> categories = new ArrayList<>();
    private String activeCategory = null;

    RankedSettingsNavigator(Activity activity, int launcherTheme, Runnable refresh) {
        this.activity = activity;
        this.launcherTheme = launcherTheme;
        this.refresh = refresh;
        overview = activity.findViewById(R.id.settingsCategoryOverview);
        scroll = activity.findViewById(R.id.settingsScroll);
        search = activity.findViewById(R.id.settingsSearch);
        intro = activity.findViewById(R.id.settingsIntroPanel);
        scope = activity.findViewById(R.id.settingsScopeText);
        description = activity.findViewById(R.id.settingsIntroDescription);
        setupCategories();
        createOverview();
    }

    private void setupCategories() {
        boolean hub = launcherTheme == RankedHeaderView.THEME_HUB;
        boolean community = launcherTheme == RankedHeaderView.THEME_COMMUNITY;

        // The two first-party websites own their sign-in pages. Only the Hub
        // and the original third-party client have native account/site controls.
        if(hub) {
            categories.add(new Category("games", "Ranked Games & Accounts",
                    "Choose MW4, ARC or the original community app; accounts stay separate",
                    android.R.drawable.ic_lock_lock,
                    R.id.rankedDestinationsSection));
        } else if(community) {
            categories.add(new Category("games", "Operator & Account",
                    "Community operator selection, sync and local operator backup",
                    android.R.drawable.ic_lock_lock,
                    R.id.operatorBackupSection));
        }
        categories.add(new Category("notifications", "Notifications",
                "Android alert permissions and notification tools",
                android.R.drawable.ic_dialog_email,
                R.id.notificationsSection));
        categories.add(new Category("appearance", "Appearance & Performance",
                "Content size, animations, motion, desktop view and loading behavior",
                android.R.drawable.ic_menu_manage,
                R.id.appearanceSection, R.id.appExperienceSection));
        if(community) {
            categories.add(new Category("widgets", "Home-screen Widget",
                    "Add and refresh the original DMZRanked.com widget",
                    android.R.drawable.ic_menu_view,
                    R.id.widgetSection));
        }
        categories.add(new Category("data", "Site Data & Backups",
                "Encrypted backups, transfers, cache and saved preferences",
                android.R.drawable.ic_menu_save,
                R.id.rankedBackupSection, R.id.pageActionsSection, R.id.dataTransferSection));
        categories.add(new Category("help", "Help & Support",
                "Bug reports, Discord links and Beta program",
                android.R.drawable.ic_menu_help,
                R.id.helpSection, R.id.betaProgramSection));
        categories.add(new Category("advanced", "Advanced & About",
                "Version, credits, updates, developer diagnostics and data reset",
                android.R.drawable.ic_menu_info_details,
                R.id.aboutCard, R.id.updatesSection, R.id.developerSection, R.id.dangerZoneSection));
    }

    private void createOverview() {
        overview.removeAllViews();
        for(Category category : categories) addCategoryCard(category);
        TextView footer = new TextView(activity);
        footer.setTextColor(MUTED);
        footer.setTextSize(11f);
        footer.setGravity(Gravity.CENTER);
        footer.setPadding(dp(6),dp(17),dp(6),dp(10));
        footer.setText(versionLabel());
        overview.addView(footer, new LinearLayout.LayoutParams(-1,-2));
    }

    private String versionLabel() {
        try {
            PackageInfo info = activity.getPackageManager()
                    .getPackageInfo(activity.getPackageName(),0);
            long code = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                    ? info.getLongVersionCode() : info.versionCode;
            return "Ranked Hub " + info.versionName + " · Build " + code;
        } catch (PackageManager.NameNotFoundException error) {
            return "Ranked Hub Beta";
        }
    }

    private void addCategoryCard(Category category) {
        LinearLayout row = new LinearLayout(activity);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setPadding(dp(17),dp(14),dp(13),dp(14));
        int minHeight = dp(92);
        row.setMinimumHeight(minHeight);
        GradientDrawable background = new GradientDrawable(
                GradientDrawable.Orientation.TL_BR,
                new int[]{Color.rgb(22,37,47), SURFACE});
        background.setCornerRadius(dp(19));
        background.setStroke(dp(1), BORDER);
        row.setBackground(background);
        row.setClickable(true);
        row.setFocusable(true);
        row.setContentDescription(category.title + ". " + category.subtitle + ". Open settings.");
        row.setOnClickListener(v -> openCategory(category.key));

        ImageView icon = new ImageView(activity);
        icon.setImageResource(category.icon);
        icon.setImageTintList(ColorStateList.valueOf(CYAN));
        icon.setScaleType(ImageView.ScaleType.FIT_CENTER);
        LinearLayout.LayoutParams iconParams = new LinearLayout.LayoutParams(dp(30),dp(30));
        iconParams.setMargins(dp(3),0,dp(17),0);
        row.addView(icon,iconParams);

        LinearLayout textColumn = new LinearLayout(activity);
        textColumn.setOrientation(LinearLayout.VERTICAL);
        textColumn.setGravity(Gravity.CENTER_VERTICAL);
        TextView title = new TextView(activity);
        title.setText(category.title);
        title.setTextColor(WHITE);
        title.setTextSize(17);
        title.setTypeface(null,android.graphics.Typeface.BOLD);
        title.setMaxLines(2);
        textColumn.addView(title);

        TextView subtitle = new TextView(activity);
        subtitle.setText(category.subtitle);
        subtitle.setTextColor(MUTED);
        subtitle.setTextSize(12.5f);
        subtitle.setMaxLines(2);
        subtitle.setPadding(0,dp(4),0,0);
        textColumn.addView(subtitle);
        row.addView(textColumn, new LinearLayout.LayoutParams(0,-2,1f));

        TextView chevron = new TextView(activity);
        chevron.setText("\u203a");
        chevron.setTextColor(CYAN);
        chevron.setTextSize(33);
        chevron.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams chevronParams =
                new LinearLayout.LayoutParams(dp(28),dp(44));
        chevronParams.setMargins(dp(8),0,0,0);
        row.addView(chevron,chevronParams);
        LinearLayout.LayoutParams cardParams = new LinearLayout.LayoutParams(-1,-2);
        cardParams.setMargins(0,0,0,dp(10));
        overview.addView(row, cardParams);
    }

    void openCategory(String category) {
        if(find(category) == null) return;
        activeCategory = category;
        search.setText("");
        updateChrome();
        refresh.run();
        scroll.post(() -> scroll.scrollTo(0,0));
    }

    private Category find(String key) {
        if(key == null) return null;
        for(Category candidate:categories) if(candidate.key.equals(key)) return candidate;
        return null;
    }

    boolean onBack() {
        if(activeCategory == null) return false;
        activeCategory = null;
        search.setText("");
        updateChrome();
        refresh.run();
        scroll.post(() -> scroll.scrollTo(0,0));
        return true;
    }

    void saveState(Bundle state) {
        if(activeCategory != null) state.putString(STATE_CATEGORY,activeCategory);
    }

    void restoreState(Bundle state) {
        if(state == null) return;
        String key = state.getString(STATE_CATEGORY);
        if(find(key) != null) activeCategory = key;
        updateChrome();
    }

    /** Called after the existing SettingsActivity filtering. Do not mutate
     * existing checkbox listeners, shared preferences, or site backup data.
     */
    void apply(String rawQuery) {
        String query = rawQuery == null ? "" : rawQuery.trim().toLowerCase(Locale.US);
        boolean overviewMode = activeCategory == null && query.isEmpty();
        overview.setVisibility(overviewMode ? View.VISIBLE : View.GONE);
        updateChrome();
        View empty = activity.findViewById(R.id.searchEmptyState);

        if(overviewMode) {
            for(int section : DETAIL_SECTIONS) {
                View item = activity.findViewById(section);
                if(item != null) item.setVisibility(View.GONE);
            }
            if(empty != null) empty.setVisibility(View.GONE);
            return;
        }

        // While searching from the category homepage, show the Settings
        // results across all valid categories. When inside a category, keep
        // the search scoped to that category's existing section controls.
        Category selected = find(activeCategory);
        if(selected != null) {
            for(int section : DETAIL_SECTIONS) {
                if(!selected.hasSection(section)) {
                    View item=activity.findViewById(section);
                    if(item != null) item.setVisibility(View.GONE);
                }
            }
        }
        boolean hasResult = false;
        for(int section : DETAIL_SECTIONS) {
            View item=activity.findViewById(section);
            if(item != null && item.getVisibility() == View.VISIBLE) {
                hasResult = true;
                break;
            }
        }
        if(empty != null) empty.setVisibility(hasResult ? View.GONE : View.VISIBLE);
    }

    private void updateChrome() {
        Category selected = find(activeCategory);
        intro.setVisibility(selected == null ? View.GONE : View.VISIBLE);
        if(selected == null) {
            search.setHint("Search settings...");
        } else {
            scope.setText(RankedSettingsStyler.pageTitleFor(launcherTheme)
                    + " / " + selected.title.toUpperCase(Locale.US));
            description.setText(selected.subtitle);
            search.setHint("Search " + selected.title + "...");
        }
    }

    private int dp(float value) {
        return Math.round(value * activity.getResources().getDisplayMetrics().density);
    }
}
