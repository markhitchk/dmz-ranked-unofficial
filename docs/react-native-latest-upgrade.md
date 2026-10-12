# React Native Upgrade Experiment — October 2026

This PR tests the newest Expo-supported React Native preview, **not a released stable upgrade**.

React Native's latest stable release: **0.87.1** (October 11, 2026).
Expo SDK 57 supports **RN 0.86.3**; Expo SDK 58 beta targets **RN 0.88 RC**.
Do not use stable RN 0.87.1 with the unmodified Expo 57 native build system.

## Test checklist
- [ ] Resolve `expo@next` beta and install native packages with `expo install --fix`
- [ ] Commit aligned exact package versions and package-lock.json
- [ ] Expo Doctor
- [ ] TypeScript checks
- [ ] Unit tests
- [ ] Android `expo prebuild --clean`
- [ ] Android beta APK build
- [ ] Android device launch, site load, scroll, operator autofill
- [ ] Android notifications, background tasks and widgets
- [ ] Beta and Stable package identity, Play upload key verification
- [ ] iOS native build and runtime test
- [ ] Explicit decision to wait for SDK 58 stable / RN 0.88 stable before releasing

**Production and react-native-migration remain unchanged until this is verified.**

## Latest preview CI run
- First test found npm peer dependency rejection of the RN 0.88 release candidate. The preview-only workflow now enables prerelease-aware dependency resolution; runtime and native build verification remain required.
