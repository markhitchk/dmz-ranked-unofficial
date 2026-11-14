# Ranked Hub Beta Branding, Startup, Diagnostics, Settings, and Backup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** ACTIVE — implementation staged on `feature/ranked-hub-multigame`. Some work is unverified; first-party website backup contracts remain pending.  
**Goal:** Deliver an update-compatible Android Ranked Hub Beta with platform-correct icon artwork, a compact animated launch, truthful verbose loading, per-destination Settings, and safe independent backups for Hub/MW4 V1/ARC/legacy DMZRanked.com.  
**Architecture:** Keep the existing Java/Android Activity + WebView shell, centralize site metadata and load state in native classes, and delegate backup/export to narrow versioned adapters. Use site-owned export/import contracts for the two first-party sites; preserve legacy DMZRanked.com snapshots without exposing raw cookies or other origin storage.  
**Tech Stack:** Java Android app (min SDK 26, compile/target SDK 36), WebView, Android `AnimatorSet`/`ValueAnimator`, Android SplashScreen (platform/API 31+), Android Storage Access Framework, JSON + ZIP, AES-GCM/Keystore and strong portable KDF, Python unittest for source checks, Android instrumentation/UI tests, Vite/React TypeScript site for MW4, plain JS ARC Raiders site.  
**Spec:** `docs/superpowers/specs/2026-11-11-ranked-hub-startup-settings-backup-design.md`.

## Global constraints

- Work in `markhitchk/dmz-ranked-unofficial` branch `feature/ranked-hub-multigame`, with coordinated first-party site changes in `markhitchk/htg-dmz-ranked` and `markhitchk/arc-raiders-ranked` on dedicated branches/PRs. Obtain owner approval before implementing these plans.
- Use dedicated Beta package ID `com.harleytg.rankedhub.beta`, with explicit opt-in transfer from `com.harleytg.dmzranked.beta`; preserve signing key, other app variants, original assets, existing two-column layout, and separated accounts.
- This is a staged v1.0.70 Beta feature set; bump only after work is ready and ensure one consistent Android version/build and matching CI artifact names.
- Original third-party DMZRanked.com website must not be modified. Reuse the existing safe two-operator backup path; no generalized website scripting.
- Never copy cookies, PINs, secrets, OAuth/Discord/JWT tokens, credentials, sessions, privileged API data, or server-owned rank/account records into backup files or verbose logs.
- Never present web progress as an exact byte percentage unless measurable. Never hold the OS splash or app intro to fake a polished duration.
- OEM launchers may mask/composite app icons even with alpha foregrounds; do not promise a free-floating transparent launcher icon on all phones.
- Accessibility: touch targets at least 48dp, stable contrast and text labels beyond color cues, status-bar/navigation-bar safety, screen reader summaries, reduced-motion preference, Chromebook and landscape support.

## Review focus (failure modes to pin down)

1. **Samsung themed icon / tinted backgrounds:** same alpha PNG/WebP but One UI still composites background; verify actual Pixel and Samsung screenshots across theme settings in Task 1.
2. **Offline/timeout/untrusted redirect:** loading phases must not hang, report a sanitized error, and always allow Hub/Retry in Task 3.
3. **Cross-origin or unauthenticated page:** Android must not claim a site is signed in or inject export data into the wrong host, regardless of URL change or iframe in Tasks 4–7.
4. **Corrupt or malicious restore file:** file traversal, oversized JSON, wrong origin/schema, wrong passphrase, and checksum corruption must not overwrite existing data in Task 5.
5. **Upgrade from Beta v1.0.68:** existing operator snapshots and settings remain intact; APK signs with the same cert and installs over `.beta` in Task 8.

---

## Task 1: Finish the Beta launcher icon, splash icon, and in-app transparency

**Files:**
- Modify: `app/src/beta/res/mipmap-anydpi-v26/ic_launcher.xml`, `ic_launcher_round.xml`.
- Modify: `app/src/beta/res/drawable/ranked_hub_launcher_foreground.xml`, `ranked_hub_splash_icon.xml`, `app/src/beta/res/values-v31/themes.xml`.
- Verify: `app/src/beta/res/drawable-nodpi/ranked_hub_logo.webp`, `app/src/beta/res/mipmap-nodpi/ic_launcher.webp`, `ic_launcher_round.webp`, `app/src/main/assets/ranked-hub/ranked-hub-selected.webp`.
- Review: `app/src/main/res/layout/activity_settings.xml`, `RankedHeaderView.java`, `RankedSettingsStyler.java`.
- Test: `tests/test_ranked_transparent_branding.py`, instrumentation screenshot test `app/src/androidTest/java/com/harleytg/dmzranked/RankedIconAppearanceTest.java`.

**Interfaces:** consumes canonical selected mascot art; produces Beta-only Android drawable resources, no public code API.

- [ ] **Step 1:** Confirm source alpha at center, corners and image perimeter; inspect Android `aapt2 dump resources` / APK resources to identify actual icon backing and themed-icon mappings.
- [ ] **Step 2:** Add failing tests: canonical source SHA unchanged; adaptive background is intentional, no black rectangular matte; splash resolves to Beta art; legacy mipmaps preserve alpha; source Settings/header logos have transparent backgrounds.
- [ ] **Step 3:** Run `python3 -m unittest discover -s tests -p 'test_ranked_*.py' -v` and verify the new icon assertions fail against current Beta behavior.
- [ ] **Step 4:** Adjust the *foreground composition* and safe-zone scaling, not just an XML color. Keep transparencies inside image pixels and create a deliberate OEM-safe background if One UI demands a composite. Do not crop puppy ears, cyan outlines or `RANKED HUB` text under the adaptive icon mask; create a narrow square/circular fallback preview.
- [ ] **Step 5:** Rebuild icon resources for Beta only and verify APK alpha channels. Run visual checks on Samsung Galaxy A17 Android 16/One UI, light and dark wallpapers, themed-icon on/off, API 26, 31, and 36 emulators.
- [ ] **Step 6:** Commit separately: `fix(android): finish beta launcher and splash artwork composition`.

**Expected:** icon is clean in-app and in the screenshot, Android masks are acceptable, and Beta resources never fallback to the legacy DMZ logo.

## Task 2: Animated, non-blocking Ranked Hub startup

**Files:**
- Create: `app/src/main/java/com/harleytg/dmzrankedunofficial/RankedStartupCoordinator.java` — startup transitions, no arbitrary waits.
- Create: `app/src/main/java/com/harleytg/dmzrankedunofficial/RankedIntroView.java` — native animated visual only.
- Modify: `app/src/main/java/com/harleytg/dmzrankedunofficial/RankedHubActivity.java` — attach, animate out, and cleanly destroy overlay.
- Adjust Beta theme/splash only as required by Task 1.
- Test: `tests/test_ranked_startup.py`, `app/src/androidTest/java/com/harleytg/dmzranked/RankedStartupTest.java`.

**Interfaces:**
- `RankedStartupCoordinator.attach(Activity activity, ViewGroup root, View readyContent, boolean reduceMotion)`
- `RankedStartupCoordinator.onHubReady()`
- `RankedStartupCoordinator.dispose()`

- [ ] **Step 1:** Add failing tests for correct crest, no hardcoded startup delay, usable Hub after content ready, and `reduceMotion` bypass.
- [ ] **Step 2:** Run Python tests; confirm expected failure.
- [ ] **Step 3:** Implement OS splash -> native intro overlay using cyan shield/radar ring and gold chevron; animate crest scale/fade then the already-existing 2-column grid reveal. Keep each animation below roughly 1.1s combined; do not block clicks once content is ready.
- [ ] **Step 4:** Integrate lifecycle (back, home, rotation, process death) and avoid retained Activity or duplicated animation; make app launch smooth offline.
- [ ] **Step 5:** Execute source tests, Android instrumentation tests and frame/screenshot QA on a low-memory phone and Chromebook; commit `feat(android): ranked hub animated fast startup`.

**Expected:** accurate, responsive custom reveal following native OS splash, no repeated intro after ordinary back navigation to Hub unless explicitly enabled.

## Task 3: Detailed / verbose truthful loading across all destinations

**Files:**
- Create: `RankedLoadState.java` — Java enum `IDLE, PREPARING, CONNECTING, RESPONSE, RENDERING, READY, OFFLINE, TLS_ERROR, TIMEOUT, FAILED`.
- Create: `RankedLoadingOverlayView.java` — accessible status/progress actions and safe copy diagnostics.
- Create: `RankedLoadCoordinator.java` — per-site lifecycle and watchdog; no personally identifying logs.
- Modify: `RankedSiteActivity.java`, `MainActivity.java`, and `RankedHubActivity.java` only where needed for event forwarding.
- Modify: `SettingsActivity.java` + `activity_settings.xml` for `PREF_VERBOSE_LOADING`, `PREF_APP_ANIMATIONS`, reduced-motion override, and diagnostics controls.
- Test: `tests/test_ranked_loading.py`, `app/src/androidTest/java/com/harleytg/dmzranked/RankedLoadingTest.java`.

**Interfaces:**
- `RankedLoadCoordinator.start(String siteId, String sanitizedHost)`
- `RankedLoadCoordinator.onNavigationEvent(RankedLoadState state, int estimatedPercent)`
- `RankedLoadCoordinator.onError(RankedLoadState state, String safeReason)`
- `RankedLoadCoordinator.finish()` / `cancel()`

- [ ] **Step 1:** Add failing tests for state transitions from real WebView callbacks (`onPageStarted`, `onPageCommitVisible`, `onPageFinished`, `onReceivedError`, SSL failure, estimated progress) and that UI displays no invented exact percentages.
- [ ] **Step 2:** Run source tests red; implement the finite-state coordinator and native overlay using the active site's brand accent, domain, short status text, an indeterminate progress bar, and a detailed log only if opted in.
- [ ] **Step 3:** Hook into both first-party site WebViews and legacy MainActivity without breaking site navigation or the original operator backup logic.
- [ ] **Step 4:** Implement real recoveries: `Retry`, `Open Hub`, `Open in browser` (only validated HTTPS), automatic dismissal on READY, timeout watchdog with visible recovery, and back navigation.
- [ ] **Step 5:** Add privacy tests: strip query values/usernames, secret headers, PINs, tokens from copied diagnostics; never persist verbose logs beyond explicit user action.
- [ ] **Step 6:** Run network-off, DNS fail, TLS fail, HTTP error, slow response, redirect and rotation Android instrumentation scenarios; commit `feat(android): truthful ranked site loading status and recovery`.

**Expected:** user sees `Connecting` -> `Rendering` -> `Ready` only when those events occur. No permanent progress screen, no leak of credentials.

## Task 4: Detect destinations and provide truly scoped Settings

**Files:**
- Create: `RankedSiteRegistry.java` — immutable site IDs, approved exact HTTPS hosts, capabilities, display label, theme and site Settings entry.
- Create: `RankedSiteSettingsStore.java` — app-owned global + namespaced per-site preferences (e.g., `ranked_site_settings_v1`).
- Create: `RankedSiteSettingsController.java` — capability/status mapping and site action dispatch.
- Modify: `SettingsActivity.java`, `RankedSettingsStyler.java`, `activity_settings.xml`, `RankedHubActivity.java`, `RankedSiteActivity.java`.
- Test: `tests/test_ranked_site_settings.py`, `app/src/androidTest/java/com/harleytg/dmzranked/RankedSiteSettingsTest.java`.

**Interfaces:**
- `RankedSiteRegistry.get(String siteId): SiteDefinition` (allowed values `hub`, `dmz-v1`, `arc-raiders`, `community`; reject unknown).
- `RankedSiteSettingsStore.getBoolean(String siteId, String key, boolean defaultValue)` / `putBoolean(...)`.
- `RankedSiteSettingsController.statusFor(String siteId): SiteCapabilityStatus`.
- Use `SettingsActivity.EXTRA_LAUNCHER_THEME` for backward compatibility, but prefer exact `SettingsActivity.EXTRA_SITE_ID` for destination selection.

- [ ] **Step 1:** Add failing tests for all 4 site IDs, exact allowed hosts, unknown origin rejection, independent preference scope, offline-first presentation and legacy section exclusion in Hub/MW4/ARC.
- [ ] **Step 2:** Run failing tests; create registry and site Settings store; migrate existing safe global keys once without resetting operator data.
- [ ] **Step 3:** Split Settings UI into `General`, `Ranked Destinations`, and `Backup Center` sections. Include branded selector cards; automatically focus the destination that opened Settings.
- [ ] **Step 4:** Wire owned-site `Open Website Settings`: MW4 `#v1/settings`; ARC `siteSettingsButton` via a reviewed website-side navigation route or approved same-origin interface (do not inject generic clicks on untrusted pages). Preserve DMZRanked.com operator-specific picker.
- [ ] **Step 5:** Distinguish `Never opened`, `Available locally`, `Website loaded`, `Unsupported by site version`, and `Authentication not verified` from trusted evidence; do not mark signed in from a cached nickname.
- [ ] **Step 6:** Test theme selection, orientation, search, TalkBack, per-site toggles, permissions, and search field does not cover the Operators heading in any text scale, and no cross-site clearing of shared WebView cookies; commit `feat(android): site-aware settings and capabilities`.

**Expected:** MW4/ARC pages no longer show misleading DMZRanked.com `0 / 2 operators` content; legacy settings remain in their own context.

## Task 5: Shared encrypted backup center — app settings + legacy operator snapshots

**Files:**
- Create: `RankedBackupManifest.java` (schema and strict parser, formatVersion=1).
- Create: `RankedBackupManager.java` (zip streaming, checksums, size/entry limits, SAF document integration).
- Create: `RankedBackupCrypto.java` (Keystore/app private data and portable passphrase AEAD; secure random salts/nonces, authenticated headers).
- Create: `RankedBackupAdapter.java` interface (`siteId()`, `capabilities()`, `exportSafeState()`, `validateImport()`, `applyImport()`).
- Create: `RankedHubSettingsBackupAdapter.java`, `LegacyOperatorBackupAdapter.java`.
- Modify: `SettingsActivity.java`, `OperatorBackupStore.java` only to adapt versioned export and preview; retain readable existing `backups_v1`.
- Test: `tests/test_ranked_backup_format.py` plus Android unit tests for encryption and restore.

**Interfaces:**
- `RankedBackupManager.exportTo(Uri destination, Set<String> selectedSiteIds, char[] passphrase): BackupReport`.
- `RankedBackupManager.previewFrom(Uri source, char[] passphrase): RestorePreview`.
- `RankedBackupManager.restore(RestorePreview preview, Set<String> selectedSiteIds, ConflictPolicy policy): RestoreReport`.
- Format ZIP manifest includes `formatVersion`, `createdAt`, `appVersion`, `entries[]` with `siteId`, `schemaVersion`, `sha256`, `size`, `dataPath`; no user credentials.

- [ ] **Step 1:** Write failing tests: package a single Hub config, round-trip Hub + two legacy operators, reject invalid path entries, oversized data, bad checksums/wrong passphrase, unknown site ID, and unsupported schema without mutating storage.
- [ ] **Step 2:** Run red tests; implement SAF, format, streaming, authenticated portable crypto and private Keystore encryption. Never hardcode a key or use plaintext backups in shared storage.
- [ ] **Step 3:** Add clear import preview with per-site selection, before/after counts, password requirement and explicit confirmation before overwriting, plus rollback or staging on partial failure.
- [ ] **Step 4:** Integrate legacy `OperatorBackupStore.exportJson()` / `importJson()`; enforce the existing maximum two operators and never export the site's login state.
- [ ] **Step 5:** Test cross-device export/import with Android version compatibility, corrupt ZIPs, empty backups, duplicate entries, big files and wrong passphrase; commit `feat(android): safe versioned backup center`.

**Expected:** native preferences and existing DMZRanked.com safe operator snapshots survive reinstall/update through user-controlled backup file; no auth secrets exported.

## Task 6: First-party MW4 V1 safe data backup contract

**Files in `markhitchk/htg-dmz-ranked`:**
- Modify: `src/services/storage.ts` to add `exportSafeState(store: Store): SafeExport` and `validateSafeImport(value: unknown): SafeImportResult`.
- Modify: `src/app/App.tsx` to add an explicit same-origin export/import handler in the site Settings UI and announce success/failure.
- Add: `tests/mw4-safe-backup.test.mjs` and document schema and security exclusions.

**Files in Android repository:**
- Create: `Mw4V1BackupAdapter.java` scoped to `dmz-v1` and the exact `https://dmz-ranked.vercel.app` origin.
- Modify: `RankedSiteSettingsController.java`, `RankedBackupManager.java` for capability state and opt-in handoff.
- Test: `tests/test_ranked_mw4_backup.py` and Android same-origin integration tests.

**Interfaces:** site-owned `window.RankedHubBackupV1.exportSafeState()` and `.importSafeState(validatedPayload)` callable only on the exact owned origin after user action; payload `siteId: 'dmz-v1', schemaVersion:1, state:{...}`. Adapter accepts only allowlisted local non-sensitive preferences/drafts; never authenticated account/session or server ranks.

- [ ] **Step 1:** Document and test which fields of `htg-dmz-ranked-mw4-v1-state` are safe and locally authoritative; reject unknown/private fields; leave current saved state untouched on invalid import.
- [ ] **Step 2:** Implement website-owned export/import and test with `npm test && npm run build`. Include before/after schema migration tests.
- [ ] **Step 3:** Implement Android adapter with strict host/origin and main-frame checks; never call arbitrary `localStorage` scripts on third-party content or expose `addJavascriptInterface`.
- [ ] **Step 4:** Validate backup roundtrip, unauthenticated local state, signed-in server data unchanged, old website version unsupported messaging; commit website PR first, then Android adapter PR.

**Expected:** safe MW4 local state backed up without changing remote operator/account truth; Android reports feature supported only when website contract actually exists.

## Task 7: ARC Raiders Ranked safe preferences/data backup contract

**Files in `markhitchk/arc-raiders-ranked`:**
- Modify: `settings.js`; add `ranked-hub-backup.js` for explicit allowlisted and versioned export/import without PIN/auth data.
- Modify: `index.html` to load the adapter; add `tests/ranked-hub-backup.test.cjs`.

**Files in Android repository:**
- Create: `ArcRaidersBackupAdapter.java`, add registry capability, optional deep link/approved Settings open action and tests.

**Interfaces:** website-owned `window.RankedHubBackupV1.exportSafeState()` / `.importSafeState(validatedPayload)` with `siteId:'arc-raiders'`, `schemaVersion:1`. Start with safe graphics setting `arc-ranked-graphics-mode`; include further local preferences only after a per-key audit.

- [ ] **Step 1:** Write failing site tests for graphics setting roundtrip, corrupted input, missing data, and no PIN/auth field exposure.
- [ ] **Step 2:** Implement the same-origin, user-authorized site contract; verify with `node --test tests/settings.test.cjs tests/ranked-hub-backup.test.cjs`.
- [ ] **Step 3:** Implement Android adapter with exact origin matching, safe parsing, optional capability discovery and no generic live-page JavaScript bridge.
- [ ] **Step 4:** Verify ARC account, rank, web settings, old-client behavior and import conflict handling; commit website and Android PRs independently.

**Expected:** ARC preferences are backed up safely, server account/profile/standing never falsely 'restored' from a local archive.

## Task 8: Final QA, migration, installable Beta release

**Files:**
- Modify: `.github/workflows/android.yml` (Beta instrumentation/UI screenshot checks, asset integrity, certificate consistency, artifact naming, update version only when ready).
- Modify: `app/build.gradle` Beta version/build only; write change notes to `docs/`.
- Test: `tests/test_ranked_*.py`, per-site website test suites, Android unit/instrumentation tests and screenshot artifacts.

- [ ] **Step 1:** Run local checks: `python3 -m unittest discover -s tests -p 'test_ranked_*.py' -v`, `gradle assembleBeta`, and both owned-site test/build commands.
- [ ] **Step 2:** Run instrumented launch/rotate/load/backup tests on emulator API 26, 31, 36 and low-memory configuration; capture actual launcher icon, OS splash, post-splash overlay, Hub and per-site Settings screenshots.
- [ ] **Step 3:** Verify Pixel and physical Samsung Galaxy A17 Android 16 One UI icon composition, new loading state, back/home keyboard behavior, 60/120Hz, reduced motion, Chromebook landscape layout, and offline/reconnect.
- [ ] **Step 4:** Check existing Beta v1.0.68 settings/operators survive update. Verify APK package `com.harleytg.rankedhub.beta`, signing cert matches installed Beta, `apksigner verify`, `zipalign -c -v 4`, APK assets and opacity checks.
- [ ] **Step 5:** Verify APK contents against selected official assets and correct site URLs; capture final SHA-256 and sign result. Publish a fresh APK link and stable GitHub Actions artifact only when checks pass; do not call an untested install 'verified on device'.
- [ ] **Step 6:** Update PR changelog and release notes, and mark tasks complete only after independently witnessed tests. Commit `chore(android): verify ranked hub beta icon startup settings backups`.

**Expected:** Signed, installable Beta with confirmed native visual behavior and honest diagnostics; website adapter rollout remains version-compatible, with user data preserved.

---

## Sequencing and release gates

**Milestone 1 (visual hotfix):** Tasks 1–3 can ship as a small Beta ahead of backup features, after on-device visual QA.  
**Milestone 2 (Settings):** Task 4 scoped settings can ship when previous data remains intact.  
**Milestone 3 (local backup):** Task 5 supports portable Hub and legacy data safely, even if remote websites have not yet shipped adapter code.  
**Milestone 4 (all-site backup):** Tasks 6–7 require coordinated **first-party website** rollouts; no button may falsely claim all-site backups are ready before both contracts work.  
**Final Beta:** Task 8 applies to each milestone and the overall release.

## Self-review / explicit assumptions

- No changes to stable release or third-party DMZRanked.com website.
- The user wants a verbose loading UI, not background operation or invented text; default detailed logging is opt-in.
- "Backup all sites" means safe **per-site** local/preferences snapshots inside a single user-controlled archive; it does not mean downloading server-owned profiles/ranks or bypassing site sign-in.
- Settings detection uses exact native site IDs and trusted website contracts, not inferred account status.
- Android launchers may still enforce an icon mask/background even after alpha corrections; acceptance includes visual Samsung review.
- Implementation is underway by owner request. Defer unsupported cross-site backup and do not mark it complete without website contracts.


---

## Actual implementation ledger — 2026-11-11

The original plan was **not** carried out in v1.0.69. The next Beta candidate is v1.0.70/build 174 using the new ID `com.harleytg.rankedhub.beta`.

- [x] Existing source diagnosis: v1.0.69 only covered package identity and legacy transfer.
- [x] Add native intro source using approved crest, no artificial minimum delay, and reduced-motion preference.
- [x] Add callback-driven detailed loading UI for MW4 and ARC using page events, timeout, TLS/network error categories, retry, browser, Hub, and safe diagnostics.
- [x] Add destination-specific Settings links; hide third-party DMZRanked.com operator panel outside its context; correct sticky search/title clipping.
- [x] Add encrypted AES-GCM/PBKDF2 portable backup format for allowlisted Hub settings and sanitized legacy operator data, with explicit user import/restore.
- [x] Change grid button to **OPEN MW4 DMZ**.
- [ ] Complete compile and green CI verification of candidate.
- [ ] Confirm intro, loading, Settings and backup visually on a device/emulator.
- [ ] Complete website-owned MW4 safe export/import contract and Android adapter.
- [ ] Complete website-owned ARC safe export/import contract and Android adapter.
- [ ] Verify all-site backup roundtrips, corruption/wrong-passphrase cases, and account safety.
- [ ] Publish final fully validated all-site Beta release.

**Scope qualification:** The Hub/community backup capability is a staged subset of the original 'all sites' goal. MW4 and ARC backup UI must be explicitly labeled **Website backup requires site support** until contracts exist. The new Android package is **not** an update-in-place to the previous Beta; the old installation must be retained for manual transfer.

---

## Implementation result — Ranked Hub Beta v1.0.71 (build 175)

**Code branches and releases:** Android `feature/ranked-hub-multigame` / PR #26; MW4 local-only backup contract merged via `markhitchk/htg-dmz-ranked#38`; ARC preferences contract merged via `markhitchk/arc-raiders-ranked#7`. Both first-party Vercel production deployments reached READY.

### Implemented

- Dedicated package `com.harleytg.rankedhub.beta`, with manual signed legacy app data transfer.
- Ranked Hub transparent puppy crest, Beta launcher/splash resources, native radar/crest intro and reduced-motion option.
- Actual WebView event-based MW4/ARC verbose loading, failure diagnostics, and Retry / Open Hub / Open Browser actions.
- Themed Settings navigation for Ranked Hub, MW4, ARC, and DMZRanked.com, with legacy operator settings scoped to the community client.
- Versioned `window.RankedHubBackupV1` safe site data contract on both first-party sites; never includes auth credentials or server ranks.
- Explicit site-header **Capture safe site preferences** / **Restore saved site preferences** actions for MW4 and ARC (exact HTTPS host only).
- Passphrase-encrypted `.rankedhubbackup` file format v2 with integrity checks, optional site snapshots, strict schema validation, and explicit per-destination export/restore selection. Existing v1 Hub/community archives remain readable.
- DMZ launcher action label **OPEN MW4 DMZ**.

### Exclusions and validation boundaries

- MW4 backup includes only safe locally managed callsign, personal orders, sector, squad/loadout notes, and motion preference. Existing reports and cloud account/rank records are not imported.
- ARC backup includes only locally saved graphics mode; account, PIN, identity and standings remain server-owned.
- Third-party DMZRanked.com keeps the original app-managed sanitized two-operator snapshots; no third-party site code was changed.
- The Android APK requires green build/signing verification and device UI testing. Samsung One UI may still apply an adaptive icon mask or background even when the underlying artwork has alpha. Do not claim device visual confirmation without device testing.
- ARC site's broader pre-existing regression suite has unrelated failures; focused safe-backup checks passed.
