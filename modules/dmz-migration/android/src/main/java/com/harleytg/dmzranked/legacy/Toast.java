package com.harleytg.dmzranked.legacy;

import expo.modules.dmzmigration.R;
import android.content.Context;

/**
 * Thin wrapper around Android's native Toast so existing call sites can keep
 * using Toast.makeText(...).show() without custom in-app alert cards.
 */
public final class Toast {
    public static final int LENGTH_SHORT = android.widget.Toast.LENGTH_SHORT;
    public static final int LENGTH_LONG = android.widget.Toast.LENGTH_LONG;

    private final android.widget.Toast nativeToast;

    private Toast(android.widget.Toast nativeToast) {
        this.nativeToast = nativeToast;
    }

    public static Toast makeText(Context context, CharSequence text, int duration) {
        return new Toast(android.widget.Toast.makeText(context, text, duration));
    }

    public void show() {
        nativeToast.show();
    }

    public void cancel() {
        nativeToast.cancel();
    }
}
