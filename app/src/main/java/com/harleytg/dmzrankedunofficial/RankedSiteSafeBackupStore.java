package com.harleytg.dmzranked;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.util.Iterator;
import java.util.regex.Pattern;

/**
 * Private, local snapshots of safe first-party preferences. This is NOT
 * access to WebView cookies, passwords or any website's server-owned records.
 * All data must be captured after a user action on the correct HTTPS origin.
 */
final class RankedSiteSafeBackupStore {
    static final String MW4 = "dmz-v1";
    static final String ARC = "arc-raiders";
    private static final String PREFS = "ranked_hub_safe_site_snapshots";
    private static final String PREFIX = "snapshot_";
    private static final int MAX_BYTES = 128_000;
    private static final Pattern SECRET = Pattern.compile(
            "access[_-]?token|refresh[_-]?token|password|passcode|oauth"
             + "|authorization|bearer\\s|api[_-]?key|cookie|session"
             + "|eyJ[A-Za-z0-9_-]{12,}\\.",
            Pattern.CASE_INSENSITIVE);
    private RankedSiteSafeBackupStore() {}

    private static String checkText(JSONObject object, String name, int max) throws JSONException {
        Object raw = object.opt(name);
        if (!(raw instanceof String)) throw new JSONException("Missing text: " + name);
        String s = (String)raw;
        if (s.length() > max || SECRET.matcher(s).find())
            throw new JSONException("Unsafe or oversized text: " + name);
        return s;
    }
    private static boolean keySetEquals(JSONObject o, String... expected) {
        if (o == null || o.length() != expected.length) return false;
        for (String key : expected) if (!o.has(key)) return false;
        return true;
    }
    static JSONObject validate(String site, JSONObject document) throws JSONException {
        if (!(MW4.equals(site) || ARC.equals(site)))
            throw new JSONException("Unknown ranked site");
        if (document == null || !keySetEquals(document,"siteId","schemaVersion","state")
                || !site.equals(document.optString("siteId",""))
                || document.optInt("schemaVersion",0) != 1)
            throw new JSONException("Wrong origin or schema version");
        JSONObject state = document.optJSONObject("state");
        JSONObject safe = new JSONObject();
        if (MW4.equals(site)) {
            if (!keySetEquals(state,"callsign","orders","sector","loadout","squad","motion"))
                throw new JSONException("Unsafe MW4 preference fields");
            safe.put("callsign",checkText(state,"callsign",28));
            String sector = checkText(state,"sector",2);
            if (!sector.matches("0[1-4]"))throw new JSONException("Invalid MW4 sector");
            safe.put("sector",sector);
            safe.put("loadout",checkText(state,"loadout",2000));
            safe.put("squad",checkText(state,"squad",2000));
            if (!(state.opt("motion") instanceof Boolean))
                throw new JSONException("Invalid MW4 motion flag");
            safe.put("motion",state.optBoolean("motion"));
            JSONArray orders=state.optJSONArray("orders");
            if (orders==null || orders.length()>30)
                throw new JSONException("Invalid MW4 orders");
            JSONArray cleanOrders=new JSONArray();
            for(int i=0;i<orders.length();i++) {
                JSONObject order=orders.optJSONObject(i);
                if(!keySetEquals(order,"id","title","description","category","done")
                        || !(order.opt("done") instanceof Boolean))
                    throw new JSONException("Invalid MW4 order");
                JSONObject clean=new JSONObject();
                clean.put("id",checkText(order,"id",100));
                clean.put("title",checkText(order,"title",80));
                clean.put("description",checkText(order,"description",300));
                clean.put("category",checkText(order,"category",40));
                clean.put("done",order.optBoolean("done"));
                cleanOrders.put(clean);
            }
            safe.put("orders",cleanOrders);
            // Remote SR and account records, reports and proof fields are forbidden.
        } else {
            if (!keySetEquals(state,"graphicsMode"))
                throw new JSONException("Unsupported ARC preference fields");
            String mode=checkText(state,"graphicsMode",8);
            if (!("lite".equals(mode) || "enhanced".equals(mode)))
                throw new JSONException("Unknown ARC graphics mode");
            safe.put("graphicsMode",mode);
        }
        JSONObject clean = new JSONObject();
        clean.put("siteId",site);
        clean.put("schemaVersion",1);
        clean.put("state",safe);
        if(clean.toString().length()>MAX_BYTES)
            throw new JSONException("Site preferences exceed backup limit");
        return clean;
    }
    static void save(Context ctx,String site,JSONObject input) throws JSONException {
        JSONObject safe=validate(site,input);
        if(!ctx.getSharedPreferences(PREFS,Context.MODE_PRIVATE).edit()
                .putString(PREFIX+site,safe.toString()).commit())
            throw new JSONException("Could not save site snapshot");
    }
    static JSONObject read(Context ctx,String site) {
        if (!(MW4.equals(site) || ARC.equals(site))) return null;
        String json=ctx.getSharedPreferences(PREFS,Context.MODE_PRIVATE)
                .getString(PREFIX+site,null);
        if(json==null)return null;
        try{return validate(site,new JSONObject(json));}
        catch(Exception ignored){return null;}
    }
    static JSONObject snapshot(Context ctx) throws JSONException {
        JSONObject all=new JSONObject();
        for(String site:new String[]{MW4,ARC}){
            JSONObject value=read(ctx,site);
            if(value!=null)all.put(site,value);
        }
        return all;
    }
    static int restoreSnapshots(Context ctx,JSONObject snapshots) throws JSONException {
        if(snapshots==null)return 0;
        if(snapshots.length()>2)throw new JSONException("Unexpected site snapshots");
        SharedPreferences.Editor editor=ctx.getSharedPreferences(PREFS,Context.MODE_PRIVATE).edit();
        Iterator<String> keys=snapshots.keys();
        int n=0;
        while(keys.hasNext()){
            String site=keys.next();
            if (!(MW4.equals(site)||ARC.equals(site)))
                throw new JSONException("Unknown site backup entry");
            JSONObject safe=validate(site,snapshots.optJSONObject(site));
            editor.putString(PREFIX+site,safe.toString());
            n++;
        }
        if(!editor.commit())throw new JSONException("Could not restore site preferences");
        return n;
    }
}
