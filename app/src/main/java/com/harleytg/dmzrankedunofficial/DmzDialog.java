package com.harleytg.dmzranked;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.SharedPreferences;
import android.content.res.ColorStateList;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.text.InputFilter;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

/**
 * Shared DMZ Ranked modal UI.
 *
 * All app-owned dialogs use the same card, typography, gold accents and motion.
 * Android still supplies the window host, but no stock AlertDialog title/message
 * or button chrome is exposed to the user.
 */
public final class DmzDialog {
    public interface InputCallback {
        /** Return true to close the dialog, false to leave it open. */
        boolean onSubmit(String value, EditText input);
    }

    public interface ChoiceCallback {
        void onChoice(int index, String value);
    }

    private DmzDialog() {
    }

    public static AlertDialog alert(
            Activity activity,
            String title,
            String message,
            String buttonLabel,
            Runnable onConfirm,
            Runnable onCancel) {
        return confirm(
                activity,
                "DMZ RANKED",
                title,
                message,
                buttonLabel,
                null,
                false,
                onConfirm,
                onCancel);
    }

    public static AlertDialog confirm(
            Activity activity,
            String title,
            String message,
            String positiveLabel,
            String negativeLabel,
            boolean danger,
            Runnable onPositive) {
        return confirm(
                activity,
                danger ? "DANGER ZONE" : "DMZ RANKED",
                title,
                message,
                positiveLabel,
                negativeLabel,
                danger,
                onPositive,
                null);
    }

    public static AlertDialog confirm(
            Activity activity,
            String eyebrowText,
            String title,
            String message,
            String positiveLabel,
            String negativeLabel,
            boolean danger,
            Runnable onPositive,
            Runnable onNegative) {
        LinearLayout card = buildCard(activity, eyebrowText, title, message, danger);

        if (danger) {
            LinearLayout warningPanel = new LinearLayout(activity);
            warningPanel.setOrientation(LinearLayout.VERTICAL);
            warningPanel.setPadding(
                    dp(activity, 14),
                    dp(activity, 11),
                    dp(activity, 14),
                    dp(activity, 12));

            GradientDrawable warningBackground = new GradientDrawable();
            warningBackground.setColor(activity.getColor(R.color.dmz_panel_deep));
            warningBackground.setStroke(dp(activity, 1), activity.getColor(R.color.dmz_red));
            warningBackground.setCornerRadius(dp(activity, 10));
            warningPanel.setBackground(warningBackground);

            TextView warningTitle = new TextView(activity);
            warningTitle.setText("⚠  REVIEW BEFORE CONTINUING");
            warningTitle.setTextColor(activity.getColor(R.color.dmz_red));
            warningTitle.setTextSize(11f);
            warningTitle.setTypeface(Typeface.DEFAULT_BOLD);
            warningTitle.setLetterSpacing(0.08f);
            warningPanel.addView(warningTitle, new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT));

            TextView warningBody = new TextView(activity);
            warningBody.setText(
                    "This is a destructive action. Data or settings affected by it may not be recoverable.");
            warningBody.setTextColor(activity.getColor(R.color.dmz_white));
            warningBody.setTextSize(12.5f);
            warningBody.setLineSpacing(0f, 1.10f);
            LinearLayout.LayoutParams warningBodyParams = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT);
            warningBodyParams.topMargin = dp(activity, 5);
            warningPanel.addView(warningBody, warningBodyParams);

            LinearLayout.LayoutParams warningParams = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT);
            warningParams.topMargin = dp(activity, 13);
            card.addView(warningPanel, warningParams);
        }

        LinearLayout actions = buildActionRow(activity);
        TextView negative = null;
        if (negativeLabel != null && !negativeLabel.trim().isEmpty()) {
            negative = buildAction(activity, negativeLabel, false, false);
            actions.addView(negative, weightedParams(activity, false));
        }

        TextView positive = buildAction(activity, positiveLabel, true, danger);
        actions.addView(positive, weightedParams(activity, negative != null));

        card.addView(actions, actionRowParams(activity));
        AlertDialog dialog = present(activity, card, false);

        if (negative != null) {
            TextView finalNegative = negative;
            finalNegative.setOnClickListener(v -> {
                dialog.dismiss();
                if (onNegative != null) onNegative.run();
            });
        }

        positive.setOnClickListener(v -> {
            dialog.dismiss();
            if (onPositive != null) onPositive.run();
        });

        if (onNegative != null) {
            dialog.setOnCancelListener(ignored -> onNegative.run());
        }
        return dialog;
    }

    public static AlertDialog input(
            Activity activity,
            String title,
            String message,
            String hint,
            int inputType,
            int maxLength,
            String positiveLabel,
            String negativeLabel,
            InputCallback onSubmit,
            Runnable onCancel) {
        LinearLayout card = buildCard(activity, "DMZ RANKED", title, message, false);

        EditText input = new EditText(activity);
        input.setSingleLine(true);
        input.setHint(hint);
        input.setInputType(inputType);
        if (maxLength > 0) {
            input.setFilters(new InputFilter[]{new InputFilter.LengthFilter(maxLength)});
        }
        input.setTextColor(activity.getColor(R.color.dmz_white));
        input.setHintTextColor(activity.getColor(R.color.dmz_muted));
        input.setBackgroundTintList(ColorStateList.valueOf(activity.getColor(R.color.dmz_gold)));
        input.setPadding(dp(activity, 10), dp(activity, 9), dp(activity, 10), dp(activity, 9));
        LinearLayout.LayoutParams inputParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT);
        inputParams.topMargin = dp(activity, 14);
        card.addView(input, inputParams);

        LinearLayout actions = buildActionRow(activity);
        TextView negative = buildAction(activity, negativeLabel, false, false);
        TextView positive = buildAction(activity, positiveLabel, true, false);
        actions.addView(negative, weightedParams(activity, false));
        actions.addView(positive, weightedParams(activity, true));
        card.addView(actions, actionRowParams(activity));

        AlertDialog dialog = present(activity, card, true);

        negative.setOnClickListener(v -> {
            dialog.dismiss();
            if (onCancel != null) onCancel.run();
        });
        positive.setOnClickListener(v -> {
            String value = input.getText() == null ? "" : input.getText().toString();
            boolean dismiss = onSubmit == null || onSubmit.onSubmit(value, input);
            if (dismiss) dialog.dismiss();
        });
        if (onCancel != null) {
            dialog.setOnCancelListener(ignored -> onCancel.run());
        }

        input.requestFocus();
        return dialog;
    }

    public static AlertDialog singleChoice(
            Activity activity,
            String title,
            String message,
            String[] items,
            int checkedIndex,
            String negativeLabel,
            ChoiceCallback onChoice) {
        LinearLayout card = buildCard(activity, "PROFILE SELECTION", title, message, false);
        addTapeHeader(
                activity,
                card,
                activity.getColor(R.color.dmz_gold),
                "OPERATOR PICKER  •  DMZ RANKED",
                false);

        LinearLayout choices = new LinearLayout(activity);
        choices.setOrientation(LinearLayout.VERTICAL);
        LinearLayout.LayoutParams choicesParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT);
        choicesParams.topMargin = dp(activity, 12);
        card.addView(choices, choicesParams);

        final AlertDialog[] holder = new AlertDialog[1];
        for (int i = 0; i < items.length; i++) {
            final int index = i;
            String value = items[i] == null ? "" : items[i];

            TextView row = new TextView(activity);
            row.setText((i == checkedIndex ? "●  " : "○  ") + value);
            row.setTextColor(i == checkedIndex
                    ? activity.getColor(R.color.dmz_gold)
                    : activity.getColor(R.color.dmz_white));
            row.setTextSize(14f);
            row.setTypeface(i == checkedIndex ? Typeface.DEFAULT_BOLD : Typeface.DEFAULT);
            row.setGravity(Gravity.CENTER_VERTICAL);
            row.setPadding(dp(activity, 14), dp(activity, 13), dp(activity, 14), dp(activity, 13));
            row.setBackgroundResource(i == checkedIndex
                    ? R.drawable.operator_selected_background
                    : R.drawable.settings_action_background);
            row.setClickable(true);
            row.setFocusable(true);

            LinearLayout.LayoutParams rowParams = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT);
            if (i > 0) rowParams.topMargin = dp(activity, 8);
            choices.addView(row, rowParams);

            row.setOnClickListener(v -> {
                if (onChoice != null) onChoice.onChoice(index, value);
                if (holder[0] != null) holder[0].dismiss();
            });
        }

        LinearLayout actions = buildActionRow(activity);
        TextView negative = buildAction(activity, negativeLabel, false, false);
        actions.addView(negative, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT));
        card.addView(actions, actionRowParams(activity));

        AlertDialog dialog = present(activity, card, false);
        holder[0] = dialog;
        negative.setOnClickListener(v -> dialog.dismiss());
        return dialog;
    }

    private static LinearLayout buildCard(
            Activity activity,
            String eyebrowText,
            String title,
            String message,
            boolean danger) {
        LinearLayout card = new LinearLayout(activity);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(activity, 22), dp(activity, 20), dp(activity, 22), dp(activity, 18));
        card.setBackgroundResource(danger
                ? R.drawable.danger_dialog_background
                : R.drawable.dmz_dialog_background);

        if (danger) {
            addTapeHeader(
                    activity,
                    card,
                    activity.getColor(R.color.dmz_red),
                    "⚠  DANGER ZONE  •  CAUTION",
                    true);
        }

        TextView eyebrow = new TextView(activity);
        eyebrow.setText(danger
                ? "DESTRUCTIVE ACTION"
                : (eyebrowText == null ? "DMZ RANKED" : eyebrowText));
        eyebrow.setTextColor(activity.getColor(danger ? R.color.dmz_red : R.color.dmz_gold));
        eyebrow.setTextSize(10.5f);
        eyebrow.setTypeface(Typeface.DEFAULT_BOLD);
        eyebrow.setLetterSpacing(0.15f);
        LinearLayout.LayoutParams eyebrowParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT);
        if (danger) eyebrowParams.topMargin = dp(activity, 14);
        card.addView(eyebrow, eyebrowParams);

        TextView heading = new TextView(activity);
        heading.setText(title == null ? "" : title);
        heading.setTextColor(activity.getColor(R.color.dmz_white));
        heading.setTextSize(21f);
        heading.setTypeface(Typeface.create("sans-serif-condensed", Typeface.BOLD));
        LinearLayout.LayoutParams headingParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT);
        headingParams.topMargin = dp(activity, 7);
        card.addView(heading, headingParams);

        if (message != null && !message.trim().isEmpty()) {
            TextView body = new TextView(activity);
            body.setText(message);
            body.setTextColor(activity.getColor(R.color.dmz_muted));
            body.setTextSize(13.5f);
            body.setLineSpacing(0f, 1.12f);
            LinearLayout.LayoutParams bodyParams = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT);
            bodyParams.topMargin = dp(activity, 9);
            card.addView(body, bodyParams);
        }

        return card;
    }

    private static LinearLayout buildActionRow(Activity activity) {
        LinearLayout actions = new LinearLayout(activity);
        actions.setOrientation(LinearLayout.HORIZONTAL);
        actions.setGravity(Gravity.CENTER_VERTICAL);
        return actions;
    }

    private static LinearLayout.LayoutParams actionRowParams(Activity activity) {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT);
        params.topMargin = dp(activity, 18);
        return params;
    }

    private static LinearLayout.LayoutParams weightedParams(Activity activity, boolean withLeftMargin) {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                0,
                LinearLayout.LayoutParams.WRAP_CONTENT,
                1f);
        if (withLeftMargin) params.leftMargin = dp(activity, 10);
        return params;
    }

    private static TextView buildAction(
            Activity activity,
            String label,
            boolean primary,
            boolean danger) {
        TextView action = new TextView(activity);
        action.setText(label == null ? "OK" : label);
        action.setGravity(Gravity.CENTER);
        action.setPadding(dp(activity, 12), dp(activity, 11), dp(activity, 12), dp(activity, 11));
        action.setTextSize(11f);
        action.setTypeface(Typeface.DEFAULT_BOLD);
        action.setClickable(true);
        action.setFocusable(true);

        if (danger && primary) {
            action.setTextColor(activity.getColor(R.color.dmz_white));
            action.setBackgroundResource(R.drawable.settings_danger_button_background);
        } else if (primary) {
            action.setTextColor(activity.getColor(R.color.dmz_black));
            action.setBackgroundResource(R.drawable.dmz_gold_button);
        } else {
            action.setTextColor(activity.getColor(R.color.dmz_muted));
            action.setBackgroundResource(R.drawable.settings_action_background);
        }
        return action;
    }

    private static AlertDialog present(Activity activity, View card, boolean showKeyboard) {
        AlertDialog dialog = new AlertDialog.Builder(activity)
                .setView(card)
                .create();

        dialog.setOnShowListener(ignored -> {
            Window window = dialog.getWindow();
            if (window != null) {
                window.setBackgroundDrawableResource(android.R.color.transparent);
                int width = Math.min(
                        activity.getResources().getDisplayMetrics().widthPixels - dp(activity, 32),
                        dp(activity, 460));
                window.setLayout(width, ViewGroup.LayoutParams.WRAP_CONTENT);
                window.addFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND);
                WindowManager.LayoutParams params = window.getAttributes();
                params.dimAmount = 0.72f;
                window.setAttributes(params);
                if (showKeyboard) {
                    window.setSoftInputMode(
                            WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE
                                    | WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_VISIBLE);
                }
            }

            SharedPreferences prefs = activity.getSharedPreferences(
                    "dmz_ranked_settings",
                    Activity.MODE_PRIVATE);
            if (prefs.getBoolean("app_animations", true)) {
                card.setAlpha(0f);
                card.setScaleX(0.96f);
                card.setScaleY(0.96f);
                card.animate()
                        .alpha(1f)
                        .scaleX(1f)
                        .scaleY(1f)
                        .setDuration(180L)
                        .start();
            }
        });

        dialog.show();
        return dialog;
    }

    private static void addTapeHeader(
            Activity activity,
            LinearLayout card,
            int baseColor,
            String label,
            boolean dangerSpacing) {
        FrameLayout header = new FrameLayout(activity);
        TapeView tape = new TapeView(activity, baseColor);
        header.addView(tape, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                dp(activity, 36)));

        TextView headerLabel = new TextView(activity);
        headerLabel.setText(label);
        headerLabel.setTextColor(activity.getColor(R.color.dmz_white));
        headerLabel.setTextSize(10.5f);
        headerLabel.setTypeface(Typeface.DEFAULT_BOLD);
        headerLabel.setLetterSpacing(0.10f);
        headerLabel.setGravity(Gravity.CENTER);
        headerLabel.setPadding(
                dp(activity, 10),
                dp(activity, 4),
                dp(activity, 10),
                dp(activity, 4));
        headerLabel.setBackgroundColor(0xCC080A09);

        FrameLayout.LayoutParams labelParams = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.CENTER);
        header.addView(headerLabel, labelParams);

        card.addView(header, 0, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(activity, 36)));

        if (!dangerSpacing && card.getChildCount() > 1) {
            View eyebrow = card.getChildAt(1);
            if (eyebrow.getLayoutParams() instanceof LinearLayout.LayoutParams) {
                LinearLayout.LayoutParams eyebrowParams =
                        (LinearLayout.LayoutParams) eyebrow.getLayoutParams();
                eyebrowParams.topMargin = dp(activity, 14);
                eyebrow.setLayoutParams(eyebrowParams);
            }
        }
    }

    private static final class TapeView extends View {
        private final Paint basePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint stripePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final float stripeWidth;

        TapeView(Activity activity, int baseColor) {
            super(activity);
            basePaint.setColor(baseColor);
            stripePaint.setColor(activity.getColor(R.color.dmz_black));
            stripePaint.setAlpha(92);
            stripeWidth = dp(activity, 12);
            setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        }

        @Override
        protected void onDraw(Canvas canvas) {
            super.onDraw(canvas);
            canvas.drawRect(0f, 0f, getWidth(), getHeight(), basePaint);
            canvas.save();
            canvas.rotate(-24f, getWidth() / 2f, getHeight() / 2f);
            float overscan = getHeight() * 4f;
            float step = stripeWidth * 2f;
            for (float x = -overscan; x < getWidth() + overscan; x += step) {
                canvas.drawRect(x, -overscan, x + stripeWidth, getHeight() + overscan, stripePaint);
            }
            canvas.restore();
        }
    }

    private static int dp(Activity activity, int value) {
        return Math.round(value * activity.getResources().getDisplayMetrics().density);
    }
}
