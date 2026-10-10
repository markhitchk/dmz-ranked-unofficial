# DMZ Ranked Native Motion Restoration — Design Specification

**Status:** Proposed for user review (implementation not started)  
**Date:** 2026-10-09  
**Repository:** `markhitchk/dmz-ranked-unofficial`  
**Java reference:** `main` at `16b99812b79b31924b9307c5d685bf2abbda84b1`  
**Target:** `react-native-migration` (Android Beta and Stable; iOS-ready React Native code)  

## Goal and approved direction

Restore the missing native app animations from the original Java Android app, and add restrained modern feedback to native buttons and cards. The experience should feel responsive and complete without bringing back the WebView/Settings stutter reported during prior optimization work.

Keep the current DMZ Ranked dark/charcoal-and-gold design, visual density, title/header arrangement, icon assets, website DOM, remote app-ui overrides, operator backups, and notification functionality intact. The original Java implementation is the reference for existing behaviors, *not* a demand to invent animations that Java did not have. Shared press feedback is an intentional enhancement.

## Scope and ownership

**In scope:** app-owned React Native surfaces: the native title/navigation bar, Settings, Feedback, Notification Center, app-owned dialogs, local loading overlay, expandable app content, and relevant native actionable cards. The existing `App animations` preference must govern these surfaces.

**Out of scope:** changing `dmzranked.com` animations or injecting additional CSS/JavaScript into its WebView; replacing website buttons; Java V1 runtime resurrection; wholesale visual redesign; automatic haptics or sound; mandatory new dependencies; editing `main`; adding new notification transport or modifying persistent history retention.

**Definition of complete:** Each in-scope interaction class has an explicit motion or explicit deliberate no-motion behavior; existing functionality remains usable; animations can be disabled globally and through system accessibility; Android Beta and Stable share the same native behavior.

## Evidence-backed parity audit

| Area | Java source / observed behavior | Current React Native implementation | Design decision |
|---|---|---|---|
| Loading overlay | `MainActivity.java`: fade out 180 ms; loading logo scale 1 to 1.06 / alpha 0.78 in 620 ms legs; title opacity 0.62 in 520 ms legs | `LoadingOverlay.tsx` has 620 ms logo pulse and `DmzWebScreen.tsx` overlay fade | Keep parity and ensure loops stop; avoid duplicate animation drivers |
| Title metadata | `MainActivity.java`: alternates version/build and studio attribution around 4200 ms; fade down 130 ms / up 190 ms | `AppHeader.tsx` has loading-only title pulse; static compact version label | Animate inline metadata only, without changing title-bar height |
| Settings entrance | `SettingsActivity.java`: search fade / translateY(-10) 180 ms; scroll fade / translateY(18) 240 ms with 45 ms delay | `SettingsPanel.tsx` explicitly bypasses search entry animation on Android | Restore search and **bounded first-viewport** entrance on Android without animating every virtualized row |
| App-owned dialogs | `DmzDialog.java`: card alpha 0 to 1, scale 0.97 to 1, translateY(10) to 0 in 190 ms | `DmzDialog.tsx` already implements the opening motion; closing unmounts immediately | Preserve open, add reliable 150 ms close; support rapid reopen and dismissal during keyboard input |
| Settings controls | Java card taps toggle switches; no central spring press component | `SettingsPanel.tsx` and `DmzSurface.tsx` mostly use static Pressable/View styles | New optional, shared button/card press feedback (an enhancement) |
| Feedback | Java Settings-to-activity transition uses fade_in / fade_out | `FeedbackPanel.tsx` modal `animationType='none'` | Native-screen fade/slide matching app styling; no Website DOM changes |
| Notification Center | New RN-owned component, no Java counterpart | `AppMessagesPanel.tsx` uses modal fade with immediate tab/card state | Lightweight active-tab/selection feedback and one-item expansion, preserving History read-only |
| Native browser bar | Java refresh/back affordances, React Native compact title bar | `AppHeader.tsx` only Settings gear has Android ripple | Consistent feedback for actionable icons and disabled nav states |

These findings are from repository source review, not a device-measured animation performance benchmark.

## Motion architecture

### Preference and accessibility boundary

Add a small centralized native motion policy, e.g. `src/motion/MotionProvider.tsx` and `src/motion/useMotion.ts`, scoped inside the existing React Native app tree.

- Inputs: existing `settings.appAnimations` and Android/iOS OS reduced-motion accessibility setting; respond to live changes when supported.
- Effective motion enabled **only if** user setting is on **and** OS does not request reduced motion.
- When disabled, transitions complete immediately at their final visible state; button taps remain responsive. Progress, loading status and unread counts still update.
- Do not change the persisted settings schema or introduce a separate V1/Java animation path.
- Cancel animations and loops on unmount, screen dismissal, setting changes, and app backgrounding where applicable. Never leave a spinning or pulsing hidden view.
- No dependency on network availability, remote app-ui CSS, or WebView events for native press animations.

### Shared interaction primitive

Create a reusable `MotionPressable` native component or equivalent for app-owned actionable controls.

- Preserve normal Pressable semantics: `onPress`, `onLongPress`, `disabled`, accessibility labels/roles/state, hit slop, and Android ripple where already appropriate.
- When enabled: press in scales to ~0.97 in 90 ms; release springs to 1. Prefer native-driver-supported `transform` and `opacity`. Do not animate height, width, margin, or `FlatList` item layout while scrolling.
- Ignore animation on disabled controls; an interrupted press or unmount resets the transform and does not emit a second action.
- No surprise extra action dispatch, no delay before invoking `onPress`, and no wrapping WebView touch handling.
- Use shared timing/easing tokens; do not instantiate an independent event-driven render loop per button.

### Screen-level transitions

- **Settings:** on open, animate toolbar/search and first viewport, not the entire `FlatList`; target Java timing: search 180 ms, content 240 ms after 45 ms. Keep `removeClippedSubviews`, batched rendering, search filtering and scroll position semantics intact. Search query changes do **not** replay the entrance.
- **Feedback:** subtle screen content fade/slide on open, approximately 180–240 ms. Closing remains responsive; do not animate form validation or network submission states if it would hide progress.
- **Dialogs:** preserve 190 ms opening fade/scale/translateY. Implement 150 ms closing animation before unmount with cancellation/race handling when reopening; hardware Back, outside-tap, and action buttons remain logically single-shot.
- **Notification Center:** preserve existing modal fade and stable tab height; animate active filter highlight and at most the expanded/collapsed notice. Do not animate or remeasure all history entries on category changes. The read-only History tab and inbox removal semantics are unchanged.
- **Header:** resume the Java-style 4200 ms metadata alternation between installed version/build and Harley's Studios credit, with 130/190 ms opacity crossfade. Keep the compact one-row title bar layout and responsive dimensions. Do not loop while app in background or while animations are disabled.
- **Loading:** retain the existing 620 ms logo pulse, 520 ms title subtle pulse if restored, and 180 ms overlay fade; preserve the load-gate dependency on remote CSS/JS readiness, errors and retry. Do not make animations delay WebView readiness.

### Button and card coverage

Apply the shared primitive incrementally to:
1. Header icons (Settings, bell, URL/navigation/reload).
2. Settings action cards, segmented content-size choices, Credits button, back button, and native toggles without double firing Switch callbacks.
3. Feedback submit/category/links/back controls.
4. Dialog positive/negative/choice controls.
5. Notification Center tabs, Refresh, Mark Read, Remove-from-inbox, Read More/Show Less.

Avoid nested pressable collisions. Preserve visible disabled states and ripple clipping.

## Performance, reduced motion and platform constraints

- Initial implementation uses `Animated` and `Pressable` already included with React Native 0.86.3 / Expo SDK 57, with native-driver transforms/opacity. No Reanimated, new native SDK, or Gradle dependency unless benchmarks prove necessary and separately approved.
- Avoid `LayoutAnimation` across virtualized lists and JavaScript-frame-driven per-item animations. Only bounded content expansion may animate, with a static fallback.
- Backgrounded apps and unmounted screens stop repeated animation work. Preference toggling off during an active animation snaps to a visible final state.
- Native touch feedback cannot block scroll gestures or degrade WebView scroll throughput; do not mount overlays over the WebView except the existing purposeful loading state.
- Respect accessibility screen readers, focus order, hit targets, system reduced motion, and Android font-size/display-size scaling.
- Include Samsung Galaxy A17 5G / Android 16 as primary manual test target. Treat refresh-rate support as device variable; do not assume 120 Hz. Check both compact and large content sizes.

## Delivery slices and validation

The implementation should be decomposed into separately testable tasks:
1. Motion preference/reduced-motion policy, timing tokens, and basic unit tests.
2. Shared Pressable primitive and touch-coverage migration (initially header and Settings cards).
3. Settings entrance and targeted expanding controls, with virtualization/scroll regression tests.
4. Dialog and Feedback entry/exit lifecycles and interruption tests.
5. Notification Center filter/expansion motion while maintaining read-only persistent history.
6. Header metadata and loading parity, including animation start/stop behavior.
7. Cross-screen regression, performance checks, and Beta APK verification.

Automated checks: `npm run typecheck`, `npm test`, `npx expo-doctor`, Android Beta workflow build and APK signature/zipalign verification.

Manual verification matrix:
- Animations **ON**: every named control visibly responds once; transitions complete; no flicker or unresponsive taps.
- Animations **OFF** and OS reduced motion: controls and content update normally without motion or stray loops.
- Rapid tap/double tap; back during dialog entrance/exit; reopen before exit completes; disable settings motion mid-animation.
- Scroll a long Settings list while pressing cards; type in Settings search; keep keyboard/focus usable.
- Open/close Feedback and Notification Center repeatedly; switch categories with 100+ history records; history remains read-only and survives restart.
- Retry a WebView failure and transition out of loading; website functions and remote CSS/JS readiness are unchanged.
- Beta/Stable conditional UI and display density (compact, standard, large); Android cutout and system status bar remain safe.

**Performance gate:** review smoothness using a representative A17 5G release build, `adb shell dumpsys gfxinfo` or Android frame profiling and direct side-by-side comparison with animations off. No undocumented FPS claim; if animation causes repeatable stutter, reduce scope or remove that animation rather than forcing it.

## Known risks and mitigations

1. **Settings Android animation bypass may have been introduced for performance:** instrument/compare before restoring full-list effects; use first-viewport only.
2. **Modal closing can race with reopen or hardware Back:** one transition state machine, cancel outstanding timers/animations, callback guard.
3. **Native Button inside native Switch can trigger twice:** avoid double handlers and verify tap paths.
4. **Remote website and WebView are performance-sensitive:** native-only animation boundaries; no injection or blanket layout animation.
5. **System accessibility and app preference conflicts:** effective policy is logical AND; instant final-state fallback.
6. **Notification Center history and persisted settings are sensitive to regression:** interaction-only changes; no history retention or data migration.

## Not included in this approval

This specification authorizes the **motion design and planning process**, not code implementation, release-version bump, Beta APK generation, or changes to `main`. After this design spec is reviewed, Superpowers `writing-plans` produces the exact file-by-file TDD implementation plan. Product code changes start only after plan approval and execution-method selection.
