# Android 16 startup crash — beta build 191 (October 12, 2026)

The actual release APK installed but immediately crashed on Android 16, **before the JavaScript runtime mounted**. This was proven by the Android 16 emulator logcat in GitHub Actions run 38208992978 (artifact: `dmz-beta-android-launch-diagnostics`).

## Evidence

```text
FATAL EXCEPTION: main
Process: com.harleytg.dmzranked.beta
java.lang.RuntimeException: Unable to get provider androidx.startup.InitializationProvider
Caused by: java.lang.RuntimeException: Failed to create an instance of class androidx.work.impl.WorkDatabase.canonicalName
at androidx.work.WorkManagerInitializer.create(...)
```

The build enabled `:app:minifyReleaseWithR8` during release compilation. WorkManager relies on a generated AndroidX Room WorkDatabase implementation, which broke during optimized initialization.

## Immediate release fix (beta 1.1.6, build 192)

- Disable `enableMinifyInReleaseBuilds` and `enableShrinkResourcesInReleaseBuilds` using `expo-build-properties`. Keep Android notification/background task features intact. This can increase APK/AAB size.
- Correct the launch-smoke shell-script syntax: the emulator runner executes individual script lines through `sh -c`, so multiline `if` was invalid and previously produced a false test failure.
- Guard the generated Gradle properties against accidentally re-enabling the broken optimizer.
- Install the **release** APK on an Android 16 emulator, wait 15 seconds, require the process to survive, and scan logcat for the app's fatal exceptions.
- Retain release startup logcat in CI artifacts.

## Required verification

- Android 16 emulator smoke test passes with native process alive.
- Real Samsung Android 16 phone: install over existing beta (same signature), cold launch repeatedly; test site, Settings, notification center, background tasks and widgets.
- Only consider reenabling R8 with verified WorkManager/Room `_Impl` keep rules and a passing **R8-enabled release** launch test.
- Keep stable Google Play artifacts blocked on prerelease React Native/Expo until verified stable framework and Play-signing checks are complete.
