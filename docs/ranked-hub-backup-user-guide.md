# Ranked Hub Beta — Transfer, Capture and Restore

Version: 1.0.71-beta (build 175). Android app ID: `com.harleytg.rankedhub.beta`.

## Moving from the previous DMZ Ranked Beta

1. Keep `com.harleytg.dmzranked.beta` installed. Android regards Ranked Hub Beta as a separate app.
2. Install the new Ranked Hub Beta.
3. In **Ranked Hub → Settings → Import from previous app**, choose the previous signed app and confirm.
4. Confirm your compatible app settings and up to 2 DMZRanked.com operator snapshots were imported before uninstalling the old app.
5. Existing site accounts and cookies do **not** transfer. Sign in normally.

The old and new apps must use a compatible signing certificate. The import must not bypass Android application sandboxing.

## First-party website backups inside the Android app

1. In the game grid, open **MW4 DMZ Ranked V1** or **ARC Raiders Ranked**.
2. In the site's Android header, open the options menu.
3. Select **Capture safe site preferences**. This works only on the exact owned HTTPS site when the website contract has loaded.
4. Repeat for the other first-party site if you want both in your backup file.
5. Return to **Ranked Hub → Settings → Backup Center → Export encrypted backup**.
6. Select which destinations to include (Hub, DMZRanked.com, MW4 and/or ARC). Unsupported/uncaptured sites cannot be exported.
7. Enter a passphrase (8 characters minimum) and save the `.rankedhubbackup` file using Android's document picker.

## Restoring to a new phone or after reinstalling

1. In **Settings → Backup Center**, select **Restore encrypted backup**.
2. Choose the saved file and enter its passphrase.
3. Review the manifest entries and select only the destinations you want to overwrite.
4. Confirm restore. Hub settings and sanitized DMZRanked.com operators are applied to this app.
5. For MW4 or ARC, open that site, open the Android header menu and select **Restore saved site preferences**. Confirm the site-specific restore.

### What gets backed up?

| Destination | Supported local data | Never restored from file |
|---|---|---|
| Ranked Hub | Allowlisted display, motion, notifications and WebView preferences | Sessions, passwords, cookies |
| MW4 DMZ Ranked V1 | Callsign, orders, sector, loadout and squad notes, motion | Raid reports, SR, ranked accounts or passwords |
| ARC Raiders Ranked | Lite/Enhanced graphics mode | Raider PIN, Discord auth, profiles, ranked records |
| Original DMZRanked.com | Sanitized up to two app-managed operator snapshots | Third-party website credentials, tokens, cookies |

### Limitations

- If either website does not expose `window.RankedHubBackupV1`, the app cannot capture or restore site preferences. Update the site or reload before trying.
- A backup passphrase cannot be recovered by staff or the app. Keep it private.
- Do not delete the original Beta installation until transfer is confirmed.
- Android may mask/composite launcher icons independently of the image's transparency.
- No site backup file may replace a server-owned ranking or authentication record.
