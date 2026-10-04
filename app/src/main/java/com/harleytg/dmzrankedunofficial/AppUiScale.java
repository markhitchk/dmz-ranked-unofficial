package com.harleytg.dmzranked;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.res.Configuration;

final class AppUiScale {
    private static final String PREFS = "dmz_ranked_settings";
    private static final String PREF_CONTENT_SIZE = "content_size";

    private AppUiScale() {}

    static Context wrap(Context base) {
        if (base == null) return null;
        try {
            SharedPreferences preferences =
                    base.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            String size = preferences.getString(PREF_CONTENT_SIZE, "standard");

            float factor = 1.0f;
            if ("compact".equals(size)) factor = 0.88f;
            else if ("large".equals(size)) factor = 1.12f;

            if (factor == 1.0f) return base;

            Configuration configuration =
                    new Configuration(base.getResources().getConfiguration());
            int originalDpi = configuration.densityDpi;
            if (originalDpi <= 0) originalDpi = 160;
            configuration.densityDpi = Math.max(
                    120,
                    Math.min(640, Math.round(originalDpi * factor)));
            return base.createConfigurationContext(configuration);
        } catch (Throwable ignored) {
            return base;
        }
    }
}
