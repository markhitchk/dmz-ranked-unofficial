package com.harleytg.dmzranked;

import android.animation.ObjectAnimator;
import android.app.Activity;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.io.InputStream;

/**
 * Actual offline crest animation. It ends as soon as hub HTML has rendered.
 * No scheduled delay, user data, networking or fake loading percentage.
 */
final class RankedIntroView extends FrameLayout {
    private final boolean reducedMotion;
    private ObjectAnimator radarAnimation;
    private boolean ended;

    RankedIntroView(Activity activity, boolean reduceMotion) {
        super(activity);
        reducedMotion=reduceMotion;
        setClickable(false);
        setFocusable(false);
        setBackgroundColor(Color.rgb(5,19,28));
        LinearLayout column = new LinearLayout(activity);
        column.setOrientation(LinearLayout.VERTICAL);
        column.setGravity(Gravity.CENTER);
        addView(column,new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        FrameLayout crestArea=new FrameLayout(activity);
        column.addView(crestArea,new LinearLayout.LayoutParams(dp(230),dp(230)));
        View radar=new View(activity) {
            final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
            @Override protected void onDraw(Canvas canvas){
                super.onDraw(canvas);
                paint.setColor(Color.rgb(47,216,233));
                paint.setStrokeWidth(dp(2));
                paint.setStyle(Paint.Style.STROKE);
                paint.setAlpha(190);
                RectF rect=new RectF(dp(18),dp(18),getWidth()-dp(18),getHeight()-dp(18));
                canvas.drawArc(rect,12,82,false,paint);
                canvas.drawArc(rect,193,72,false,paint);
            }
        };
        crestArea.addView(radar,new FrameLayout.LayoutParams(-1,-1));
        ImageView logo=new ImageView(activity);
        logo.setScaleType(ImageView.ScaleType.FIT_CENTER);
        logo.setContentDescription("Ranked Hub official puppy-shield crest");
        try(InputStream stream=activity.getAssets().open("ranked-hub/ranked-hub-selected.webp")){
            logo.setImageBitmap(BitmapFactory.decodeStream(stream));
        }catch(Exception ignored){}
        FrameLayout.LayoutParams lp=new FrameLayout.LayoutParams(dp(192),dp(192),Gravity.CENTER);
        crestArea.addView(logo,lp);
        TextView heading=new TextView(activity);
        heading.setText("RANKED HUB");
        heading.setTextColor(Color.WHITE);
        heading.setTextSize(25);
        heading.setTypeface(android.graphics.Typeface.DEFAULT,android.graphics.Typeface.BOLD);
        heading.setGravity(Gravity.CENTER);
        column.addView(heading,new LinearLayout.LayoutParams(-1,dp(42)));
        TextView subtitle=new TextView(activity);
        subtitle.setText("HARLEY'S STUDIOS  //  RANKED NETWORK");
        subtitle.setTextColor(Color.rgb(89,218,231));
        subtitle.setTextSize(11);
        subtitle.setGravity(Gravity.CENTER);
        column.addView(subtitle,new LinearLayout.LayoutParams(-1,dp(30)));

        if(!reducedMotion) {
            logo.setScaleX(0.91f);
            logo.setScaleY(0.91f);
            logo.animate().scaleX(1f).scaleY(1f).setDuration(270).start();
            radarAnimation=ObjectAnimator.ofFloat(radar,"rotation",0f,360f);
            radarAnimation.setRepeatCount(ObjectAnimator.INFINITE);
            radarAnimation.setDuration(2400);
            radarAnimation.start();
        }
    }

    void finish(Runnable done) {
        if(ended)return;
        ended=true;
        if(radarAnimation!=null)radarAnimation.cancel();
        if(reducedMotion){
            setVisibility(View.GONE);
            if(done!=null)done.run();
        }else{
            animate().alpha(0f).setDuration(240).withEndAction(()->{
                setVisibility(View.GONE);
                if(done!=null)done.run();
            }).start();
        }
    }
    void dispose(){
        animate().cancel();
        if(radarAnimation!=null)radarAnimation.cancel();
    }
    private int dp(int value){
        return Math.round(getResources().getDisplayMetrics().density*value);
    }
}
