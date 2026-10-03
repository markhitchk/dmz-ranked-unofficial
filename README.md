# DMZ Ranked Unofficial

Unofficial Android wrapper for **https://dmzranked.com/**.

## Credits

- **Built by Harley's Studios**
- **Made by Yolando & dchinz**
- Yolando: YouTube **@itsyolando** and Twitch creator

## App features

- Native **DMZ Ranked** title bar with the supplied DMZ Ranked logo.
- Native loading screen shown while the DMZ Ranked website loads in the background.
- Loading progress bar with optional **verbose loading details**.
- Settings for desktop mode, keeping the screen awake, and verbose loading.
- Reload and clear web cache/cookies controls.
- Creator credits with Yolando and dchinz profile images.
- JavaScript, DOM storage, cookies, file uploads, and DMZ Ranked section back-navigation support.
- External navigation is blocked except for the approved PayPal support link.
- Offline/error page when the website cannot load.

## Android configuration

- Package: `com.harleytg.dmzrankedunofficial`
- Minimum Android: API 26
- Target/compile SDK: API 36
- Current source version: `1.0.10` (`110`)

## Build

The repository includes a GitHub Actions build workflow. You can also build locally with JDK 17, Android SDK 36, and Gradle 8.11.1:

```bash
gradle assembleDebug
```

The output APK is created at:

`app/build/outputs/apk/debug/app-debug.apk`

## Notice

This is an unofficial client. DMZ Ranked website content and third-party trademarks belong to their respective owners.
