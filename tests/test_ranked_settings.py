"""Ranked HQ settings visual-parity and behavior preservation checks."""
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/"app/src/main/java/com/harleytg/dmzrankedunofficial"
LAYOUT=ROOT/"app/src/main/res/layout/activity_settings.xml"

class RankedSettingsTests(unittest.TestCase):
    def test_shared_branded_header_and_settings_back(self):
        header=(SRC/"RankedHeaderView.java").read_text()
        self.assertIn("THEME_COMMUNITY",header)
        self.assertIn("createSettings(",header)
        self.assertIn('settingsMode ? "Back to launcher" : "Open app settings"',header)
        self.assertIn("dmz_community.png",header)
        self.assertIn("ranked-hq-selected.webp",header)
        self.assertIn("dmz-v1-discord.webp",header)
        self.assertIn("arc-ranked.webp",header)

    def test_origin_theme_is_forwarded(self):
        hub=(SRC/"RankedHubActivity.java").read_text()
        site=(SRC/"RankedSiteActivity.java").read_text()
        settings=(SRC/"SettingsActivity.java").read_text()
        self.assertIn("SettingsActivity.EXTRA_LAUNCHER_THEME",hub)
        self.assertIn("SettingsActivity.EXTRA_LAUNCHER_THEME",site)
        self.assertIn("RankedHeaderView.THEME_HUB",hub)
        self.assertIn("RankedHeaderView.THEME_ARC",site)
        self.assertIn("RankedHeaderView.THEME_COMMUNITY",settings)

    def test_settings_screen_matches_launcher_visual_language(self):
        xml=LAYOUT.read_text()
        activity=(SRC/"SettingsActivity.java").read_text()
        styler=(SRC/"RankedSettingsStyler.java").read_text()
        self.assertIn('@+id/settingsHeaderSlot',xml)
        self.assertIn('RankedHeaderView.createSettings(',activity)
        self.assertIn('RankedSettingsStyler.apply(',activity)
        self.assertIn('creditsSummaryText',activity)
        self.assertIn('Original DMZRanked.com',activity)
        self.assertIn('settingsRoot',styler)
        self.assertIn('settingsSearch',styler)
        for term in ("setTrackTintList","setThumbTintList","GradientDrawable",
                     "getResourceEntryName", "dangerZoneSection"):
            self.assertIn(term,styler)

    def test_site_webviews_respect_supported_preferences(self):
        site=(SRC/"RankedSiteActivity.java").read_text()
        for token in ("desktop_site", "keep_awake", "remember_last_page",
                      "content_size", "ranked_last_page_", "isApprovedSite"):
            self.assertIn(token,site)
        settings=(SRC/"SettingsActivity.java").read_text()
        self.assertIn("isCommunityContext",settings)
        self.assertIn("widgetSection",settings)

    def test_settings_actions_and_support_remain_present(self):
        activity=(SRC/"SettingsActivity.java").read_text()
        xml=LAYOUT.read_text()
        for token in ("desktopSiteSwitch", "siteNotificationsSwitch", "operatorAutoSaveSwitch",
                      "clearDataCard", "resetSettingsCard", "settingsSearch",
                      "developerUnlockTrigger", "settingsScroll", "checkUpdatesCard"):
            self.assertIn(token,xml)
            self.assertIn(token,activity)
        self.assertIn("findViewById(R.id.backButton)",activity)
        self.assertIn("applySearch(",activity)

if __name__=="__main__":
    unittest.main()
