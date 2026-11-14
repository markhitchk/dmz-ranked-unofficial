"""All Ranked HQ pages use the original DMZRanked.com native title bar."""
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[1]
JAVA=ROOT/"app/src/main/java/com/harleytg/dmzrankedunofficial"

class RankedHeaderTests(unittest.TestCase):
    def test_shared_header_uses_verified_branding(self):
        source=(JAVA/"RankedHeaderView.java").read_text()
        for name in ("ranked-hq-selected.webp","dmz-v1-discord.webp","arc-ranked.webp",
                     "dmz_community.png","puppy_clicker.png"):
            self.assertIn(name,source)
        for color in ("#33D4E7","#F4C15F","#62D8E5"):
            self.assertIn(color,source)
    def test_header_uses_actual_version_and_build(self):
        source=(JAVA/"RankedHeaderView.java").read_text()
        for part in ("getPackageManager()","getLongVersionCode","versionName",
                     'endsWith(".beta")','"BETA"','"Version "'):
            self.assertIn(part,source)
    def test_native_header_matches_legacy_layout_and_respects_compact(self):
        source=(JAVA/"RankedHeaderView.java").read_text()
        original=(ROOT/"app/src/main/res/layout/activity_main.xml").read_text()
        self.assertIn("HEIGHT_DP = 74;",source)
        self.assertIn("base = ",source)
        self.assertIn("? 58 :",source)
        self.assertIn('"content_size"',source)
        self.assertIn("fontScale",source)
        self.assertIn("ImageButton button",source)
        self.assertIn("ImageView image",source)
        self.assertIn("sans-serif-condensed",source)
        self.assertIn("badgeParams.leftMargin",source)
        self.assertIn('android:layout_height="74dp"',original)
    def test_ranked_launchers_consume_one_native_header(self):
        for activity in ("RankedHubActivity.java","RankedSiteActivity.java","SettingsActivity.java"):
            source=(JAVA/activity).read_text()
            self.assertIn("RankedHeaderView.create",source)
            self.assertIn("RankedHeaderView.heightDp(this)",source)
        hub=(JAVA/"RankedHubActivity.java").read_text()
        html=(ROOT/"app/src/main/assets/ranked-hub/index.html").read_text()
        self.assertIn("RankedHeaderView.THEME_HUB",hub)
        self.assertIn('grid-template-columns:repeat(2,minmax(0,1fr))',html)
        self.assertNotIn("<header>",html)
    def test_site_actions_unchanged(self):
        source=(JAVA/"RankedSiteActivity.java").read_text()
        for token in ("RankedHeaderView.THEME_DMZ_V1","RankedHeaderView.THEME_ARC",
                      "Return to Ranked HQ","Reload this website",
                      "Open in browser","SettingsActivity.class","RankedSafeArea.apply(root)"):
            self.assertIn(token,source)
    def test_original_header_still_present(self):
        source=(ROOT/"app/src/main/res/layout/activity_main.xml").read_text()
        for token in ('@+id/titleBar','@+id/titleLogo','@+id/betaBadge',
                      '@+id/titleMetaText','@+id/settingsButton'):
            self.assertIn(token,source)
if __name__=="__main__": unittest.main()
