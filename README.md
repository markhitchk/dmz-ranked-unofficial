# DMZ Ranked Unofficial

Unofficial Android wrapper for **https://dmzranked.com/**.

This source tree was reconstructed from the existing DMZ Ranked Unofficial APK and cleaned into a small native Android project.

## App features

- Native **DMZ Ranked** title bar with the app logo.
- Settings cog in the title bar.
- In-app settings for external links, desktop mode, and keeping the screen awake.
- Reload and clear web cache/cookies controls.
- About section identifying the unofficial Android app as made by **Harley's Studios**.
- JavaScript, DOM storage, cookies, file uploads, downloads, and DMZ Ranked section back-navigation support.
- External non-DMZ Ranked links can open in the device browser.
- Offline/error page when the website cannot load.

## Android configuration

- Package: `com.harleytg.dmzrankedunofficial`
- Minimum Android: API 26
- Target/compile SDK: API 36
- Current source version: `1.0.9` (`109`)

## Build

The repository includes a GitHub Actions build workflow. You can also build locally with JDK 17, Android SDK 36, and Gradle 8.11.1:

```bash
gradle assembleDebug
```

The output APK is created at:

`app/build/outputs/apk/debug/app-debug.apk`

## Notice

This is an unofficial client. DMZ Ranked website content and third-party trademarks belong to their respective owners.
