# DMZ Ranked Native Motion — Verification Record

Plan: `docs/superpowers/plans/2026-10-09-dmz-native-motion-implementation.md`  
Branch: `react-native-migration`

## Implemented code under review
- Motion preference combining App animations, OS Reduce Motion and app foreground state.
- Native Pressable feedback in header, Settings, Feedback, dialogs and Notification Center.
- Settings entrance native fade/slide on Android; no per-FlatList-row layout animation.
- Guarded dialog entry/exit and Feedback page opening.
- Notification tabs and bounded message expansion effects; no notification storage migration.
- Header rotating build/studio metadata, background-aware loading/logo loop, OS-aware WebView overlay fades.

## Required checks before release
- GitHub Actions `npm test`, `npm run typecheck`, `npx expo-doctor`.
- Android `assembleRelease`, apksigner verify and zipalign verify.
- Confirm actual Beta versionCode/build and package.
- Verify on Samsung Galaxy A17 5G Android 16 when available: button press/hold/scroll, disabled nav, Settings search with keyboard, Switch one tap, reduced-motion OS option, dialog close/reopen, Feedback, notification History after restart, WebView retry and regular scrolling.
- Compare frame times for Settings/WebView animations ON and OFF via Android frame profiler when the device is available.

**Hardware frame-rate measurements:** not collected in this environment; the CI pipeline can verify builds and static/unit tests but not on-device fluidity. Do not infer measured FPS.
**Release version:** Beta 1.1.0 (185), Stable unchanged.
