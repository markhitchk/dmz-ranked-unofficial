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
