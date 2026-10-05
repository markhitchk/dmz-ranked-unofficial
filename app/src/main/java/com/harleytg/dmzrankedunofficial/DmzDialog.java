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
            warningPanel.setOrientation(LinearLayout.HORIZONTAL);
            warningPanel.setGravity(Gravity.CENTER_VERTICAL);
            warningPanel.setPadding(
                    dp(activity, 12),
                    dp(activity, 12),
                    dp(activity, 12),
                    dp(activity, 12));

            GradientDrawable warningBackground = new GradientDrawable();
            warningBackground.setColor(activity.getColor(R.color.dmz_panel_deep));
            warningBackground.setStroke(dp(activity, 1), activity.getColor(R.color.dmz_red));
            warningBackground.setCornerRadius(dp(activity, 12));
            warningPanel.setBackground(warningBackground);

            TextView warningIcon = new TextView(activity);
            warningIcon.setText("!");
            warningIcon.setGravity(Gravity.CENTER);
            warningIcon.setTextColor(activity.getColor(R.color.dmz_white));
            warningIcon.setTextSize(18f);
            warningIcon.setTypeface(Typeface.DEFAULT_BOLD);
            GradientDrawable warningIconBackground = new GradientDrawable();
            warningIconBackground.setColor(activity.getColor(R.color.dmz_red));
            warningIconBackground.setShape(GradientDrawable.OVAL);
            warningIcon.setBackground(warningIconBackground);
            warningPanel.addView(warningIcon, new LinearLayout.LayoutParams(
                    dp(activity, 36),
                    dp(activity, 36)));

            LinearLayout warningCopy = new LinearLayout(activity);
            warningCopy.setOrientation(LinearLayout.VERTICAL);
            LinearLayout.LayoutParams warningCopyParams = new LinearLayout.LayoutParams(
                    0,
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    1f);
            warningCopyParams.leftMargin = dp(activity, 11);
            warningPanel.addView(warningCopy, warningCopyParams);

            TextView warningTitle = new TextView(activity);
            warningTitle.setText("REVIEW THIS ACTION");
            warningTitle.setTextColor(activity.getColor(R.color.dmz_red));
            warningTitle.setTextSize(11f);
            warningTitle.setTypeface(Typeface.DEFAULT_BOLD);
            warningTitle.setLetterSpacing(0.08f);
            warningCopy.addView(warningTitle);

            TextView warningBody = new TextView(activity);
            warningBody.setText("This can remove or reset data and may not be recoverable.");
            warningBody.setTextColor(activity.getColor(R.color.dmz_muted));
            warningBody.setTextSize(12.5f);
            warningBody.setLineSpacing(0f, 1.08f);
            LinearLayout.LayoutParams warningBodyParams = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT);
            warningBodyParams.topMargin = dp(activity, 3);
            warningCopy.addView(warningBody, warningBodyParams);

            LinearLayout.LayoutParams warningParams = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT);
            warningParams.topMargin = dp(activity, 14);
            card.addView(warningPanel, warningParams);
        }

        LinearLayout actions = buildActionRow(activity);
        TextView negative = null;
        if (negativeLabel != null && !negativeLabel.trim().isEmpty()) {
            negative = buildModalAction(activity, negativeLabel, false, danger);
            actions.addView(negative, weightedParams(activity, false));
        }

        TextView positive = buildModalAction(activity, positiveLabel, true, danger);
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
        choicesParams.topMargin = dp(activity, 15);
        card.addView(choices, choicesParams);

        final AlertDialog[] holder = new AlertDialog[1];
        for (int i = 0; i < items.length; i++) {
            final int index = i;
            final String value = items[i] == null ? "" : items[i];
            final boolean selected = i == checkedIndex;

            LinearLayout row = new LinearLayout(activity);
            row.setOrientation(LinearLayout.HORIZONTAL);
            row.setGravity(Gravity.CENTER_VERTICAL);
            row.setPadding(
                    dp(activity, 12),
                    dp(activity, 11),
                    dp(activity, 12),
                    dp(activity, 11));

            GradientDrawable rowBackground = new GradientDrawable();
            rowBackground.setColor(activity.getColor(
                    selected ? R.color.dmz_panel : R.color.dmz_panel_deep));
            rowBackground.setStroke(
                    dp(activity, selected ? 2 : 1),
                    activity.getColor(selected ? R.color.dmz_gold : R.color.dmz_card_border));
            rowBackground.setCornerRadius(dp(activity, 12));
            row.setBackground(rowBackground);
            row.setClickable(true);
            row.setFocusable(true);
            row.setMinimumHeight(dp(activity, 62));

            TextView selector = new TextView(activity);
            selector.setText(selected ? "✓" : "");
            selector.setGravity(Gravity.CENTER);
            selector.setTextSize(15f);
            selector.setTypeface(Typeface.DEFAULT_BOLD);
            selector.setTextColor(activity.getColor(
                    selected ? R.color.dmz_black : R.color.dmz_muted));

            GradientDrawable selectorBackground = new GradientDrawable();
            selectorBackground.setShape(GradientDrawable.OVAL);
            selectorBackground.setColor(activity.getColor(
                    selected ? R.color.dmz_gold : R.color.dmz_panel));
            selectorBackground.setStroke(
                    dp(activity, 1),
                    activity.getColor(selected ? R.color.dmz_gold : R.color.dmz_muted));
            selector.setBackground(selectorBackground);
            row.addView(selector, new LinearLayout.LayoutParams(
                    dp(activity, 30),
                    dp(activity, 30)));

            LinearLayout profileCopy = new LinearLayout(activity);
            profileCopy.setOrientation(LinearLayout.VERTICAL);
            LinearLayout.LayoutParams profileCopyParams = new LinearLayout.LayoutParams(
                    0,
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    1f);
            profileCopyParams.leftMargin = dp(activity, 12);
            row.addView(profileCopy, profileCopyParams);

            TextView profileName = new TextView(activity);
            profileName.setText(value);
            profileName.setTextColor(activity.getColor(
                    selected ? R.color.dmz_gold : R.color.dmz_white));
            profileName.setTextSize(15f);
            profileName.setTypeface(selected ? Typeface.DEFAULT_BOLD : Typeface.DEFAULT);
            profileCopy.addView(profileName);

            TextView profileState = new TextView(activity);
            profileState.setText(selected ? "Current operator" : "Tap to use this operator");
            profileState.setTextColor(activity.getColor(R.color.dmz_muted));
            profileState.setTextSize(11.5f);
            LinearLayout.LayoutParams profileStateParams = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT);
            profileStateParams.topMargin = dp(activity, 2);
            profileCopy.addView(profileState, profileStateParams);

            TextView stateChip = new TextView(activity);
            stateChip.setText(selected ? "ACTIVE" : "SELECT");
            stateChip.setGravity(Gravity.CENTER);
            stateChip.setTextSize(9.5f);
            stateChip.setTypeface(Typeface.DEFAULT_BOLD);
            stateChip.setLetterSpacing(0.06f);
            stateChip.setPadding(
                    dp(activity, 9),
                    dp(activity, 5),
                    dp(activity, 9),
                    dp(activity, 5));
            stateChip.setTextColor(activity.getColor(
                    selected ? R.color.dmz_black : R.color.dmz_gold));
            GradientDrawable chipBackground = new GradientDrawable();
            chipBackground.setColor(activity.getColor(
                    selected ? R.color.dmz_gold : R.color.dmz_panel_deep));
            chipBackground.setStroke(
                    dp(activity, 1),
                    activity.getColor(R.color.dmz_gold_dark));
            chipBackground.setCornerRadius(dp(activity, 20));
            stateChip.setBackground(chipBackground);
            LinearLayout.LayoutParams chipParams = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT);
            chipParams.leftMargin = dp(activity, 8);
            row.addView(stateChip, chipParams);

            LinearLayout.LayoutParams rowParams = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT);
            if (i > 0) rowParams.topMargin = dp(activity, 9);
            choices.addView(row, rowParams);

            row.setOnClickListener(v -> {
                if (onChoice != null) onChoice.onChoice(index, value);
                if (holder[0] != null) holder[0].dismiss();
            });
        }

        TextView footer = new TextView(activity);
        footer.setText("Profiles are imported from DMZRanked.com  •  Maximum 2 operators");
        footer.setTextColor(activity.getColor(R.color.dmz_muted));
        footer.setTextSize(10.5f);
        footer.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams footerParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT);
        footerParams.topMargin = dp(activity, 12);
        card.addView(footer, footerParams);

        TextView negative = buildModalAction(activity, negativeLabel, false, false);
        LinearLayout.LayoutParams cancelParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(activity, 46));
        cancelParams.topMargin = dp(activity, 15);
        card.addView(negative, cancelParams);

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
        card.setPadding(dp(activity, 18), dp(activity, 18), dp(activity, 18), dp(activity, 16));
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

    private static TextView buildModalAction(
            Activity activity,
            String label,
            boolean primary,
            boolean danger) {
        TextView action = new TextView(activity);
        action.setText(label == null ? "OK" : label);
        action.setGravity(Gravity.CENTER);
        action.setTextSize(11f);
        action.setTypeface(Typeface.DEFAULT_BOLD);
        action.setLetterSpacing(0.05f);
        action.setClickable(true);
        action.setFocusable(true);
        action.setMinHeight(dp(activity, 48));
        action.setPadding(
                dp(activity, 12),
                dp(activity, 12),
                dp(activity, 12),
                dp(activity, 12));

        GradientDrawable background = new GradientDrawable();
        background.setCornerRadius(dp(activity, 10));

        if (primary && danger) {
            background.setColor(activity.getColor(R.color.dmz_red));
            background.setStroke(dp(activity, 1), activity.getColor(R.color.dmz_red));
            action.setTextColor(activity.getColor(R.color.dmz_white));
        } else if (primary) {
            background.setColor(activity.getColor(R.color.dmz_gold));
            background.setStroke(dp(activity, 1), activity.getColor(R.color.dmz_gold));
            action.setTextColor(activity.getColor(R.color.dmz_black));
        } else {
            background.setColor(activity.getColor(R.color.dmz_panel_deep));
            background.setStroke(
                    dp(activity, 1),
                    activity.getColor(danger ? R.color.dmz_red : R.color.dmz_card_border));
            action.setTextColor(activity.getColor(
                    danger ? R.color.dmz_white : R.color.dmz_muted));
        }

        action.setBackground(background);
        return action;
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
                        activity.getResources().getDisplayMetrics().widthPixels - dp(activity, 28),
                        dp(activity, 450));
                window.setLayout(width, ViewGroup.LayoutParams.WRAP_CONTENT);
                window.addFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND);
                WindowManager.LayoutParams params = window.getAttributes();
                params.dimAmount = 0.78f;
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
            card.setElevation(dp(activity, 18));
            if (prefs.getBoolean("app_animations", true)) {
                card.setAlpha(0f);
                card.setScaleX(0.97f);
                card.setScaleY(0.97f);
                card.setTranslationY(dp(activity, 10));
                card.animate()
                        .alpha(1f)
                        .scaleX(1f)
                        .scaleY(1f)
                        .translationY(0f)
                        .setDuration(190L)
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
