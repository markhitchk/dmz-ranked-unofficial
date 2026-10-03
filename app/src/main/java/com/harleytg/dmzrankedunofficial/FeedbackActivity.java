package com.harleytg.dmzranked;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.graphics.Color;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

public class FeedbackActivity extends Activity {
    private static final String SUPPORT_DISCORD_URL = "https://discord.gg/kdHneTZkyd";
    private static final String MAIN_DISCORD_URL = "https://discord.gg/jTaTHqw45F";
    private static final String BETA_GROUP_URL = "https://groups.google.com/g/dmz-ranked";
    private static final String PREFS = "dmz_feedback";
    private static final String PREF_LAST_SEND = "last_send_ms";
    private static final long SEND_COOLDOWN_MS = 30_000L;

    private Spinner categorySpinner;
    private EditText subjectInput;
    private EditText detailsInput;
    private EditText contactInput;
    private Button sendButton;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(buildUi());
        configureSystemBars();
    }

    private View buildUi() {
        LinearLayout root = new LinearLayout(this);
        root.setId(View.generateViewId());
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(getColor(R.color.dmz_black));

        LinearLayout toolbar = new LinearLayout(this);
        toolbar.setOrientation(LinearLayout.HORIZONTAL);
        toolbar.setGravity(Gravity.CENTER_VERTICAL);
        toolbar.setPadding(dp(6), 0, dp(12), 0);
        toolbar.setBackgroundResource(R.drawable.toolbar_background);
        root.addView(toolbar, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(64)));

        ImageButton back = new ImageButton(this);
        back.setImageResource(R.drawable.ic_back);
        back.setBackgroundColor(Color.TRANSPARENT);
        back.setPadding(dp(12), dp(12), dp(12), dp(12));
        back.setContentDescription("Back");
        back.setOnClickListener(v -> finish());
        toolbar.addView(back, new LinearLayout.LayoutParams(dp(48), dp(48)));

        ImageView logo = new ImageView(this);
        logo.setImageResource(R.drawable.dmz_ranked_logo);
        logo.setScaleType(ImageView.ScaleType.CENTER_INSIDE);
        toolbar.addView(logo, new LinearLayout.LayoutParams(dp(42), dp(42)));

        LinearLayout titleWrap = new LinearLayout(this);
        titleWrap.setOrientation(LinearLayout.VERTICAL);
        titleWrap.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout.LayoutParams titleWrapLp = new LinearLayout.LayoutParams(
                0, ViewGroup.LayoutParams.MATCH_PARENT, 1f);
        titleWrapLp.setMarginStart(dp(10));
        toolbar.addView(titleWrap, titleWrapLp);

        TextView title = text("APP FEEDBACK", 23, R.color.dmz_white, true);
        title.setLetterSpacing(0.08f);
        titleWrap.addView(title);

        TextView subtitle = text("DMZ RANKED • UNOFFICIAL ANDROID CLIENT", 10, R.color.dmz_gold_soft, true);
        subtitle.setLetterSpacing(0.08f);
        titleWrap.addView(subtitle);

        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        root.addView(scroll, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));

        LinearLayout body = new LinearLayout(this);
        body.setOrientation(LinearLayout.VERTICAL);
        body.setPadding(dp(16), dp(18), dp(16), dp(28));
        scroll.addView(body, new ScrollView.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        LinearLayout intro = card();
        body.addView(intro, matchWrap());
        TextView introTitle = text("APP FEEDBACK & SUPPORT", 18, R.color.dmz_white, true);
        intro.addView(introTitle);
        TextView introCopy = text(
                "Send feedback only for this unofficial Android app: app bugs, WebView/loading problems, app features, compatibility, and app support. The app team cannot change or fix the dmzranked.com website itself.",
                13, R.color.dmz_muted, false);
        introCopy.setPadding(0, dp(6), 0, 0);
        intro.addView(introCopy);

        body.addView(section("REPORT TYPE"), topMargin(dp(22)));
        categorySpinner = new Spinner(this);
        String[] categories = {
                "App bug report",
                "App feature request",
                "App support",
                "Performance / loading",
                "WebView / website loading in app",
                "Other app feedback"
        };
        ArrayAdapter<String> adapter = new ArrayAdapter<String>(
                this, android.R.layout.simple_spinner_dropdown_item, categories) {
            @Override
            public View getView(int position, View convertView, ViewGroup parent) {
                TextView view = (TextView) super.getView(position, convertView, parent);
                view.setTextColor(getColor(R.color.dmz_white));
                view.setTextSize(16);
                view.setPadding(dp(14), dp(12), dp(14), dp(12));
                return view;
            }
        };
        categorySpinner.setAdapter(adapter);
        categorySpinner.setBackgroundResource(R.drawable.settings_action_background);
        body.addView(categorySpinner, matchWrap());

        subjectInput = input("Short title / subject", false);
        body.addView(subjectInput, topMargin(dp(10)));

        detailsInput = input("Describe what happened in the Android app, what you expected, or what app feature you want…", true);
        detailsInput.setMinLines(6);
        detailsInput.setGravity(Gravity.TOP | Gravity.START);
        body.addView(detailsInput, topMargin(dp(10)));

        contactInput = input("Discord username (optional)", false);
        body.addView(contactInput, topMargin(dp(10)));

        TextView scopeNotice = text(
                "APP ONLY • Website content, rankings, rules, operator data, or server-side problems are controlled by DMZ Ranked, not this Android client.",
                12, R.color.dmz_gold_soft, true);
        scopeNotice.setPadding(dp(4), dp(12), dp(4), 0);
        body.addView(scopeNotice);

        TextView privacy = text(
                "The report automatically includes app version, Android version, and device model so app issues can be diagnosed. Do not include passwords, PINs, account tokens, cookies, or other private credentials.",
                12, R.color.dmz_muted, false);
        privacy.setPadding(dp(4), dp(12), dp(4), 0);
        body.addView(privacy);

        sendButton = new Button(this);
        sendButton.setText("SEND TO APP TEAM");
        sendButton.setTextColor(getColor(R.color.dmz_black));
        sendButton.setTextSize(16);
        sendButton.setAllCaps(false);
        sendButton.setTypeface(sendButton.getTypeface(), android.graphics.Typeface.BOLD);
        sendButton.setBackgroundResource(R.drawable.settings_support_background);
        sendButton.setOnClickListener(v -> submit());
        LinearLayout.LayoutParams sendLp = matchWrap();
        sendLp.topMargin = dp(16);
        body.addView(sendButton, sendLp);

        body.addView(section("DISCORD"), topMargin(dp(24)));
        Button support = secondaryButton("App Support Discord");
        support.setOnClickListener(v -> openExternal(SUPPORT_DISCORD_URL));
        body.addView(support, matchWrap());

        Button main = secondaryButton("Main DMZ Ranked Discord");
        main.setOnClickListener(v -> openExternal(MAIN_DISCORD_URL));
        body.addView(main, topMargin(dp(10)));

        Button beta = secondaryButton("Join App Beta Group");
        beta.setOnClickListener(v -> openExternal(BETA_GROUP_URL));
        body.addView(beta, topMargin(dp(10)));

        TextView note = text(
                "Use App Support for this unofficial Android client. For problems with the DMZ Ranked website itself, website data, rankings, rules, or server-side behavior, use the Main DMZ Ranked Discord instead.",
                12, R.color.dmz_muted, false);
        note.setPadding(dp(4), dp(10), dp(4), 0);
        body.addView(note);

        return root;
    }

    private void submit() {
        String category = String.valueOf(categorySpinner.getSelectedItem());
        String subject = subjectInput.getText().toString().trim();
        String details = detailsInput.getText().toString().trim();
        String contact = contactInput.getText().toString().trim();

        if (subject.length() < 3) {
            subjectInput.setError("Add a short subject.");
            return;
        }
        if (details.length() < 10) {
            detailsInput.setError("Please add more detail.");
            return;
        }

        SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        long now = System.currentTimeMillis();
        long last = prefs.getLong(PREF_LAST_SEND, 0L);
        if (now - last < SEND_COOLDOWN_MS) {
            long seconds = Math.max(1L, (SEND_COOLDOWN_MS - (now - last)) / 1000L);
            Toast.makeText(this, "Please wait " + seconds + " seconds before sending another report.", Toast.LENGTH_SHORT).show();
            return;
        }

        sendButton.setEnabled(false);
        sendButton.setText("SENDING…");

        new Thread(() -> {
            String reportId = UUID.randomUUID().toString().substring(0, 8).toUpperCase();
            try {
                int code = postToDiscord(reportId, category, subject, details, contact);
                if (code >= 200 && code < 300) {
                    prefs.edit().putLong(PREF_LAST_SEND, System.currentTimeMillis()).apply();
                    runOnUiThread(() -> {
                        Toast.makeText(this, "Report " + reportId + " sent. Thank you.", Toast.LENGTH_LONG).show();
                        subjectInput.setText("");
                        detailsInput.setText("");
                        contactInput.setText("");
                        sendButton.setEnabled(true);
                        sendButton.setText("SEND TO APP TEAM");
                    });
                } else {
                    throw new IllegalStateException("Discord returned HTTP " + code);
                }
            } catch (Throwable error) {
                runOnUiThread(() -> {
                    Toast.makeText(this, "Could not send feedback. Use the App Support Discord instead.", Toast.LENGTH_LONG).show();
                    sendButton.setEnabled(true);
                    sendButton.setText("SEND TO APP TEAM");
                });
            }
        }, "DMZFeedbackSender").start();
    }

    private int postToDiscord(String reportId, String category, String subject, String details, String contact) throws Exception {
        URL url = new URL(FeedbackWebhook.getUrl());
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        try {
            connection.setConnectTimeout(10_000);
            connection.setReadTimeout(10_000);
            connection.setRequestMethod("POST");
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
            connection.setRequestProperty("User-Agent", "DMZRankedApp/" + getVersionName() + " (HarleysStudios; AndroidClient; com.harleytg.dmzranked)");

            String device = Build.MANUFACTURER + " " + Build.MODEL
                    + " • Android " + Build.VERSION.RELEASE
                    + " (API " + Build.VERSION.SDK_INT + ")";
            String contactText = contact.isEmpty() ? "Not provided" : truncate(contact, 300);

            String json = "{"
                    + "\"username\":\"DMZ Ranked App Feedback\","
                    + "\"allowed_mentions\":{\"parse\":[]},"
                    + "\"embeds\":[{"
                    + "\"title\":\"" + escape("[" + category + "] " + truncate(subject, 180)) + "\","
                    + "\"description\":\"" + escape(truncate(details, 3500)) + "\","
                    + "\"color\":16172115,"
                    + "\"fields\":["
                    + "{\"name\":\"Report ID\",\"value\":\"" + escape(reportId) + "\",\"inline\":true},"
                    + "{\"name\":\"App Version\",\"value\":\"" + escape(getVersionName()) + "\",\"inline\":true},"\n                    + "{\"name\":\"Scope\",\"value\":\"Android app only\",\"inline\":true},"
                    + "{\"name\":\"Contact\",\"value\":\"" + escape(contactText) + "\",\"inline\":false},"
                    + "{\"name\":\"Device\",\"value\":\"" + escape(device) + "\",\"inline\":false}"
                    + "],"
                    + "\"footer\":{\"text\":\"App-only feedback • DMZ Ranked Unofficial Android Client\"}"
                    + "}]}";

            byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
            connection.setFixedLengthStreamingMode(bytes.length);
            try (OutputStream out = connection.getOutputStream()) {
                out.write(bytes);
            }
            return connection.getResponseCode();
        } finally {
            connection.disconnect();
        }
    }

    private void openExternal(String url) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
        } catch (ActivityNotFoundException error) {
            Toast.makeText(this, "No app can open this link.", Toast.LENGTH_SHORT).show();
        }
    }

    private void configureSystemBars() {
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            getWindow().setNavigationBarContrastEnforced(false);
        }

        View root = findViewById(android.R.id.content);
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            int left;
            int top;
            int right;
            int bottom;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                Insets bars = insets.getInsets(WindowInsets.Type.systemBars());
                left = bars.left;
                top = bars.top;
                right = bars.right;
                bottom = bars.bottom;
            } else {
                left = insets.getSystemWindowInsetLeft();
                top = insets.getSystemWindowInsetTop();
                right = insets.getSystemWindowInsetRight();
                bottom = insets.getSystemWindowInsetBottom();
            }
            view.setPadding(left, top, right, bottom);
            return insets;
        });
        root.requestApplyInsets();
    }

    private LinearLayout card() {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(16), dp(16), dp(16), dp(16));
        card.setBackgroundResource(R.drawable.settings_card_background);
        return card;
    }

    private TextView section(String value) {
        TextView view = text(value, 13, R.color.dmz_gold, true);
        view.setLetterSpacing(0.14f);
        view.setPadding(dp(4), 0, 0, dp(10));
        return view;
    }

    private EditText input(String hint, boolean multiline) {
        EditText view = new EditText(this);
        view.setHint(hint);
        view.setHintTextColor(getColor(R.color.dmz_muted));
        view.setTextColor(getColor(R.color.dmz_white));
        view.setTextSize(15);
        view.setPadding(dp(14), dp(12), dp(14), dp(12));
        view.setBackgroundResource(R.drawable.settings_action_background);
        view.setSingleLine(!multiline);
        if (multiline) {
            view.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        } else {
            view.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        }
        return view;
    }

    private Button secondaryButton(String label) {
        Button button = new Button(this);
        button.setText(label);
        button.setTextColor(getColor(R.color.dmz_white));
        button.setTextSize(15);
        button.setAllCaps(false);
        button.setTypeface(button.getTypeface(), android.graphics.Typeface.BOLD);
        button.setBackgroundResource(R.drawable.settings_action_background);
        return button;
    }

    private TextView text(String value, int sp, int colorRes, boolean bold) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextColor(getColor(colorRes));
        view.setTextSize(sp);
        if (bold) view.setTypeface(view.getTypeface(), android.graphics.Typeface.BOLD);
        return view;
    }

    private LinearLayout.LayoutParams matchWrap() {
        return new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT);
    }

    private LinearLayout.LayoutParams topMargin(int px) {
        LinearLayout.LayoutParams lp = matchWrap();
        lp.topMargin = px;
        return lp;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private String getVersionName() {
        try {
            PackageInfo info = getPackageManager().getPackageInfo(getPackageName(), 0);
            return info.versionName == null ? "Unknown" : info.versionName;
        } catch (Exception error) {
            return "Unknown";
        }
    }

    private static String truncate(String value, int max) {
        if (value == null) return "";
        return value.length() <= max ? value : value.substring(0, max - 1) + "…";
    }

    private static String escape(String value) {
        if (value == null) return "";
        return value
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }
}
