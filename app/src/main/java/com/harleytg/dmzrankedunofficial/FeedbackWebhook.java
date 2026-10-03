package com.harleytg.dmzrankedunofficial;

import android.util.Base64;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

/**
 * Keeps the Discord webhook out of plaintext resources/source.
 *
 * Important: this protects against casual plaintext extraction only. Any secret
 * shipped inside a client APK can ultimately be recovered by a determined
 * reverse engineer. A server-side relay is required for true secret isolation.
 */
final class FeedbackWebhook {
    private static final String ENCRYPTED =
            "h6HIIbqrrYXcEugmtQAJWH/Z61UDBlydKpfuImU0fFIcwWnYDycYSPKXjK8IB/PPFcXg2J7oGz+IFLcx43mb7myUmCf+ukvlLdzl++SNA7L7AS1UMDvjlMWjFE1SwlLQhUD/vvQrylg732ZE/PdpeaRJRT/JBcgUhFyMwt/XheHNyYbrTuM1AQe1lAnmhT+28fS/LGg=";

    private static final int[] MASK = {
            184,109,228,42,152,229,51,205,162,187,26,5,6,164,53,145,
            73,216,252,205,208,48,97,243,168,178,225,117,194,115,233,95
    };

    private static final int[] KEY_XOR = {
            211,190,254,62,140,161,250,53,215,168,65,163,78,39,151,40,
            3,41,196,211,233,104,236,85,33,55,67,81,57,130,10,4
    };

    private FeedbackWebhook() {
    }

    static String getUrl() throws Exception {
        byte[] key = new byte[32];
        for (int i = 0; i < key.length; i++) {
            key[i] = (byte) (MASK[i] ^ KEY_XOR[i]);
        }

        byte[] packed = Base64.decode(ENCRYPTED, Base64.NO_WRAP);
        byte[] nonce = Arrays.copyOfRange(packed, 0, 12);
        byte[] ciphertextAndTag = Arrays.copyOfRange(packed, 12, packed.length);

        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(128, nonce));
        byte[] plaintext = cipher.doFinal(ciphertextAndTag);

        Arrays.fill(key, (byte) 0);
        return new String(plaintext, StandardCharsets.UTF_8);
    }
}
