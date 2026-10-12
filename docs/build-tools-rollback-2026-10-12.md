# Stable build tools restored

Based on pre-preview baseline `91889782b71fee33c66f98c293b3784d1fccbeb1`, restore Expo `~57.0.23` and React Native `0.86.3` with React `19.2.3` and strict TypeScript `~6.0.3`.

Restore RN WebView `13.16.1` and its compatible refs, compile/target Android SDK 36, and the corresponding Expo 57 modules. Preserve the Play update module lazy-loader and the Android 16 R8/WorkManager crash workaround. Build 1.1.8 (194) identifies the rollback.

The RN 0.87.1 Expo canary test was unverified and failed dependency alignment; no stable Expo release is paired with RN 0.87. Do not promote a build until TypeScript, Expo Doctor, native compilation, and an Android 16 release APK startup smoke test succeed. Verify separately on a real Samsung Android 16 phone.
