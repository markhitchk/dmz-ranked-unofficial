package com.harleytg.dmzranked;

import android.app.Activity;
import android.content.Context;
import android.graphics.Typeface;
import android.os.Build;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

/**
 * DMZ Ranked replacement for stock Android Toasts.
 *
 * Keeping the familiar Toast.makeText(...).show() call shape lets every existing
 * app notice use the same branded in-app presentation without scattering UI
 * styling across activities.
 */
public final class Toast {
    public static final int LENGTH_SHORT = 0;
    public static final int LENGTH_LONG = 1;

    private static final String VIEW_TAG = "dmz_ranked_custom_toast";

    private final Context context;
    private final CharSequence text;
    private final int duration;

    private Toast(Context context, CharSequence text, int duration) {
        this.context = context;
        this.text = text == null ? "" : text;
        this.duration = duration;
    }

    public static Toast makeText(Context context, CharSequence text, int duration) {
        return new Toast(context, text, duration);
    }

    public void show() {
        if (!(context instanceof Activity)) {
            android.widget.Toast.makeText(
                    context,
                    text,
                    duration == LENGTH_LONG
                            ? android.widget.Toast.LENGTH_LONG
                            : android.widget.Toast.LENGTH_SHORT
            ).show();
            return;
        }

        Activity activity = (Activity) context;
        activity.runOnUiThread(() -> showInActivity(activity));
    }

    private void showInActivity(Activity activity) {
        if (activity.isFinishing()
                || (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN_MR1
                && activity.isDestroyed())) {
            return;
        }

        View content = activity.findViewById(android.R.id.content);
        if (!(content instanceof ViewGroup)) return;
        ViewGroup root = (ViewGroup) content;

        View previous = root.findViewWithTag(VIEW_TAG);
        if (previous != null && previous.getParent() instanceof ViewGroup) {
            ((ViewGroup) previous.getParent()).removeView(previous);
        }

        LinearLayout card = new LinearLayout(activity);
        card.setTag(VIEW_TAG);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(activity, 18), dp(activity, 13), dp(activity, 18), dp(activity, 14));
        card.setBackgroundResource(R.drawable.dmz_dialog_background);
        card.setElevation(dp(activity, 12));
        card.setClickable(true);
        card.setFocusable(true);
        card.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);

        TextView eyebrow = new TextView(activity);
        eyebrow.setText("DMZ RANKED");
        eyebrow.setTextColor(activity.getColor(R.color.dmz_gold));
        eyebrow.setTextSize(10f);
        eyebrow.setTypeface(Typeface.DEFAULT_BOLD);
        eyebrow.setLetterSpacing(0.14f);
        card.addView(eyebrow, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT));

        TextView message = new TextView(activity);
        message.setText(text);
        message.setTextColor(activity.getColor(R.color.dmz_white));
        message.setTextSize(13.5f);
        message.setLineSpacing(0f, 1.08f);
        LinearLayout.LayoutParams messageParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT);
        messageParams.topMargin = dp(activity, 5);
        card.addView(message, messageParams);

        if (root instanceof FrameLayout) {
            FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.WRAP_CONTENT,
                    Gravity.BOTTOM);
            params.leftMargin = dp(activity, 16);
            params.rightMargin = dp(activity, 16);
            params.bottomMargin = dp(activity, 24);
            root.addView(card, params);
        } else {
            root.addView(card, new ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT));
        }

        card.setAlpha(0f);
        card.setTranslationY(dp(activity, 18));
        card.animate()
                .alpha(1f)
                .translationY(0f)
                .setDuration(170L)
                .start();

        Runnable dismiss = () -> {
            if (!(card.getParent() instanceof ViewGroup)) return;
            card.animate().cancel();
            card.animate()
                    .alpha(0f)
                    .translationY(dp(activity, 14))
                    .setDuration(150L)
                    .withEndAction(() -> {
                        if (card.getParent() instanceof ViewGroup) {
                            ((ViewGroup) card.getParent()).removeView(card);
                        }
                    })
                    .start();
        };

        card.setOnClickListener(v -> dismiss.run());
        card.postDelayed(
                dismiss,
                duration == LENGTH_LONG ? 4200L : 2700L
        );
    }

    private static int dp(Context context, int value) {
        return Math.round(value * context.getResources().getDisplayMetrics().density);
    }
}
