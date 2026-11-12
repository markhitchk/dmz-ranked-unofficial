"""Compact app chrome must honor Android and Ranked Hub sizing preferences."""
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[1]
JAVA=ROOT/"app/src/main/java/com/harleytg/dmzrankedunofficial"

class CompactChromeTests(unittest.TestCase):
    def test_all_launcher_views_use_shared_dynamic_header_height(self):
        header=(JAVA/"RankedHeaderView.java").read_text()
        self.assertIn("contentSize(activity)", header)
        self.assertIn("fontScale", header)
        self.assertIn("DENSITY_DEVICE_STABLE", header)
        self.assertIn("? 58 :", header)
        self.assertIn("HEIGHT_DP = 74;", header)
        self.assertIn("base + extra",header)
        for activity in ("RankedHubActivity.java","RankedSiteActivity.java","SettingsActivity.java"):
            src=(JAVA/activity).read_text()
            self.assertIn("RankedHeaderView.heightDp(this)",src)
        community=(JAVA/"MainActivity.java").read_text()
        self.assertIn("applyBetaCompactTitleBar()",community)
        self.assertIn('com.harleytg.rankedhub.beta',community)

    def test_content_size_updates_immediately_after_settings(self):
        hub=(JAVA/"RankedHubActivity.java").read_text()
        site=(JAVA/"RankedSiteActivity.java").read_text()
        settings=(JAVA/"SettingsActivity.java").read_text()
        self.assertIn("RankedHeaderView.signature(this)",hub)
        self.assertIn("RankedHeaderView.signature(this)",site)
        self.assertIn("onResume()",hub)
        self.assertIn("onResume()",site)
        self.assertIn('recreate();',settings)

    def test_transparent_icon_is_not_legacy_normalized(self):
        folder=ROOT/"app/src/beta/res"
        for filename in ("ic_launcher.xml","ic_launcher_round.xml"):
            icon=(folder/"mipmap-anydpi-v26"/filename).read_text()
            self.assertIn("adaptive-icon",icon)
            self.assertIn('@android:color/transparent',icon)
            self.assertIn('@drawable/ranked_hub_launcher_foreground',icon)
        foreground=(folder/"drawable/ranked_hub_launcher_foreground.xml").read_text()
        self.assertIn('android:insetLeft="10dp"',foreground)
        self.assertIn('android:insetTop="10dp"',foreground)

if __name__=="__main__":unittest.main()
