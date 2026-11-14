# Shared Themed Launcher Header (Android Beta)

Goal: Carry the existing DMZ Ranked beta title bar (brand mark, title, BETA, installed version/build and settings) across the Ranked Hub, DMZ MW4 V1, and ARC Raiders destination screens, each with its real source logo and own accent. Preserve the legacy DMZRanked.com native header and auth.

Approach: A JavaScript-free Android WebView header rendering offline assets in the already-bundled ranked-hub directory. A single RankedHeaderView class owns the header markup and safe in-app settings navigation. The Hub and two site activities embed the shared header above their content, retaining system-bar insets.

Tests: tests/test_ranked_header.py (initial red CI run 43120588694), existing tests/test_ranked_hub_grid.py. Verify in CI with APK signature checks; verify user screenshot on-device separately.

Files:
- app/src/main/java/com/harleytg/dmzrankedunofficial/RankedHeaderView.java
- app/src/main/java/com/harleytg/dmzrankedunofficial/RankedHubActivity.java
- app/src/main/java/com/harleytg/dmzrankedunofficial/RankedSiteActivity.java
- app/src/main/assets/ranked-hub/index.html (remove duplicate HTML header)
- app/build.gradle, .github/workflows/android.yml (version bump)

Constraints: No invented logos; no changes to site PINs, WebView origins, original DMZRanked.com native activity or package IDs.
