"""Shared native header regression checks for hub, DMZ V1, ARC and legacy app."""
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]
JAVA=ROOT/"app/src/main/java/com/harleytg/dmzrankedunofficial"

class RankedHeaderTests(unittest.TestCase):
    def test_shared_header_has_source_accurate_themed_logos(self):
        src=(JAVA/"RankedHeaderView.java").read_text()
        for token in ("THEME_HUB", "THEME_DMZ_V1", "THEME_ARC", "official_studio.png",
                      "dmz-v1.svg", "arc-ranked.webp", "rankedhub://action/settings"):
            self.assertIn(token,src)
        for color in ("#33D4E7", "#F4C15F", "#62D8E5"):
            self.assertIn(color,src)

    def test_header_badge_and_version_are_actual_package_metadata(self):
        src=(JAVA/"RankedHeaderView.java").read_text()
        for token in ("getPackageManager().getPackageInfo", "versionName", "getLongVersionCode",
                      "endsWith(\".beta\")", "BETA", "Version ", "Build "):
            self.assertIn(token,src)

    def test_hub_uses_header_and_grid_is_not_duplicated(self):
        hub=(JAVA/"RankedHubActivity.java").read_text()
        html=(ROOT/"app/src/main/assets/ranked-hub/index.html").read_text()
        self.assertIn("RankedHeaderView.THEME_HUB",hub)
        self.assertIn("RankedHeaderView.create(",hub)
        self.assertIn('grid-template-columns:repeat(2,minmax(0,1fr))',html)
        self.assertNotIn("<header>",html)

    def test_each_site_uses_own_header_theme_and_actions(self):
        site=(JAVA/"RankedSiteActivity.java").read_text()
        self.assertIn("RankedHeaderView.THEME_DMZ_V1",site)
        self.assertIn("RankedHeaderView.THEME_ARC",site)
        self.assertIn("RankedHeaderView.create(",site)
        self.assertIn("Return to Ranked Hub",site)
        self.assertIn("Reload this website",site)
        self.assertIn("Open in browser",site)
        self.assertIn("SettingsActivity.class",site)
        self.assertIn("RankedSafeArea.apply(root)",site)

    def test_original_dmzranked_header_is_preserved(self):
        xml=(ROOT/"app/src/main/res/layout/activity_main.xml").read_text()
        for token in ('@+id/titleBar','@+id/titleLogo','@+id/betaBadge',
                      '@+id/titleMetaText','@+id/settingsButton'):
            self.assertIn(token,xml)

if __name__=="__main__":
    unittest.main()
