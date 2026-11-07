# DMZ Ranked · website branch (frontend snapshot)

This branch is a **copy** of the public DMZ Ranked website frontend as supplied on 2026-11-06, alongside the Android app source inherited from main. Main is unchanged.

## Source and overrides
- `index.html`, `assets/css/leaderboard.css`, `assets/js/leaderboard.js`: exact uploaded website files.
- `assets/css/app-override.css`: **byte-identical Git blob copy** of `remote/app-ui/app.css` from main, included for review and controlled adoption. It is **not enabled** automatically in `index.html` because app-only rules alter native WebView presentation.
- `remote/app-ui/app.css`: Android app's canonical streamed CSS; Android uses main by default.
- `assets/legacy/`: 90 versioned public images fetched by `.github/workflows/sync-website-assets.yml` when this branch is pushed. This separates public artwork from private player data.

## Important limitations
The original live site calls its same-origin `/api/v1/data/*` backend and uses public leaderboard snapshot endpoints. This branch contains **frontend code only**: it does not supply the Cloudflare Worker, credentials, database, or live write permissions. A preview can show static UI but cannot be assumed to reproduce production sync, PINs, or admin features.

No `leaderboard.json`, `public-state.json`, `npoint_config.json`, or `snapshot-manifest.json` player-data snapshots are committed. Nor does this branch redirect the domain or deploy the live site.

Local static preview: `python -m http.server 8000` and visit `http://localhost:8000/`.

The full uploaded zip and an independently packaged, extracted website copy are provided separately in the ChatGPT conversation.
