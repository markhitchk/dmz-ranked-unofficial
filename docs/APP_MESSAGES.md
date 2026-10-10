# DMZ Ranked App — owner announcements

The Android **stable** and **beta** React Native apps read this public, read-only
message feed whenever they start, return to the foreground, or remain open for
approximately five minutes.

**Edit the live feed:** https://github.com/markhitchk/dmz-ranked-unofficial/edit/app-messages/remote/app-messages.json

This file is deliberately on the **app-messages** Git branch, not the Java
`main` branch or the React Native application branch. A new message **does not
need an APK update** or trigger Android rebuilds. Only users with GitHub write
access to the repository can publish, using their GitHub account. Never put
access tokens, PINs, or secrets into the feed.

## Publish a message

1. Open the live feed using the link above and sign in to GitHub.
2. Add a JSON object to the `messages` array, or edit an existing one.
3. Ensure the complete file is valid JSON and commit the edit to
   `app-messages`. Users see it at the next foreground poll.
4. When finished, set `enabled: false` or remove the entry. A cached copy may
   remain visible while a device is offline. Expiration is enforced offline.

Example (do not publish the example as-is):

```json
{
  "schemaVersion": 1,
  "messages": [
    {
      "id": "oct-2026-operator-update",
      "title": "Operator improvements",
      "body": "We improved operator sync. Please update to the newest app version.",
      "channels": ["all"],
      "priority": "info",
      "display": "popup",
      "enabled": true,
      "startsAt": "2026-10-09T00:00:00Z",
      "expiresAt": "2026-11-09T00:00:00Z",
      "link": "https://play.google.com/store/apps/details?id=com.harleytg.dmzranked",
      "linkLabel": "VIEW UPDATE"
    }
  ]
}
```

The feed is initially empty, so **no user receives an announcement until you
publish one**.

### Fields

- `id`: unique letters/numbers/underscores/hyphens (max 80 characters).
  To notify previously acknowledged users of revised text, use a new ID.
- `title`: required plain text, max 100 characters.
- `body`: required plain text, max 2000 characters. HTML is not rendered.
- `channels`: required: `["all"]`, `["stable"]`, `["beta"]`,
  or `["stable", "beta"]`.
- `priority`: optional: `info`, `warning`, `important`.
- `display`: `popup` shows once until acknowledged, `inbox` (default)
  shows only in the accessible Messages inbox.
- `enabled`: optional; set `false` to hide.
- `startsAt`, `expiresAt`: optional timezone-qualified ISO 8601 timestamps.
- `link` and `linkLabel`: optional external **HTTPS** link/button.

The title-bar bell opens the unified Notification Center with website events, operator/raid reports, system notices and Harley's Studios announcements. The unread badge combines all categories. Messages can be marked read
individually or all at once. Read state is private local app data. A message
with a given ID is shown as a pop-up only until the user acknowledges it. These
are **in-app announcements**, not background remote push notifications:
closed apps are not woken up to receive them. Existing website notifications use Android background checks when enabled; Android determines the timing. Each processed alert is also saved into the local Notification Center when notification permission is denied.

Keep announcements relevant. This is a public feed; do not include private
information or user-specific operator details.
