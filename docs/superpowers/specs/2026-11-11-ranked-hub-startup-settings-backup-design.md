# Ranked Hub Beta: Icon, Launch, Diagnostics, Per-Site Settings, and Backups — Design Specification

**Date:** 2026-11-11  
**Status:** Active implementation, 2026-11-11 update. Initial Android work is in the feature branch; final visual and backup QA remain pending.  
**Target:** Dedicated Ranked Hub Beta `com.harleytg.rankedhub.beta`; v1.0.70 candidate (build 174), pending CI validation.  
**Source:** `markhitchk/dmz-ranked-unofficial`, branch `feature/ranked-hub-multigame`.

## 1. Goal and rationale

Make the Ranked Hub feel like one polished launcher for three independently branded ranked destinations while preserving their separate account/data boundaries. Fix remaining opaque icon behavior, give the app a recognizably Ranked Hub animated startup, offer truthful verbose network diagnostics, enable safe backups for each site, and ensure Settings actually detects and controls the selected destination instead of simply changing colors and logos.

## 2. Verified current state

- The original Beta Android launcher package was `com.harleytg.dmzranked.beta`; the dedicated Ranked Hub Beta package is now `com.harleytg.rankedhub.beta`, target SDK 36, minimum SDK 26. The shared hub uses a Java Android `Activity` and offline asset-backed WebView (JavaScript disabled), with a separate `RankedHeaderView`.
- `RankedSiteActivity.java` opens DMZ Ranked MW4 V1 (`https://dmz-ranked.vercel.app/#v1`) and ARC Raiders Ranked (`https://arc-raiders-ranked.vercel.app/`), each in an independent WebView; `MainActivity.java` is the legacy third-party `https://dmzranked.com/` client.
- The provided v1.0.68 screenshot also shows the `OPERATORS` section title partly obscured by the Settings search area; the revised layout must fix spacing and clipping, not just repaint the operator card.
- `SettingsActivity.java` is 1,823 lines and still centers on `dmz_ranked_settings`, original website operator detection, `OperatorBackupStore` (maximum two operators), and peer-beta migration. The themed header only reflects which launcher opened the page; it does not make per-site settings functional.
- The Beta adaptive icon uses an ostensibly transparent background and selected transparent WebP crest, but the Samsung launcher screenshot still shows a visible backing. Adaptive icons are masked and may be themed/composited by the OEM; a perfectly free-floating icon cannot be guaranteed on all Android launchers. Current splash is a static Beta icon override; no bespoke post-splash intro exists.
- Website MW4 V1 uses `src/services/storage.ts` with `KEYS.state = "htg-dmz-ranked-mw4-v1-state"`. ARC uses site-side settings, including `arc-ranked-graphics-mode`, and independent account access. Neither currently has a verified, Android-integrated portable backup contract.
- Existing `MigrationProvider` intentionally excludes cookies, PINs, passwords, tokens, sessions, and WebView private files; maintain this boundary.

## 3. Goals and non-goals

### Required
1. Transparent source pixels and no baked-in square/matte around the selected puppy-shield crest; correct resources and visually inspect Samsung One UI, Android 12–16, and a contrasting wallpaper. Keep rounded system masking if Android requires it.
2. Native/system splash -> fast, non-blocking, branded animated Ranked Hub intro -> interactive two-column launcher; entrance should feel polished without faking delays.
3. Optional verbose loading mode across all three destinations with truthful, bounded phases, realistic connection/error labels, retry and Open Hub recovery, and safe diagnostic export.
4. Global Settings + individual destination settings sections, with deterministic identification of Hub, MW4 V1, ARC, or legacy DMZRanked.com; automatically discover locally supported features and truthfully label unavailable/undetected account state.
5. Safe backup and restore for **each** destination. Preserve current legacy two-operator snapshots; add website-owned, versioned export/import for MW4 V1 and ARC safe preferences/local non-sensitive state. App settings backup must work independently.
6. Maintain visual theme per destination, exact logos, existing navigation, per-site auth boundaries, dedicated Ranked Hub package ID and legacy data migration, Chromebook/Android desktop layouts, and reduced-motion support.

### Excluded / anti-goals
- Never pretend a local backup can restore server-authoritative SR, ranks, leaderboards, financial transactions, moderation, or PIN-auth accounts.
- Never export/import passwords, PINs, password hashes, JWTs, OAuth tokens, session IDs, cookies, browser history, device identifiers, or hidden administrative data.
- No cross-domain `localStorage` reads, no generic JS bridge on live third-party web pages, and no scraping all origin storage/cookies.
- No fabricated percent for network loading; no permanently blocked launch due to intro animation; no unnecessary network request solely for splash animation.
- Do not modify the legacy DMZRanked.com website; its Android adapter may handle only the currently supported non-sensitive snapshot keys.
- No production/stable changes unless explicitly authorized; The new Beta package installs separately; users import supported data through the explicit signed-source migration interface.

## 4. Proposed architecture and tradeoffs

**Approach A — minimal patch:** Make only icon and intro fixes; retain legacy Settings and no portable per-site backup. Smallest change but fails cross-site request. **Rejected.**

**Approach B — shared Android shell with narrow site adapters (recommended):** Keep existing Android Activities and UI sources, add a small `RankedSiteRegistry` (site IDs, owned hosts, branding, feature capabilities), `RankedStartupCoordinator`, `RankedSiteSettingsStore`, and `RankedBackupManager` with explicit per-destination adapters. For our two sites, offer opt-in safe export/import contracts in their source repos; legacy DMZRanked.com uses its existing `OperatorBackupStore` without broadening privileges. Maintain native Android first-frame intro and shared header. **Tradeoff:** modest cross-repo coordination, significantly safer and easier to test.

**Approach C — unify all websites in one shared WebView/API:** Easier apparent Settings UI but cross-origin data separation and authentication become fragile or unsafe, and independent sites drift. **Rejected.**

**Decision:** Approach B chosen for staged implementation. The user requested execution and subsequently reported that the Markdown plan had not yet been applied.

## 5. Detailed user experience

### 5.1 Android home icon and startup artwork

The actual Ranked Hub crest is the approved cyan-and-gold puppy-headset shield. The art is left unchanged; the processing pipeline checks corner alpha, inset/padding, the selected WebP SHA, and icon resources in the final APK. Revisit the icon compositing on Samsung One UI: OEM masking/auto-theming may render a plate even with transparent adaptive background, so test the result and decide between a transparent foreground against the launcher's allowed background or a color-matched adaptive background. No promise of universally unmasked icon.

Default startup flow:

1. **OS splash**: instantly show the crest, app-consistent dark color, and correct Android 12+ splash drawable. Do not delay artificially or display percent.
2. **Native intro overlay** (only if the launcher has not yet rendered): dark navy tactical field with cyan edge arcs, a gold rank chevron accent, large crisp crest centered, and subtle radar scan/ring sweep. An optional original soft swoosh may be considered later, but no required audio.
3. **Reveal**: crest settles into the existing compact shared header, Beta label/version/build appear, then the first row of the two-column game grid reveals with short fade/slide. Prefer choreographed animations via Android `ValueAnimator`/`AnimatorSet` and native views, without remote HTML/scripts.
4. **Ready**: tap targets become usable as soon as the launcher is ready. There is no minimum intro hold; skip/reduce animation on low power or reduced-motion preference. Back during intro exits cleanly.

Suggested timings (visual upper bounds, not mandatory delays): logo entrance 220–350 ms, soft sweep 350–500 ms, grid stagger ~60 ms/tile, total animation ~0.8–1.1 s if device is fast. Site loading proceeds concurrently; **do not block input for animation**.

### 5.2 Detailed and verbose loading screen

Make `Settings → General → Startup & Diagnostics` contain an opt-in **Detailed Loading Screen** toggle and an independent **Reduced Motion** toggle, in addition to existing animation settings. Verbose mode displays truthful state such as:

- `Opening Ranked Hub` / `Preparing offline assets` (local)
- `Opening DMZ Ranked MW4 V1` / `Connecting to dmz-ranked.vercel.app` (network)
- `Web page responding` (only after genuine navigation response/progress callback)
- `Rendering interface` (on `onPageCommitVisible` or equivalent)
- `Ready` (after valid page display, not merely timer)
- `No connection`, `TLS error`, `Timed out`, or `Page could not load`, with **Retry**, **Open Hub**, and optional **Open in browser** actions.

A thin indeterminate bar is correct while network bytes are unknown. If WebChromeClient reports estimated progress, label it `Page loading (estimated)`; never display a claimed exact transfer percentage. Show elapsed seconds only when it helps diagnosis; avoid logging user names, URLs containing tokens, cookies, headers, PINs, or authorization details. Add optional `Copy safe diagnostics` for site ID, sanitized hostname, phase/timing, Android/WebView version and error category. Users can always close the overlay or navigate back. Status changes must be driven by actual callbacks, not a hardcoded status script. Set a bounded watchdog for stalls, but allow retry and recovery rather than hanging. Use a small native view above each site's WebView, and reuse the same state machine for original DMZRanked.com.

### 5.3 Settings architecture and detection

`Settings → General` is app-wide (appearance/content size, motion/animations, startup diagnostics, connectivity, language where present, cache management, notifications and updates). Under `Settings → Ranked Destinations`, show three clearly branded destinations, with a selected chip and status:

| Destination | Site detection | Config that Android owns | Destination-owned controls |
|---|---|---|---|
| MW4 DMZ Ranked V1 | Exact `dmz-ranked.vercel.app` origin / site ID `dmz-v1` | desktop mode, reload, last page, loading detail, notification preferences, local backup status | Open official `#v1/settings`, account/PIN through site, safe MW4 state export/import |
| ARC Raiders Ranked | Exact `arc-raiders-ranked.vercel.app` origin / site ID `arc-raiders` | similar native toggles and local backup status | Open site's Settings dialog, graphics preference, account/PIN, safe ARC export/import |
| DMZRanked.com community | Exact `dmzranked.com` origin / legacy activity | original 2-operator backup, restore, sync, existing toggles | Website operator picker; report detected operator only on verified local site data |

Every destination appears even if offline or never opened. Status is `Supported / Not opened`, `Website loaded`, `Stored preference available`, or `Account not verified`; **never assume authentication from a cached username**. Detect context by the trusted native site ID and allowed hostname, not from the header artwork, URL query alone, or script-supplied arbitrary domains. A website setting that cannot be observed/changed safely is a **deep link** into that site's own Settings; it is not shown as a functional Android toggle. Group legacy-only controls underneath DMZRanked.com; do not present an empty operator list as a general Ranked Hub feature. Ensure the search field never overlaps or clips section headings, including `OPERATORS`, in either compact or large text mode.

### 5.4 Backup and restore

A unified **Backup Center** lists `Ranked Hub settings`, `MW4 DMZ Ranked V1`, `ARC Raiders Ranked`, and `DMZRanked.com community`, with independent backup readiness (`Ready`, `Not supported by this site version`, `No local data`, `Backup exists`, `Requires sign-in for server data`, etc.). It supports **Back up selected**, **Back up all available**, **Restore selected**, and a summary of what will and will not be restored.

- Format: a versioned `.rankedhubbackup` ZIP container with manifest, `formatVersion`, app version, created timestamp, origin/site ID, individually versioned JSON payloads, and SHA-256 checksums. Treat all imported content as untrusted: cap sizes, reject duplicates/path traversal, unknown IDs, invalid versions, corrupted checksums, unexpected JSON types and cross-site origin mismatches.
- Storage: use Android Storage Access Framework (`ACTION_CREATE_DOCUMENT` / `ACTION_OPEN_DOCUMENT`) to avoid broad filesystem permissions. For portable files, prefer passphrase-protected AES-256-GCM with a documented, high-cost KDF and unique salt/nonce per export; fail safely on wrong passphrase. For app-managed internal copies, use app-private storage + Android Keystore envelope key. Never ship a hardcoded encryption secret.
- `Ranked Hub`: export only allowlisted native preference keys, per-site UI settings and user-selected non-sensitive launcher configuration. Exclude secrets and transient sessions.
- `MW4 V1`: implement an **explicit website-owned** `exportSafeState()` / `importSafeState()` adapter that validates the versioned `htg-dmz-ranked-mw4-v1-state` data and strips private/nonportable fields; never overwrite server-auth account records. Restore into the correct verified origin only, with confirmation and rollback if schema validation fails.
- `ARC Raiders`: implement a separate website-owned export/import adapter for allowlisted graphics/display/opt-in preferences and any non-sensitive *locally owned* draft state; if no such state exists, correctly report only preferences backed up. Website account and rank stay server-side.
- `DMZRanked.com`: reuse/migrate the current `OperatorBackupStore` two-operator limit and exact site-defined safe keys; do not grant the third-party page an arbitrary Android JS bridge. Clearly note that importing an operator snapshot does **not** recover a login or PIN.
- Restore is preview-first with per-site selection and conflict resolution (`keep existing` vs `replace this site`), transactional where possible, and a restore summary. Never silently overwrite data from another site. It may require a site reload after restore.

**Security decision:** prefer website-owned endpoints/messages from the two first-party websites with explicit origin validation; do not use broadly exposed `addJavascriptInterface()` in untrusted live WebViews. A native-only backup of app settings may ship ahead of website adapters; per-site backup buttons remain accurately disabled until safe export/import exists.

## 6. Phased delivery

1. **Icon and branding validation:** fix remaining Samsung appearance based on actual launcher screenshot, add APK alpha/resource tests and verified screenshot comparisons. Beta only.
2. **Animated startup + detailed loader:** native intro, real states, accessibility and recovery. Verify Hub + all 3 site clients.
3. **Per-site Settings:** registry/detection, global vs per-site sections, site-specific navigation and persistence. Keep legacy operator section scoped to the legacy site.
4. **Backup Center engine and local-only backup:** manifest, encryption, SAF import/export, preferences, legacy operator snapshots, preview/rollback.
5. **Owned-site safe backup adapters:** MW4 V1 then ARC website contracts, with tests and coordinated deployment; reflect capability status in Android.
6. **Full QA and Beta distribution:** Android 16 Samsung A17 (One UI), API 26/31/36 emulator, Chromebook landscape, dark/light wallpapers, offline/timeouts, reduced motion, signing update of installed Beta; publish only if acceptance checks pass.

## 7. Acceptance criteria

- The icon image has true alpha in file and final APK, does not carry an opaque black rectangular matte in the normal app presentation, and is reviewed visually on the user's Samsung device. OEM-required adaptive masking is disclosed; no impossible universal appearance guarantee.
- The startup experience uses the correct crest and site logos, does not block readiness or artificially stall, and respects accessibility/reduced motion.
- Verbose loading states are callback-driven, recovery works after DNS/TLS/offline/timeouts, and safe diagnostics leak no credentials.
- Opening Settings from each destination selects the correct destination, exposes only supported toggles, and does not confuse legacy operator backup with our other sites.
- All three destinations can produce clearly scoped, safe backups (even if a given site has preferences only), with encrypted portable export, validated restore, and explicit source/target boundaries; pre-existing legacy operator backups remain readable.
- No account logout, password/PIN/session export, lost existing user data, or global settings crossover.
- Signed Beta installs over `com.harleytg.dmzranked.beta`; all test and manual QA gates pass.

## 8. Open product decisions / sensible defaults proposed

- **Animation:** cinematic-but-quick cyan radar sweep and gold chevron, no sound, no mandatory minimum delay.
- **Verbose loading:** off by default; meaningful details available in Settings.
- **Backup:** manual user-initiated encrypted export; no automatic cloud upload, no covert account-data extraction. Use site-specific backups under one container.
- **Account detection:** label authentication as unknown without an explicit, trusted site status endpoint.
- **Site rollouts:** safe settings/backup engine first; remote site adapters explicitly versioned so old websites cannot silently corrupt data.

**Implementation note:** The animation, loading, destination-Settings and Hub/community backup engine have initial source changes. Remote MW4 and ARC backup contracts, manual hardware QA, and a final passing build still require verification.


## 9. Implementation tracking — revision 2026-11-11

The previous v1.0.69 release changed the Beta package ID and introduced explicit, signed legacy-app transfer; it **did not** implement this plan. The following work is being staged separately as v1.0.70:

| Workstream | Current status |
|---|---|
| Transparent launcher/splash icon | Previously changed; Samsung One UI visual verification outstanding |
| Native animated Ranked Hub intro | Source implementation added; CI/device QA outstanding |
| Callback-driven MW4/ARC detailed loading | Source implementation added; legacy verbose loader retained, unified QA outstanding |
| Per-site Settings / safe context | Destination controls and hiding legacy operator cards added; UI QA outstanding |
| Portable encrypted backup | Hub settings and legacy operator adapter added; full QA and restore roundtrips outstanding |
| MW4 website-owned backup | Not implemented |
| ARC website-owned backup | Not implemented |
| Package migration | Implemented in v1.0.69 with `com.harleytg.rankedhub.beta` |
| Full all-sites verified release | Not complete |

Do **not** state all-site backup is complete until both first-party website contracts are deployed, validated, and connected to the native app.