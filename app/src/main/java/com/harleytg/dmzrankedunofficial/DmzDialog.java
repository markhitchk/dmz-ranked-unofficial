package com.harleytg.dmzranked;

import android.app.Activity;
import android.app.AlertDialog;
import android.text.InputFilter;
import android.view.Window;
import android.view.WindowManager;
import android.widget.EditText;

/**
 * Shared Android-native dialog helpers.
 *
 * App and website-owned modal prompts intentionally use the device's native
 * Android/OEM AlertDialog presentation instead of a custom DMZ card.
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

    private static AlertDialog.Builder builder(Activity activity) {
        return new AlertDialog.Builder(
                activity,
                android.R.style.Theme_DeviceDefault_Dialog_Alert);
    }

    public static AlertDialog alert(
            Activity activity,
            String title,
            String message,
            String buttonLabel,
            Runnable onConfirm,
            Runnable onCancel) {
        AlertDialog dialog = builder(activity)
                .setTitle(title)
                .setMessage(message)
                .setPositiveButton(
                        buttonLabel == null || buttonLabel.trim().isEmpty() ? "OK" : buttonLabel,
                        (ignored, which) -> {
                            if (onConfirm != null) onConfirm.run();
                        })
                .create();

        if (onCancel != null) {
            dialog.setOnCancelListener(ignored -> onCancel.run());
        }
        dialog.show();
        return dialog;
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
        String resolvedTitle = title == null || title.trim().isEmpty()
                ? (eyebrowText == null ? "DMZ Ranked" : eyebrowText)
                : title;

        AlertDialog.Builder builder = builder(activity)
                .setTitle(resolvedTitle)
                .setMessage(message);

        if (danger) {
            builder.setIcon(android.R.drawable.ic_dialog_alert);
        }

        builder.setPositiveButton(
                positiveLabel == null || positiveLabel.trim().isEmpty() ? "OK" : positiveLabel,
                (ignored, which) -> {
                    if (onPositive != null) onPositive.run();
                });

        if (negativeLabel != null && !negativeLabel.trim().isEmpty()) {
            builder.setNegativeButton(negativeLabel, (ignored, which) -> {
                if (onNegative != null) onNegative.run();
            });
        }

        AlertDialog dialog = builder.create();
        if (onNegative != null) {
            dialog.setOnCancelListener(ignored -> onNegative.run());
        }
        dialog.show();
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
        EditText input = new EditText(activity);
        input.setSingleLine(true);
        input.setHint(hint);
        input.setInputType(inputType);
        if (maxLength > 0) {
            input.setFilters(new InputFilter[]{new InputFilter.LengthFilter(maxLength)});
        }

        AlertDialog dialog = builder(activity)
                .setTitle(title)
                .setMessage(message)
                .setView(input)
                .setPositiveButton(
                        positiveLabel == null || positiveLabel.trim().isEmpty()
                                ? "OK"
                                : positiveLabel,
                        null)
                .setNegativeButton(
                        negativeLabel == null || negativeLabel.trim().isEmpty()
                                ? "CANCEL"
                                : negativeLabel,
                        (ignored, which) -> {
                            if (onCancel != null) onCancel.run();
                        })
                .create();

        if (onCancel != null) {
            dialog.setOnCancelListener(ignored -> onCancel.run());
        }

        dialog.setOnShowListener(ignored -> {
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
                String value = input.getText() == null ? "" : input.getText().toString();
                boolean dismiss = onSubmit == null || onSubmit.onSubmit(value, input);
                if (dismiss) dialog.dismiss();
            });

            Window window = dialog.getWindow();
            if (window != null) {
                window.setSoftInputMode(
                        WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE
                                | WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_VISIBLE);
            }
            input.requestFocus();
        });

        dialog.show();
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
        final AlertDialog[] holder = new AlertDialog[1];

        AlertDialog.Builder builder = builder(activity)
                .setTitle(title);

        if (message != null && !message.trim().isEmpty()) {
            builder.setMessage(message);
        }

        builder.setSingleChoiceItems(items, checkedIndex, (ignored, which) -> {
            if (onChoice != null && which >= 0 && which < items.length) {
                onChoice.onChoice(which, items[which] == null ? "" : items[which]);
            }
            if (holder[0] != null) holder[0].dismiss();
        });

        builder.setNegativeButton(
                negativeLabel == null || negativeLabel.trim().isEmpty()
                        ? "CANCEL"
                        : negativeLabel,
                null);

        AlertDialog dialog = builder.create();
        holder[0] = dialog;
        dialog.show();
        return dialog;
    }

    private static int dp(Activity activity, int value) {
        return Math.round(value * activity.getResources().getDisplayMetrics().density);
    }
}
