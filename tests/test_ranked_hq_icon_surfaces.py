"""Verify Ranked HQ Beta uses the correct full-color crest on native UI surfaces."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
JAVA = ROOT / "app/src/main/java/com/harleytg/dmzrankedunofficial"

class RankedHQIconSurfaceTests(unittest.TestCase):
    def test_header_and_intro_have_hq_drawable_fallbacks(self):
        header = (JAVA / "RankedHeaderView.java").read_text()
        intro = (JAVA / "RankedIntroView.java").read_text()
        self.assertIn("theme == THEME_HUB", header)
        self.assertIn("R.drawable.ranked_hq_logo : R.drawable.dmz_ranked_logo", header)
        self.assertIn("logo.setImageResource(R.drawable.ranked_hq_logo)", intro)

    def test_settings_and_notifications_use_beta_brand_not_legacy_icon(self):
        settings = (JAVA / "SettingsActivity.java").read_text()
        styler = (JAVA / "RankedSettingsStyler.java").read_text()
        self.assertIn("isRankedHubBuild() ? R.drawable.ranked_hq_logo", settings)
        self.assertIn("launcherTheme == RankedHeaderView.THEME_HUB", settings)
        self.assertIn("R.drawable.ranked_hq_logo : R.drawable.dmz_ranked_logo", settings)
        self.assertIn("about.setImageResource(R.drawable.ranked_hq_logo)", styler)

    def test_beta_drawable_not_replaced_in_production(self):
        beta = ROOT / "app/src/beta/res"
        self.assertTrue((beta / "drawable-nodpi/ranked_hq_logo.webp").is_file())
        self.assertTrue((ROOT / "app/src/main/res/drawable-nodpi/ranked_hq_logo.webp").is_file())
        self.assertEqual(
            (ROOT / "app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml").read_text().count(
                "@drawable/dmz_launcher_foreground"), 1)

if __name__ == "__main__":
    unittest.main()
