package com.harleytg.dmzranked;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.Map;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;
import javax.crypto.Cipher;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;

/** Portable passphrase-protected backup of Hub settings and safe legacy operator snapshots.
 * MW4/ARC backups are disabled until their website-owned versioned contracts are available.
 */
final class RankedBackupManager {
    private static final byte[] MAGIC = {'R','H','B','1'};
    private static final int MAX_FILE = 6_000_000;
    private static final int MAX_ENTRY = 2_000_000;
    private static final int KDF_ITERATIONS = 210_000;
    private static final String PREFS = "dmz_ranked_settings";
    private static final String[] BOOLEANS = {
            "desktop_site","keep_awake","verbose_loading","site_notifications",
            "pull_to_refresh","remember_last_page","operator_auto_save",
            "app_animations","reduced_motion"
    };

    static final class Preview {
        final JSONObject settings;
        final JSONObject operatorBackups;
        final JSONObject siteSnapshots;
        final long createdAt;
        final int backupEntries;
        Preview(JSONObject settings,JSONObject operatorBackups,JSONObject siteSnapshots,
                long createdAt,int backupEntries){
            this.settings=settings;
            this.operatorBackups=operatorBackups;
            this.siteSnapshots=siteSnapshots;
            this.createdAt=createdAt;
            this.backupEntries=backupEntries;
        }
        int settingCount(){return settings.length();}
        int operatorCount(){return operatorBackups.length();}
        int siteCount(){return siteSnapshots.length();}
    }

    private RankedBackupManager(){}

    static void exportBackup(Context context, Uri destination, char[] passphrase) throws Exception {
        exportBackup(context,destination,passphrase,
                new HashSet<>(Arrays.asList("hub","community","dmz-v1","arc-raiders")));
    }

    static void exportBackup(Context context, Uri destination, char[] passphrase,
                             Set<String> selectedSiteIds) throws Exception {
        if(selectedSiteIds==null||selectedSiteIds.isEmpty())
            throw new IllegalArgumentException("Choose at least one site for backup");
        if (passphrase == null || passphrase.length < 8)
            throw new IllegalArgumentException("Backup passphrase requires at least 8 characters");
        byte[] zip=buildZip(context,selectedSiteIds);
        byte[] bytes=seal(zip,passphrase);
        Arrays.fill(zip,(byte)0);
        try(OutputStream out=context.getContentResolver().openOutputStream(destination,"wt")){
            if(out==null)throw new IllegalStateException("Cannot open backup destination");
            out.write(bytes);
            out.flush();
        }finally{
            Arrays.fill(bytes,(byte)0);
        }
    }

    static Preview inspectBackup(Context context, Uri source, char[] passphrase) throws Exception {
        if(passphrase==null || passphrase.length==0)throw new IllegalArgumentException("Passphrase is required");
        ByteArrayOutputStream output=new ByteArrayOutputStream();
        try(InputStream input=context.getContentResolver().openInputStream(source)){
            if(input==null)throw new IllegalStateException("Cannot read selected backup");
            byte[] buf=new byte[8192];
            int count;
            while((count=input.read(buf))!=-1){
                if(output.size()+count>MAX_FILE)throw new IllegalArgumentException("Backup exceeds size limit");
                output.write(buf,0,count);
            }
        }
        byte[] plaintext=open(output.toByteArray(),passphrase);
        try { return parseZip(plaintext); }
        finally { Arrays.fill(plaintext,(byte)0); }
    }

    static int restoreBackup(Context context, Preview preview) throws Exception {
        return restoreBackup(context,preview,
                new HashSet<>(Arrays.asList("hub","community","dmz-v1","arc-raiders")));
    }

    static int restoreBackup(Context context, Preview preview,
                             Set<String> selectedSiteIds) throws Exception {
        if(selectedSiteIds==null||selectedSiteIds.isEmpty())
            throw new IllegalArgumentException("Nothing selected to restore");
        if(preview==null)throw new IllegalArgumentException("Restore preview is missing");
        SharedPreferences prefs=context.getSharedPreferences(PREFS,Context.MODE_PRIVATE);
        SharedPreferences.Editor edit=prefs.edit();
        if(selectedSiteIds.contains("hub")) {
            for(String key:BOOLEANS){
                Object v=preview.settings.opt(key);
                if(v instanceof Boolean) edit.putBoolean(key,(Boolean)v);
            }
            String size=preview.settings.optString("content_size","");
            if("standard".equals(size)||"compact".equals(size)||"large".equals(size))
                edit.putString("content_size",size);
        }
        // Validate every first-party snapshot before mutating any app state.
        JSONObject snapshots=new JSONObject();
        java.util.Iterator<String> keys=preview.siteSnapshots.keys();
        while(keys.hasNext()){
            String site=keys.next();
            if(selectedSiteIds.contains(site))
                snapshots.put(site,RankedSiteSafeBackupStore.validate(
                        site,preview.siteSnapshots.optJSONObject(site)));
        }
        java.util.Map<String,?> priorPrefs=new java.util.HashMap<>(prefs.getAll());
        String priorOperators=OperatorBackupStore.exportJson(context);
        JSONObject priorSites=RankedSiteSafeBackupStore.snapshot(context);
        try{
            if(selectedSiteIds.contains("hub") && !edit.commit())
                throw new IllegalStateException("Could not apply preferences");
            int result=selectedSiteIds.contains("community")
                    ? OperatorBackupStore.importJson(context,preview.operatorBackups.toString()) : 0;
            if(snapshots.length()>0) RankedSiteSafeBackupStore.restoreSnapshots(context,snapshots);
            return result;
        }catch(Exception error){
            SharedPreferences.Editor revert=prefs.edit().clear();
            for(java.util.Map.Entry<String,?> item:priorPrefs.entrySet()){
                Object value=item.getValue(); String key=item.getKey();
                if(value instanceof Boolean)revert.putBoolean(key,(Boolean)value);
                else if(value instanceof String)revert.putString(key,(String)value);
                else if(value instanceof Integer)revert.putInt(key,(Integer)value);
                else if(value instanceof Long)revert.putLong(key,(Long)value);
                else if(value instanceof Float)revert.putFloat(key,(Float)value);
                else if(value instanceof java.util.Set) {
                    @SuppressWarnings("unchecked")
                    java.util.Set<String> values=(java.util.Set<String>)value;
                    revert.putStringSet(key,new java.util.HashSet<>(values));
                }
            }
            revert.commit();
            OperatorBackupStore.importJson(context,priorOperators);
            RankedSiteSafeBackupStore.restoreSnapshots(context,priorSites);
            throw error;
        }
    }

    private static byte[] buildZip(Context context,Set<String> selectedSiteIds) throws Exception {
        SharedPreferences prefs=context.getSharedPreferences(PREFS,Context.MODE_PRIVATE);
        JSONObject settings=new JSONObject();
        for(String key:BOOLEANS){
            if(prefs.contains(key))settings.put(key,prefs.getBoolean(key,false));
        }
        String size=prefs.getString("content_size","standard");
        if("standard".equals(size)||"compact".equals(size)||"large".equals(size))
            settings.put("content_size",size);
        JSONObject siteSnapshots=RankedSiteSafeBackupStore.snapshot(context);
        JSONObject rawOperators=new JSONObject(OperatorBackupStore.exportJson(context));
        JSONObject safeOperators=RankedHubDataTransfer.sanitizeOperatorBackups(rawOperators);
        byte[] hub=settings.toString().getBytes(StandardCharsets.UTF_8);
        byte[] operators=safeOperators.toString().getBytes(StandardCharsets.UTF_8);
        if(hub.length>MAX_ENTRY||operators.length>MAX_ENTRY)
            throw new IllegalArgumentException("Backup entry too large");
        JSONArray entries=new JSONArray();
        if(selectedSiteIds.contains("hub"))entries.put(entry("hub","hub.json",hub));
        if(selectedSiteIds.contains("community"))entries.put(entry("community","community.json",operators));
        byte[] mw4=siteSnapshots.has(RankedSiteSafeBackupStore.MW4)
                ?siteSnapshots.getJSONObject(RankedSiteSafeBackupStore.MW4).toString()
                    .getBytes(StandardCharsets.UTF_8):null;
        byte[] arc=siteSnapshots.has(RankedSiteSafeBackupStore.ARC)
                ?siteSnapshots.getJSONObject(RankedSiteSafeBackupStore.ARC).toString()
                    .getBytes(StandardCharsets.UTF_8):null;
        if(selectedSiteIds.contains("dmz-v1")){
            if(mw4==null || mw4.length>MAX_ENTRY)
                throw new IllegalArgumentException("Capture safe MW4 settings before exporting");
            entries.put(entry("dmz-v1","mw4.json",mw4));
        }
        if(selectedSiteIds.contains("arc-raiders")){
            if(arc==null || arc.length>MAX_ENTRY)
                throw new IllegalArgumentException("Capture ARC graphics settings before exporting");
            entries.put(entry("arc-raiders","arc.json",arc));
        }
        if(entries.length()==0)throw new IllegalArgumentException("Nothing selected for backup");
        JSONObject manifest=new JSONObject();
        manifest.put("formatVersion",2);
        manifest.put("appPackage","com.harleytg.rankedhub.beta");
        manifest.put("createdAt",System.currentTimeMillis());
        manifest.put("entries",entries);
        ByteArrayOutputStream bytes=new ByteArrayOutputStream();
        try(ZipOutputStream zip=new ZipOutputStream(bytes)){
            put(zip,"manifest.json",manifest.toString().getBytes(StandardCharsets.UTF_8));
            if(selectedSiteIds.contains("hub"))put(zip,"hub.json",hub);
            if(selectedSiteIds.contains("community"))put(zip,"community.json",operators);
            if(selectedSiteIds.contains("dmz-v1"))put(zip,"mw4.json",mw4);
            if(selectedSiteIds.contains("arc-raiders"))put(zip,"arc.json",arc);
        }
        if(bytes.size()>MAX_FILE-256)throw new IllegalArgumentException("Backup too large");
        return bytes.toByteArray();
    }

    private static JSONObject entry(String id,String path,byte[] bytes)throws Exception{
        JSONObject obj=new JSONObject();
        obj.put("siteId",id);
        obj.put("schemaVersion",1);
        obj.put("dataPath",path);
        obj.put("size",bytes.length);
        obj.put("sha256",sha256(bytes));
        return obj;
    }
    private static void put(ZipOutputStream zip,String path,byte[] data)throws Exception {
        zip.putNextEntry(new ZipEntry(path));
        zip.write(data);
        zip.closeEntry();
    }

    private static Preview parseZip(byte[] plain)throws Exception {
        Map<String,byte[]> files=new HashMap<>();
        int total=0;
        try(ZipInputStream zip=new ZipInputStream(new ByteArrayInputStream(plain))){
            ZipEntry item;
            while((item=zip.getNextEntry())!=null){
                String name=item.getName();
                if(item.isDirectory() || !("manifest.json".equals(name)||"hub.json".equals(name)
                        ||"community.json".equals(name)||"mw4.json".equals(name)
                        ||"arc.json".equals(name)) || files.containsKey(name))
                    throw new IllegalArgumentException("Unexpected or duplicate ZIP entry");
                ByteArrayOutputStream part=new ByteArrayOutputStream();
                byte[] buf=new byte[8192];
                int count;
                while((count=zip.read(buf))!=-1){
                    if(part.size()+count>MAX_ENTRY)throw new IllegalArgumentException("Oversized entry");
                    part.write(buf,0,count);
                }
                total+=part.size();
                if(total>MAX_FILE)throw new IllegalArgumentException("Oversized archive");
                files.put(name,part.toByteArray());
            }
        }
        if(files.size()<2 || files.size()>5 || !files.containsKey("manifest.json"))
            throw new IllegalArgumentException("Invalid backup entry count");
        JSONObject manifest=new JSONObject(new String(files.get("manifest.json"),StandardCharsets.UTF_8));
        int format=manifest.optInt("formatVersion",0);
        if(format!=1 && format!=2)throw new IllegalArgumentException("Unsupported backup version");
        JSONArray entries=manifest.optJSONArray("entries");
        if(entries==null || entries.length() < 1 || entries.length() > 4)
            throw new IllegalArgumentException("Backup manifest is incomplete");
        Set<String> seen=new HashSet<>();
        for(int i=0;i<entries.length();i++){
            JSONObject e=entries.getJSONObject(i);
            String site=e.optString("siteId","");
            String path=e.optString("dataPath","");
            if(!("hub".equals(site)&&"hub.json".equals(path)
                    ||"community".equals(site)&&"community.json".equals(path)
                    ||"dmz-v1".equals(site)&&"mw4.json".equals(path)
                    ||"arc-raiders".equals(site)&&"arc.json".equals(path))
                    ||!seen.add(site)||e.optInt("schemaVersion",0)!=1)
                throw new IllegalArgumentException("Invalid backup destination");
            byte[] payload=files.get(path);
            if(payload==null || payload.length!=e.optInt("size",-1)
                    ||!sha256(payload).equals(e.optString("sha256","")))
                throw new IllegalArgumentException("Corrupt backup checksum");
        }
        if(seen.size()!=files.size()-1
                || (format==1 && (!seen.contains("hub")||!seen.contains("community")||seen.size()!=2))
                || (format==1 && (files.containsKey("mw4.json")||files.containsKey("arc.json"))))
            throw new IllegalArgumentException("Incomplete destination list");
        JSONObject siteSnapshots=new JSONObject();
        if(files.containsKey("mw4.json")){
            JSONObject safe=RankedSiteSafeBackupStore.validate(RankedSiteSafeBackupStore.MW4,
                    new JSONObject(new String(files.get("mw4.json"),StandardCharsets.UTF_8)));
            siteSnapshots.put(RankedSiteSafeBackupStore.MW4,safe);
        }
        if(files.containsKey("arc.json")){
            JSONObject safe=RankedSiteSafeBackupStore.validate(RankedSiteSafeBackupStore.ARC,
                    new JSONObject(new String(files.get("arc.json"),StandardCharsets.UTF_8)));
            siteSnapshots.put(RankedSiteSafeBackupStore.ARC,safe);
        }
        JSONObject settings=files.containsKey("hub.json")
                ?new JSONObject(new String(files.get("hub.json"),StandardCharsets.UTF_8))
                :new JSONObject();
        JSONObject operators=files.containsKey("community.json")
                ?new JSONObject(new String(files.get("community.json"),StandardCharsets.UTF_8))
                :new JSONObject();
        // Even old archives must pass the current security filtering before restore.
        JSONObject safeOperators=RankedHubDataTransfer.sanitizeOperatorBackups(operators);
        JSONObject allowed=new JSONObject();
        for(String key:BOOLEANS){
            Object v=settings.opt(key);
            if(v instanceof Boolean)allowed.put(key,v);
        }
        String size=settings.optString("content_size","");
        if("standard".equals(size)||"compact".equals(size)||"large".equals(size))
            allowed.put("content_size",size);
        return new Preview(allowed,safeOperators,siteSnapshots,
                manifest.optLong("createdAt",0),files.size());
    }

    private static String sha256(byte[] bytes)throws Exception {
        byte[] h=MessageDigest.getInstance("SHA-256").digest(bytes);
        StringBuilder result=new StringBuilder();
        for(byte b:h)result.append(String.format(java.util.Locale.US,"%02x",b&255));
        return result.toString();
    }
    private static byte[] seal(byte[] plain,char[] passphrase)throws Exception {
        byte[] salt=new byte[16],nonce=new byte[12];
        new SecureRandom().nextBytes(salt);
        new SecureRandom().nextBytes(nonce);
        PBEKeySpec spec=new PBEKeySpec(passphrase,salt,KDF_ITERATIONS,256);
        byte[] key=SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded();
        spec.clearPassword();
        Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE,new SecretKeySpec(key,"AES"),new GCMParameterSpec(128,nonce));
        byte[] header=ByteBuffer.allocate(32).put(MAGIC).put(salt).put(nonce).array();
        cipher.updateAAD(header);
        byte[] ciphertext=cipher.doFinal(plain);
        Arrays.fill(key,(byte)0);
        ByteBuffer result=ByteBuffer.allocate(header.length+ciphertext.length);
        result.put(header).put(ciphertext);
        return result.array();
    }
    private static byte[] open(byte[] encrypted,char[] passphrase)throws Exception {
        if(encrypted.length<48 || encrypted.length>MAX_FILE)
            throw new IllegalArgumentException("Invalid backup file size");
        ByteBuffer input=ByteBuffer.wrap(encrypted);
        byte[] magic=new byte[4],salt=new byte[16],nonce=new byte[12];
        input.get(magic);
        if(!Arrays.equals(magic,MAGIC))throw new IllegalArgumentException("Unrecognized Ranked HQ backup");
        input.get(salt);input.get(nonce);
        byte[] header=Arrays.copyOf(encrypted,32);
        byte[] payload=new byte[encrypted.length-32];
        input.get(payload);
        PBEKeySpec spec=new PBEKeySpec(passphrase,salt,KDF_ITERATIONS,256);
        byte[] key=SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded();
        spec.clearPassword();
        try{
            Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE,new SecretKeySpec(key,"AES"),new GCMParameterSpec(128,nonce));
            cipher.updateAAD(header);
            return cipher.doFinal(payload);
        }finally{Arrays.fill(key,(byte)0);}
    }
}
