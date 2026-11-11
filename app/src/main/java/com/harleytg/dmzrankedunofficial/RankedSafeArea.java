package com.harleytg.dmzranked;

import android.graphics.Insets;
import android.os.Build;
import android.view.View;
import android.view.WindowInsets;

/**
 * Keep native controls and embedded ranked websites out of Android 15/16
 * edge-to-edge system bars and display cutouts. The inset is applied to the
 * root, so WebView gets the remaining, physically usable viewport.
 */
final class RankedSafeArea {
    private RankedSafeArea() {}

    static void apply(View root) {
        final int startLeft = root.getPaddingLeft();
        final int startTop = root.getPaddingTop();
        final int startRight = root.getPaddingRight();
        final int startBottom = root.getPaddingBottom();

        root.setOnApplyWindowInsetsListener((view, windowInsets) -> {
            int left, top, right, bottom;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                Insets safe = windowInsets.getInsets(
                        WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                left = safe.left;
                top = safe.top;
                right = safe.right;
                bottom = safe.bottom;
            } else {
                left = windowInsets.getSystemWindowInsetLeft();
                top = windowInsets.getSystemWindowInsetTop();
                right = windowInsets.getSystemWindowInsetRight();
                bottom = windowInsets.getSystemWindowInsetBottom();
            }
            view.setPadding(startLeft + left, startTop + top,
                    startRight + right, startBottom + bottom);
            // Do not consume: other windows (IME / native dialog) still need insets.
            return windowInsets;
        });
        root.requestApplyInsets();
    }
}
