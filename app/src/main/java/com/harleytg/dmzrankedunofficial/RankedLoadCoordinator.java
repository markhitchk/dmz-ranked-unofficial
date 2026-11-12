package com.harleytg.dmzranked;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import java.util.Locale;

/** Callback-driven site loading with no fabricated network percentages. */
final class RankedLoadCoordinator {
    static final int TIMEOUT_MS = 15_000;
    private final Activity activity;
    private final String siteId;
    private final String hostname;
    private final Runnable retry;
    private final Runnable returnToHub;
    private final Runnable openBrowser;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final FrameLayout panel;
    private final TextView status;
    private final TextView details;
    private final ProgressBar indicator;
    private final LinearLayout actions;
    private boolean failed;
    private String state = "PREPARING";
    private long startedAt;
    private int generation;
    private boolean disposed;
    private boolean visible;

    RankedLoadCoordinator(Activity activity, FrameLayout container,String siteId,
                          String hostname, boolean verbose,Runnable retry,
                          Runnable returnToHub,Runnable openBrowser) {
        this.activity=activity;
        this.siteId=siteId;
        this.hostname=hostname;
        this.retry=retry;
        this.returnToHub=returnToHub;
        this.openBrowser=openBrowser;
        // Ranked Hub never exposes verbose loading telemetry to players.
        visible=false;
        panel=new FrameLayout(activity);
        GradientDrawable bg=new GradientDrawable();
        bg.setColor(Color.rgb(7,23,33));
        bg.setCornerRadius(dp(12));
        bg.setStroke(dp(1),Color.rgb(49,193,213));
        panel.setBackground(bg);
        panel.setPadding(dp(15),dp(11),dp(15),dp(12));
        FrameLayout.LayoutParams params=new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.TOP);
        params.setMargins(dp(10),dp(10),dp(10),0);
        container.addView(panel,params);

        LinearLayout col=new LinearLayout(activity);
        col.setOrientation(LinearLayout.VERTICAL);
        panel.addView(col);
        status=new TextView(activity);
        status.setTextColor(Color.WHITE);
        status.setTypeface(null,Typeface.BOLD);
        status.setTextSize(14);
        status.setText("PREPARING");
        col.addView(status);
        details=new TextView(activity);
        details.setTextSize(11);
        details.setTextColor(Color.rgb(164,194,207));
        col.addView(details);
        indicator=new ProgressBar(activity,null,android.R.attr.progressBarStyleHorizontal);
        indicator.setIndeterminate(true);
        LinearLayout.LayoutParams bar=new LinearLayout.LayoutParams(-1,dp(3));
        bar.topMargin=dp(9);
        col.addView(indicator,bar);
        actions=new LinearLayout(activity);
        actions.setOrientation(LinearLayout.HORIZONTAL);
        actions.setVisibility(View.GONE);
        col.addView(actions);
        addAction("RETRY",retry);
        addAction("HUB",returnToHub);
        addAction("BROWSER",openBrowser);
        panel.setVisibility(View.GONE);
    }

    private void addAction(String label,Runnable action) {
        Button b=new Button(activity);
        b.setText(label);
        b.setAllCaps(false);
        b.setTextSize(10);
        b.setMinHeight(dp(45));
        LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(0,dp(48),1f);
        actions.addView(b,p);
        b.setOnClickListener(v->action.run());
    }
    void onPageStarted(){
        generation++;
        failed=false;
        panel.setVisibility(View.GONE);
        actions.setVisibility(View.GONE);
        indicator.setVisibility(View.VISIBLE);
        startedAt=System.currentTimeMillis();
        transition("CONNECTING","Connecting to "+hostname);
        int thisGeneration=generation;
        handler.postDelayed(()->{
            if(!disposed&&!failed&&thisGeneration==generation
                    &&!"READY".equals(state)) {
                fail("TIMEOUT","Site did not finish loading. Retry or return to Hub.");
            }
        },TIMEOUT_MS);
    }
    void onResponse(){if(!failed)transition("RESPONSE","Website responding: "+hostname);}
    void onPageCommitVisible(){if(!failed)transition("RENDERING","Rendering site interface");}
    void onPageFinished(){
        if(failed)return;
        transition("READY","Website rendered");
        generation++;
        panel.setVisibility(View.GONE);
    }
    void onPageProgress(int estimated){
        if(!failed&&estimated>0&&estimated<100&&"CONNECTING".equals(state))
            transition("CONNECTING","Page loading (estimated), "+hostname);
    }
    void onNetworkError(int errorCode){
        // Android WebView error types are categorization only; no user URL logged.
        if(errorCode==android.webkit.WebViewClient.ERROR_TIMEOUT)fail("TIMEOUT","Connection timed out");
        else if(errorCode==android.webkit.WebViewClient.ERROR_HOST_LOOKUP
                ||errorCode==android.webkit.WebViewClient.ERROR_CONNECT)
            fail("OFFLINE","Could not reach "+hostname);
        else fail("ERROR","Page could not load");
    }
    void onTlsError(){fail("TLS ERROR","Secure connection could not be verified");}
    private void fail(String next,String summary){
        failed=true;
        transition(next,summary);
        generation++;
        panel.setVisibility(View.VISIBLE);
        indicator.setVisibility(View.GONE);
        actions.setVisibility(View.VISIBLE);
    }
    private void transition(String next,String summary){
        state=next;
        if(!visible && !failed)return;
        panel.setVisibility(View.VISIBLE);
        indicator.setVisibility(failed?View.GONE:View.VISIBLE);
        actions.setVisibility(failed?View.VISIBLE:View.GONE);
        status.setText("GAME UNAVAILABLE");
        details.setText(summary);
    }
    void dispose(){
        disposed=true;
        generation++;
        handler.removeCallbacksAndMessages(null);
    }
    private int dp(int n){return Math.round(n*activity.getResources().getDisplayMetrics().density);}
}
