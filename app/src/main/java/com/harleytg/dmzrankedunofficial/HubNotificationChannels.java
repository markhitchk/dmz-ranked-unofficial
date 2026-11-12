package com.harleytg.dmzranked;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.Manifest;
import android.os.Build;

/** Independent Android channels. Original client keeps its legacy channel. */
final class HubNotificationChannels {
    static final String MW4="ranked_hub_mw4_v1";
    static final String ARC="ranked_hub_arc_v1";
    static final String COMMUNITY="ranked_hub_community_v1";
    static final String APP="ranked_hub_app_v1";
    private HubNotificationChannels() {}

    static boolean isHub(Context c) {
        return "com.harleytg.rankedhub.beta".equals(c.getPackageName());
    }
    static void ensure(Context c) {
        if(!isHub(c)||Build.VERSION.SDK_INT<26)return;
        NotificationManager m=(NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE);
        if(m==null)return;
        create(m,MW4,"MW4 DMZ Ranked","MW4 first-party website alerts.");
        create(m,ARC,"ARC Raiders Ranked","ARC first-party website alerts.");
        create(m,COMMUNITY,"DMZRanked.com Community",
                "Independent community website alerts and supported background checks.");
        create(m,APP,"Ranked Hub App","App notices and tests.");
    }
    private static void create(NotificationManager m,String id,String title,String text) {
        if(m.getNotificationChannel(id)!=null)return;
        NotificationChannel ch=new NotificationChannel(id,title,NotificationManager.IMPORTANCE_DEFAULT);
        ch.setDescription(text);
        ch.setShowBadge(true);
        m.createNotificationChannel(ch);
    }
    static void notifyCommunity(Context c,String title,String body,String key) {
        send(c,COMMUNITY,title,body,key);
    }
    static void notifyApp(Context c,String title,String body,String key) {
        send(c,APP,title,body,key);
    }
    static void notifyFirstParty(Context c,String site,String title,String body,String key) {
        if(RankedSiteActivity.SITE_DMZ_V1.equals(site))send(c,MW4,title,body,key);
        else if(RankedSiteActivity.SITE_ARC.equals(site))send(c,ARC,title,body,key);
    }
    private static void send(Context c,String channel,String title,String body,String key) {
        if(!isHub(c))return;
        if(!c.getSharedPreferences(NotificationSync.PREFS,Context.MODE_PRIVATE)
                .getBoolean(NotificationSync.PREF_SITE_NOTIFICATIONS,true))return;
        if(Build.VERSION.SDK_INT>=33&&c.checkSelfPermission(
                Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)return;
        NotificationManager m=(NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE);
        if(m==null)return;
        ensure(c);
        Intent action;
        if(MW4.equals(channel)||ARC.equals(channel)) {
            action=new Intent(c,RankedSiteActivity.class).putExtra(
                    RankedSiteActivity.EXTRA_SITE_ID,MW4.equals(channel)
                            ?RankedSiteActivity.SITE_DMZ_V1:RankedSiteActivity.SITE_ARC);
        }else action=new Intent(c,COMMUNITY.equals(channel)
                ?MainActivity.class:RankedHubActivity.class);
        action.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int hash=(channel+String.valueOf(key)).hashCode()&0x7fffffff;
        PendingIntent pending=PendingIntent.getActivity(c,2000+hash%20000,action,
                PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        String name=MW4.equals(channel)?"MW4 DMZ Ranked":
                ARC.equals(channel)?"ARC Raiders Ranked":
                COMMUNITY.equals(channel)?"DMZRanked.com Community":"Ranked Hub App";
        String headline=title==null?name:title;
        String msg=body==null?"":body;
        if(msg.length()>300)msg=msg.substring(0,300);
        Notification.Builder note=Build.VERSION.SDK_INT>=26
                ?new Notification.Builder(c,channel):new Notification.Builder(c);
        note.setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(name).setContentText(headline+" · "+msg)
                .setStyle(new Notification.BigTextStyle().bigText(headline+"\n"+msg))
                .setContentIntent(pending).setAutoCancel(true)
                .setVisibility(Notification.VISIBILITY_PRIVATE)
                .setPriority(Notification.PRIORITY_DEFAULT);
        m.notify(30000+hash%25000,note.build());
    }
}
