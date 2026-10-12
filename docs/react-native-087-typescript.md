# React Native 0.87.1 / TypeScript 6.0.3 compatibility test

This is **an isolated experiment**, based on `react-native-migration` at commit `80b5b494fce55368d3890734588174dd3cf95508`, not a production release.

- React Native: exact `0.87.1` (stable), with Strict TypeScript API enabled.
- React: exact `19.2.3`.
- TypeScript: exact `6.0.3` in `devDependencies`, with `strict: true` in `tsconfig.json`.
- Expo: pinned `58.0.0-canary-20260812-27f94d4` and matching Expo module canary builds, because stable Expo SDK 57 targets RN 0.86 and SDK 58 beta targets RN 0.88.
- Android: compile SDK 37, target SDK 36, release minification off while WorkManager/Room crash regression is investigated.
- Test: npm install; Expo dependency alignment (with hard assertion that RN stays **0.87.1**); Expo Doctor; Strict TypeScript; JS unit tests; Android release APK; Android 16 startup smoke test.

Do not merge into `react-native-migration` or publish an APK unless **all** compatibility and launch tests pass. The APK is an experimental test package. No change to the Stable Play build gate or signing has been made. A packaged APK does not prove on-device Samsung stability.
