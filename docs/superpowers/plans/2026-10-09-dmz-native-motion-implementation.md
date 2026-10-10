# DMZ Ranked Native Motion Restoration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore Java-originated native motion and consistent, lightweight press feedback across DMZ Ranked's React Native Android UI without bringing back WebView/Settings stutter.

**Architecture:** A small React Native motion context combines the existing user preference with OS reduced-motion and app lifecycle state. Reusable native-driver press feedback and scoped entrance/exit effects apply only to app-owned controls; the WebView, Settings list virtualization, message storage, and app assets remain unchanged. Every slice has a separate test/verification and commit.

**Tech Stack:** React Native 0.86.3, React 19.2.3, Expo SDK 57, TypeScript, `Animated`, `Pressable`, `AccessibilityInfo`, `AppState`, Node `--experimental-strip-types --test`, GitHub Actions Android APK workflows.

**Spec:** `docs/superpowers/specs/2026-10-09-dmz-native-motion-design.md`

## Global Constraints

- Modify **only** `react-native-migration` in `markhitchk/dmz-ranked-unofficial`; leave Java `main` unchanged.
- Honor `settings.appAnimations` AND system reduced motion; on disable, immediately render a complete, usable final state.
- Preserve package IDs `com.harleytg.dmzranked.beta` and `com.harleytg.dmzranked`; maintain current Expo/React Native dependency versions. No new animation library or dependency by default.
- Retain dark/gold styling, compact one-row native header, Android status bar/cutout safe areas, icons and the selected operator.
- Keep website DOM/remote `app-ui` CSS/JS, operator backup functionality, WebView load gate, navigation, and persistent **read-only** notification History untouched.
- Animate native-driver-compatible opacity and transforms; **never** animate per-row list layout or wrap/intercept WebView scroll touches.
- Cancel timers, subscriptions, loops, and in-flight animations when screens close, preferences change, or the app backgrounds; preserve accessibility and Android font scaling.
- Compare to Java values where applicable: Settings search 180 ms; list viewport 240 ms plus 45 ms delay; dialog entry 190 ms; exit 150 ms; loading logo pulse 620 ms per leg; title opacity pulse 520 ms per leg; loading fade 180 ms; metadata 4200 ms with 130/190 ms crossfade.
- Test Android 16 Samsung Galaxy A17 5G where available. Never claim measured smoothness without a device benchmark. Keep Beta/Stable behavior aligned, but produce a Beta APK only after all checks.

## Review Focus

Each item must be exercised by the named task in addition to its explicit tests:
1. **Scrolling while touching a card:** finger moves from press into Settings scroll; press scale returns to 1 and no phantom action fires — Task 2 and Task 3 device interaction checks.
2. **Switch/card double dispatch:** a tap on the toggle row or Switch changes its setting **exactly once**; accessibility switch actions also work — Task 3 tap-path matrix.
3. **Dialog races:** Back, outside tap, rapid reopen, or setting reduced motion mid-close cannot leave a transparent card or invoke the callback twice — Task 4 reducer test and manual race checks.
4. **Large immutable History:** rapid tabs, Read More, and Remove with 100+ messages do not drop, re-order, or delete history entries — Task 6 tests and persisted-state check.
5. **Background/bad network:** minimize the app during a looping logo/title animation or reload a failing WebView; no leaked loop/overlay and no blocked retry — Task 7 lifecycle check and Task 8 build/manual verification.

---

## Component / file ownership

| File | Responsibility |
|---|---|
| Create `src/motion/motionPolicy.ts` | Pure shared timing tokens, preference/lifecycle policy, press targets |
| Create `src/motion/MotionProvider.tsx` | `AccessibilityInfo` + `AppState` subscriptions and motion context |
| Create `src/motion/MotionPressable.tsx` | One animated native Pressable with unchanged touch/accessibility semantics |
| Create `src/motion/dialogTransition.ts` | Pure transition state machine and close/reopen guard |
| Create `src/motion/headerMetadata.ts` | Pure alternating metadata selection helper |
| Create `src/motion/notificationMotion.ts` | Pure tab-selection target for native notification controls |
| Create `tests/motionPolicy.test.mjs`, `tests/dialogTransition.test.mjs`, `tests/headerMetadata.test.mjs`, `tests/settingsMotion.test.mjs`, `tests/feedbackMotion.test.mjs`, `tests/notificationMotion.test.mjs` | Node-run pure motion-logic regression tests |
| Modify `src/App.tsx` | Wrap native UI in provider, preserve current props/visibility |
| Modify `src/components/AppHeader.tsx` | Buttons, metadata rotation, loading/title behavior |
| Modify `src/components/SettingsPanel.tsx` | Native actions, safe Settings entrance, compact content expand |
| Modify `src/components/DmzDialog.tsx` | Guarded enter/exit state and press feedback |
| Modify `src/components/FeedbackPanel.tsx` | Fade/slide and interactive controls |
| Modify `src/components/AppMessagesPanel.tsx` | Tabs/expansion/touch feedback, unchanged history data |
| Modify `src/components/LoadingOverlay.tsx`, `src/screens/DmzWebScreen.tsx` | Preserve/start-stop pulses and loading fade |
| Update relevant `docs/` and `app.config.ts` / APK workflow artifact names **only** during final release task | Document validation and ship verified Beta |

`src/components/DmzSurface.tsx` remains presentational; do not make every card animate just because it uses `DmzCard`. Animate only actionable wrappers.

## Task 1: Motion preferences, lifecycle, and shared tokens

**Files:** Create `src/motion/motionPolicy.ts`, `src/motion/MotionProvider.tsx`, `tests/motionPolicy.test.mjs`; modify `src/App.tsx` around the returned native component tree.

**Interfaces:**
- `export type MotionPolicy = { enabled: boolean; loopsEnabled: boolean }`
- `export function deriveMotionPolicy(preferenceEnabled: boolean, reducedMotion: boolean, appForeground: boolean): MotionPolicy`
- `export const MOTION = { pressInMs:90, pressedScale:0.97, settingsSearchMs:180, settingsContentMs:240, settingsContentDelayMs:45, dialogOpenMs:190, dialogCloseMs:150, loadingFadeMs:180, logoPulseLegMs:620, titlePulseLegMs:520, metadataIntervalMs:4200, metadataFadeOutMs:130, metadataFadeInMs:190 } as const`
- `export function MotionProvider({ enabledByUser, children }: PropsWithChildren<{enabledByUser:boolean}>): React.JSX.Element`
- `export function useMotion(): MotionPolicy`

- [ ] **Step 1 — RED test:** In `tests/motionPolicy.test.mjs`, assert all eight combinations of three Boolean inputs. `enabled = preferenceEnabled && !reducedMotion`; `loopsEnabled = enabled && appForeground`. Assert exact `MOTION` values above.
- [ ] **Step 2 — Verify RED:** Run `node --experimental-strip-types --test tests/motionPolicy.test.mjs`. Expected: module/export not found.
- [ ] **Step 3 — Implement:** Pure helper/tokens in `motionPolicy.ts`. Provider reads initial `AccessibilityInfo.isReduceMotionEnabled()`, subscribes to `AccessibilityInfo.addEventListener('reduceMotionChanged', ...)` and `AppState.addEventListener('change', ...)`, handles unsubscribe and unavailable reads, then derives a policy. Do not store a second user preference.
- [ ] **Step 4 — Wire:** In `src/App.tsx` `AppContent`, enclose the existing `AppSafeArea` UI tree in `<MotionProvider enabledByUser={settings.appAnimations}>`; keep `useSettings` lifecycle and WebView intact.
- [ ] **Step 5 — GREEN checks:** Run `node --experimental-strip-types --test tests/motionPolicy.test.mjs`, `npm run typecheck`, and `npm test`. Expected: all pass; re-check context is accessible from modal descendants.
- [ ] **Step 6 — Commit:** `git add src/motion/motionPolicy.ts src/motion/MotionProvider.tsx tests/motionPolicy.test.mjs src/App.tsx && git commit -m "feat: centralize native motion preference and reduced-motion policy"`.

## Task 2: Native button feedback and header action controls

**Files:** Create `src/motion/MotionPressable.tsx`; modify `src/components/AppHeader.tsx`; extend `tests/motionPolicy.test.mjs` for shared press targets.

**Interfaces:**
- `export type MotionPressableProps = PressableProps & { children?: React.ReactNode; pressedScale?: number }`
- `export function MotionPressable(props: MotionPressableProps): React.JSX.Element`
- `export function pressScaleTarget(pressed: boolean, disabled: boolean, policyEnabled: boolean): number` in `motionPolicy.ts`.

- [ ] **Step 1 — RED test:** Assert `pressScaleTarget(true,false,true)===0.97` and all released/disabled/reduced-motion cases return `1`. Assert `MOTION.pressInMs===90`.
- [ ] **Step 2 — Verify RED:** Run isolated policy test; expected missing function failure.
- [ ] **Step 3 — Implement:** Use one `Animated.Value(1)` per **interactive mounted** native control, animate transforms with `useNativeDriver:true` on press in (90 ms) and spring reset on press out/cancel; on disabled/policy off immediately snap to 1. Forward `onPress`, `onLongPress`, `onPressIn`, `onPressOut`, `hitSlop`, style, accessibility, `android_ripple` and ref/event behavior. Do not change action timing or wrap the WebView.
- [ ] **Step 4 — Wire:** Replace header Settings/bell, back/forward, reload, URL edit/copy/cancel actions in `AppHeader.tsx`. Preserve disabled nav states and URL editing focus.
- [ ] **Step 5 — GREEN/interaction:** `npm test && npm run typecheck`. On Android test tap, held press, drag-to-scroll cancel, disabled Back/Forward and long-press URL copy. Expected: once-only actions and no stuck scale or hit-target drift.
- [ ] **Step 6 — Commit:** `git add src/motion/motionPolicy.ts src/motion/MotionPressable.tsx tests/motionPolicy.test.mjs src/components/AppHeader.tsx && git commit -m "feat: add native press feedback to header controls"`.

## Task 3: Settings action controls and performant entry

**Files:** Modify `src/components/SettingsPanel.tsx`; add `tests/settingsMotion.test.mjs` for a pure `src/motion/settingsMotion.ts` helper.

**Interfaces:**
- `export function settingsEntryState(visible:boolean, enabled:boolean): { opacity:number; searchOffsetY:number; contentOffsetY:number }`
- `export function shouldStartSettingsEntry(previousVisible:boolean, nextVisible:boolean, enabled:boolean): boolean`
- Consumes `useMotion()`, `MotionPressable`, `MOTION`.

- [ ] **Step 1 — RED test:** Assert entry starts only on a false→true visibility transition when motion is enabled; query edits do not count as a new opening; motion-disabled output is `{opacity:1,searchOffsetY:0,contentOffsetY:0}`; enabled initial offsets use search `-10` and content `18`.
- [ ] **Step 2 — Verify RED:** Run `node --experimental-strip-types --test tests/settingsMotion.test.mjs`; expected missing module.
- [ ] **Step 3 — Implement:** Native-driver fade/translateY of the **search box and bounded visible list container only**, 180 ms search, 240 ms list after 45 ms. Remove the `Platform.OS === 'android'` animation bypass; do not animate FlatList rows, disturb `removeClippedSubviews`, pagination, scroll state, keyboard or deferred search.
- [ ] **Step 4 — Buttons:** Apply `MotionPressable` to actionable Settings rows, back, Credits, content-size segments, operator cards and developer controls; ensure Switch uses exactly one value-change path and its existing accessibility behavior (no double toggle or nested gesture conflict). Leave plain decorative cards static.
- [ ] **Step 5 — GREEN/regression:** Run isolated test, `npm test`, `npm run typecheck`. On device: scroll with finger down on a card, use Switch and whole-row tap, search rapidly, reopen Settings repeatedly in Compact/Standard/Large and toggle animations during an opening. Expected: no action duplication, jank regression or font clipping.
- [ ] **Step 6 — Commit:** `git add src/components/SettingsPanel.tsx src/motion/settingsMotion.ts tests/settingsMotion.test.mjs && git commit -m "feat: restore safe Settings entrance and card feedback"`.

## Task 4: Dialog closing state machine, actions and press feedback

**Files:** Create `src/motion/dialogTransition.ts`, `tests/dialogTransition.test.mjs`; modify `src/components/DmzDialog.tsx`.

**Interfaces:**
- `export type DialogPhase = 'hidden' | 'entering' | 'shown' | 'exiting'`
- `export type DialogEvent = 'open' | 'entered' | 'close' | 'exited'`
- `export function nextDialogPhase(phase:DialogPhase, event:DialogEvent): DialogPhase`

- [ ] **Step 1 — RED test:** Assert `hidden→entering→shown→exiting→hidden`, open-during-exit returns `entering`, repeated close stays `exiting`, stale `exited` cannot hide a reopened dialog. Add the review-focus test for Back/outside tap and repeated action/close requests.
- [ ] **Step 2 — Verify RED:** Run isolated dialog test; expected missing module.
- [ ] **Step 3 — Implement:** Retain existing 190 ms open card fade+scale+10 px translate. Add 150 ms exit before unmount. Guard animation completion callbacks using current phase/revision, cancel old animations when visibility changes, immediately settle when motion disabled, and clean up when unmounted.
- [ ] **Step 4 — Action feedback:** Migrate positive/negative/choice controls to `MotionPressable`. Keep dialog `onPositive` and `onNegative` once-only and support hardware Back, tap-outside and keyboard; no double submit.
- [ ] **Step 5 — GREEN/regression:** Run isolated test, `npm test`, `npm run typecheck`; manually rapidly reopen while exiting and toggle reduced-motion/app setting mid-transition. Expected no stuck invisible scrim or duplicate action.
- [ ] **Step 6 — Commit:** `git add src/motion/dialogTransition.ts tests/dialogTransition.test.mjs src/components/DmzDialog.tsx && git commit -m "feat: animate modal exit with guarded transitions"`.

## Task 5: Feedback page transition and controls

**Files:** Modify `src/components/FeedbackPanel.tsx`; use `MotionPressable`, `useMotion` and `MOTION`.

**Interfaces:** Existing `FeedbackPanel` props and `sendFeedback` contract stay identical; `visible:boolean` controls a 180–240 ms transform/opacity entrance.

- [ ] **Step 1 — RED checkpoint:** Write a focused `tests/feedbackMotion.test.mjs` pure helper test for `feedbackEntryEnabled(visible:boolean,policy:MotionPolicy):boolean` in new `src/motion/feedbackMotion.ts`; prove false for closed or motion-disabled.
- [ ] **Step 2 — Verify RED:** Run `node --experimental-strip-types --test tests/feedbackMotion.test.mjs`; expected missing module.
- [ ] **Step 3 — Implement:** Animate only the visible screen content on opening with native-driver opacity/translateY; leave form fields and validation untouched. Use motion feedback for Back, category selector, Send and support links. Preserve `sending` disabled state; avoid extra submit calls.
- [ ] **Step 4 — GREEN/regression:** Run focused test, `npm test`, `npm run typecheck`; manual: keyboard visible, failed submit, successful submit, repeated open/close, Reduce Motion on/off.
- [ ] **Step 5 — Commit:** `git add src/motion/feedbackMotion.ts tests/feedbackMotion.test.mjs src/components/FeedbackPanel.tsx && git commit -m "feat: animate Feedback entry and actions"`.

## Task 6: Notification Center motion without touching the archive

**Files:** Create `src/motion/notificationMotion.ts`, `tests/notificationMotion.test.mjs`; modify `src/components/AppMessagesPanel.tsx`; extend `tests/notificationCenter.test.mjs`. **Do not modify** `src/services/notificationHistory.ts` or `src/services/notificationCenter.ts` for UI motion.

**Interfaces:**
- `export function notificationTabScale(selected:boolean, enabled:boolean):number` — selected tabs render at `1`, inactive tabs at `0.985` when motion is enabled, otherwise all `1`.
- Preserve `AppMessagesPanel` prop names and `NotificationCenterItem` IDs; consume `useMotion()`, `MotionPressable` and `MOTION`.

- [ ] **Step 1 — RED test:** Add `tests/notificationMotion.test.mjs`; test selected/inactive targets with motion on/off. Add a separate History regression test with a 200-entry fixture and simulated inbox removals in `tests/notificationCenter.test.mjs`.
- [ ] **Step 2 — Verify RED:** Run `node --experimental-strip-types --test tests/notificationMotion.test.mjs`; expected missing module.
- [ ] **Step 3 — Implement:** Animate active tab affordance (opacity/scale driven by helper) and single expanded message body using a bounded native fade; leave tab row height 48 px and vertical scrolling virtualization untouched. Use `MotionPressable` for tabs, Refresh, Mark Read, Remove, Read More and close. Do not add a Clear History action; history remains read-only.
- [ ] **Step 4 — GREEN/regression:** `npm test && npm run typecheck`. On device switch tabs with 100+ entries, expand/collapse and move-to-History, reboot app and verify history retention and count. Disabled animation shows immediate content.
- [ ] **Step 5 — Commit:** `git add src/motion/notificationMotion.ts tests/notificationMotion.test.mjs src/components/AppMessagesPanel.tsx tests/notificationCenter.test.mjs && git commit -m "feat: add lightweight Notification Center interactions"`.

## Task 7: Header metadata and loading parity, including lifecycle

**Files:** Create `src/motion/headerMetadata.ts`, `tests/headerMetadata.test.mjs`; modify `src/components/AppHeader.tsx`, `src/components/LoadingOverlay.tsx`, and **only if required for lifecycle cleanup** `src/screens/DmzWebScreen.tsx`.

**Interfaces:**
- `export function nextHeaderMetaIndex(previous:number, count:number):number` — stable two-message alternation without immediate repeats.
- Consumes `useMotion()`, `MOTION.metadataIntervalMs`, `MotionPolicy.loopsEnabled`.

- [ ] **Step 1 — RED test:** Ensure `nextHeaderMetaIndex(-1,2)===0`, then `nextHeaderMetaIndex(0,2)===1`, then back to `0`; handle zero/one message counts with stable valid index.
- [ ] **Step 2 — Verify RED:** Run isolated test; expected missing module.
- [ ] **Step 3 — Implement:** In compact metadata slot, show installed version/build and `Made by Harley's Studios` every ~4200 ms with fade 130/190 ms. Preserve title row/height, BETA badge and offline state; do not replace loading title pulse inadvertently. Stop interval when backgrounded, when screen unmounts, or when motion disabled; restore version/build text statically with motion disabled.
- [ ] **Step 4 — Loading:** Keep logo's existing 620 ms per-leg scale/opacity pulse; retain/fix title 520 ms pulse when loading, and overlay 180 ms completion fade. Cancel loops upon dismiss/back/foreground transitions. Do not make remote CSS/JS app-ui load gate or WebView retry wait on animations.
- [ ] **Step 5 — GREEN/regression:** Run isolated test, `npm test`, `npm run typecheck`; manual: background during loading, failed WebView retry, idle 4200 ms header transitions, animations off/reduced motion, Beta/Stable badge and metadata alignment.
- [ ] **Step 6 — Commit:** `git add src/motion/headerMetadata.ts tests/headerMetadata.test.mjs src/components/AppHeader.tsx src/components/LoadingOverlay.tsx src/screens/DmzWebScreen.tsx && git commit -m "feat: restore Java header metadata and loading animation parity"`. Omit `DmzWebScreen.tsx` from staging if it needs no changes.

## Task 8: Integration, performance and Beta artifact verification

**Files:** Create `docs/superpowers/motion-verification.md`; update `app.config.ts` Beta versionCode/buildNumber **only after verification passes**; update `.github/workflows/build-react-native-beta-apk.yml` and `.github/workflows/react-native-beta.yml` artifact filenames to the actual next Beta build. **Do not** change Stable package/version or Java main.

**Interfaces:** No public app APIs; deliver checkable smoke-test record and a GitHub Actions-produced APK.

- [ ] **Step 1 — Automated baseline:** Run `npm test`, `npm run typecheck`, `npx expo-doctor`; verify native policy tests and existing operator/notification tests remain green.
- [ ] **Step 2 — App smoke matrix:** Record Android 16 A17 5G results, if device accessible, for motion ON/OFF, OS Reduced Motion, Compact/Standard/Large, settings scroll gesture, Switch row taps, dialog reopening, loading retry, Feedback form and persistent read-only History. Record unavailable device checks as **not verified**, not passed.
- [ ] **Step 3 — Performance comparison:** Compare native Settings scroll and WebView scroll with animations ON versus OFF using `adb shell dumpsys gfxinfo` or frame profiling if available. Note measurable jank/frames; no invented FPS. Roll back/regulate any effect with repeatable scroll regression.
- [ ] **Step 4 — Release metadata:** Once tests and regressions pass, increment Beta-only build number from the **latest** `react-native-migration` branch value (currently 184 at plan time), and match both workflow artifact names. Verify `com.harleytg.dmzranked.beta` remains unchanged.
- [ ] **Step 5 — CI:** Commit final docs and build metadata; let `React Native migration` and `React Native Beta Verify and APK` workflows finish successfully. Inspect the APK artifact and ensure `apksigner verify --verbose --print-certs` and `zipalign -c -v 4` passed. Do not claim installable if CI fails.
- [ ] **Step 6 — Delivery:** Download the exact successful new-build ZIP, extract the contained APK, verify ZIP/APK and exact `/mnt/data/...` file path, then link only that verified file. Include build/version/package and note whether hardware performance tests ran.
- [ ] **Step 7 — Final review:** Request independent code review per execution method, especially Settings scrolling, dialog callback races, Android reduced motion and untouched notification storage; fix identified regressions before final delivery.

## Plan self-review

- **Spec coverage:** preference/reduced motion Task 1; shared press feedback Tasks 2–6; Settings parity Task 3; dialogs Task 4; Feedback Task 5; Notification Center Task 6; header/loading Task 7; validation/APK Task 8.
- **Interfaces:** App `MotionProvider` is upstream of all native screens; `useMotion` and `MOTION` are defined in Task 1 and consumed thereafter. `MotionPressable` is defined before its integration tasks. Pure helper modules are Node-testable without rendering React Native components.
- **Performance:** no native list row-by-row layout animation, no Website DOM injection, no additional dependency, no altered Settings persisted schema.
- **Out of scope:** Java main, WebView behavior, app-only operator data, remote CSS/JS, History permanence, user-facing themes.
- **Execution gate:** this plan is for user review. Do not start product-code changes, release bump or APK build until the user approves the plan and selects native vs subagent-driven execution.
