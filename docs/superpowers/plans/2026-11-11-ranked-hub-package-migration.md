# Ranked Hub Beta package migration

- New Beta ID: `com.harleytg.rankedhub.beta`, version 1.0.69 (build 173).
- Stable ID remains `com.harleytg.dmzranked`; old Beta remains `com.harleytg.dmzranked.beta`.
- This is a new Android app sandbox, not an in-place update.
- Settings > Import from previous app offers a manual, consent-based transfer from either installed legacy package.
- Source must be installed, expose its `.migration` content provider, and have a matching APK signing certificate.
- Whitelist noncredential preferences; sanitize operator storage to exclude token/password/PIN/session material and JWT-like strings; reset imported verification.
- No live account sessions, website cookies, server records, or third-party ARC/MW4 localStorage transferred by this migration.
- Keep old app installed until import is reviewed. If old app uses a different signing certificate, import is unavailable, not bypassed.
- The new migration provider restricts callers to signed recognized package IDs, but installed older builds cannot be retroactively secured.
