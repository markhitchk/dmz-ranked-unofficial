# DMZ Ranked App — React Native + TypeScript migration

This branch is the Android/iOS migration of the DMZ Ranked Unofficial app.

## Stack

- React Native via Expo SDK 57
- TypeScript
- React Native WebView
- AsyncStorage for app preferences
- NetInfo for connection state
- Expo Notifications for Android tray alerts and a persistent in-app Notification Center unifying website events, system alerts, raid reports, and remote Harley's Studios messages
- Continuous Native Generation: Android/iOS projects are generated from `app.config.ts`

The existing dmzranked.com site remains the source of the main experience. The app injects the canonical `remote/app-ui/app.css` and `remote/app-ui/app.js` into the WebView.

## Run

1. Install Node.js 22.13+.
2. Run `npm install`.
3. Run `npm run check`.
4. Android: `npm run android`.
5. iOS on macOS: `npm run ios`.

## Native projects

Do not hand-maintain duplicate Android/iOS application code. Generate it when needed with:

`npm run prebuild:clean`

Stable package/bundle ID: `com.harleytg.dmzranked`

Beta package/bundle ID: `com.harleytg.dmzranked.beta`

Set `APP_VARIANT=beta` for beta builds.

## Remote UI

The app loads the shared `remote/app-ui/app.css` and `remote/app-ui/app.js` from the main GitHub branch at runtime. If those files are temporarily unavailable, dmzranked.com remains usable and the app retries on the next page load.

## Migration

The old Java Android implementation is intentionally not part of this branch. Shared application behavior now lives under `src/` in TypeScript. Android and iOS projects are generated from the shared configuration when a native build is required.

## Build tooling and dependency freshness

- GitHub Actions uses the latest available Node.js **24 LTS patch**, a current **JDK 17 patch**, current major GitHub Actions, and the **Expo-generated Gradle wrapper**. Android SDK Build Tools is selected by the Expo/Android Gradle Plugin instead of hardcoding an old version.
- **Each build** runs `expo install --check` and `expo-doctor`, and reports newer packages with `npm outdated`. A build fails if Expo detects incompatible dependencies.
- Once `package-lock.json` is committed, release and test builds use `npm ci` for repeatability. Until then, they use `npm install` and emit a warning.
- `.github/dependabot.yml` is prepared to check npm and GitHub Actions updates daily once the config is also present on the GitHub default branch. `.github/workflows/dependency-refresh.yml` runs on every push to `react-native-migration`, updates supported dependencies, generates/refreshes the npm lockfile, runs tests, and opens a PR. Merge only after checks pass.
- Updates to a newer React Native/Expo SDK generation **must be tested together**. Never silently install incompatible newest-major releases or change a release's signing certificate.

**GitHub platform note:** Scheduled Actions and Dependabot configuration run from the repository's default branch. This change deliberately does not modify the Java `main` branch. The push-triggered refresh works on `react-native-migration`; for unattended daily updates, separately add the scheduler/Dependabot configuration to the default branch. Automated pull-request creation also requires the repository Actions setting that permits GitHub Actions to create PRs.

## Experimental React Native upgrade (isolated branch)

This branch is **an experiment only**, not the production release. As of October 11, 2026, the latest stable React Native is **0.87.1**. Expo SDK 57 is designed for RN 0.86. Expo SDK 58 beta moves ahead to the RN **0.88 release candidate**, so we are testing the officially paired preview stack here rather than forcing RN 0.87 into the incompatible SDK 57 build system.

- Proposed stack: **Expo SDK 58 beta** (`expo@next`), **React Native 0.88.0-rc.4**, **React 19.3.0**. This is NOT a stable React Native release.
- Each CI run executes `npx expo install --fix --npm` before type checking and native builds to align Expo packages with the preview SDK. Versions are not yet fully pinned in a lockfile; **do not distribute these builds** until alignment and actual device tests pass.
- Confirm: WebView behavior, DMZ messages, operator protected autofill, notifications, Android widgets, background tasks, performance settings, both package IDs, signing, and Google Play compatibility.
- Do not merge until these checks pass, exact resolved dependency versions are committed, and separate beta APK device testing succeeds.

**Preview-only npm caveat:** Some peer version ranges reject pre-release React Native. This branch sets `NPM_CONFIG_LEGACY_PEER_DEPS=true` for the preview CI dependency resolver; Expo Doctor, TypeScript, native compilation, and actual device tests are still mandatory. This is not enabled in production workflows.

## Expo SDK 58 beta upgrade merged into the migration branch

This branch currently specifies React Native **0.88.0-rc.4** with Expo **SDK 58 prerelease**. The upgraded Expo packages are declared at their SDK 58-compatible versions; CI installs prerelease peer dependencies and runs Expo Doctor, TypeScript and unit tests. While preview toolchains are in use, the stable Google Play AAB workflow intentionally refuses to build distributable release artifacts. This is a safety gate, not confirmation that native compilation has passed. Testing requires a successful APK build and actual Android device verification before any Play release. No legacy Java V1 interface is part of the app.
