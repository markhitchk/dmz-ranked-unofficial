# Ranked Hub — DMZ Ranked Unofficial Android Client

A native Android game-selection hub maintained by **Harley's Studios**, combining Harley's ranked projects and the original **DMZRanked.com** community client in one Android app.

## Ranked destinations

- **DMZ Ranked — MW4 V1:** https://dmz-ranked.vercel.app/#v1 (Harley's Studios)
- **ARC Raiders Ranked:** https://arc-raiders-ranked.vercel.app/ (Harley's Studios)
- **DMZRanked.com:** https://dmzranked.com/ (original third-party community experience by YoLando and dCHINZ)

The Android launcher opens a native **Ranked Hub** screen. Choosing the original community site enters the existing `MainActivity`, preserving its current app integration, operator flows, notifications, and settings. Choosing one of Harley's sites opens `RankedSiteActivity` with its own origin-scoped browser data and file picker support. The hub does not merge usernames, PINs, profiles, or ranking databases.

## Android package and development

The existing package ID `com.harleytg.dmzranked` and build variants are retained so upgrades do not require installing a separate application. Minimum SDK: API 26. Compile/target SDK: API 36. Build with the repository's Gradle configuration and JDK 17.

```bash
gradle assembleDebug
```

Output: `app/build/outputs/apk/debug/app-debug.apk`

## Security and attribution

The new game browser loads only the explicitly allowlisted HTTPS first-party hosts. Other HTTP(S) destinations open externally rather than inheriting the embedded site's origin. User credentials and auth sessions remain managed by each website. DMZRanked.com is an independent third-party project; this app is unofficial and is not endorsed by its owners.

## Implementation status

The game-selection hub and site browser have been added on the `feature/ranked-hub-multigame` branch. Android installation, session persistence, website OAuth flows, and account features require validation in a real APK before release.
