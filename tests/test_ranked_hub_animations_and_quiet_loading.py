"""Ranked Hub Beta visual polish and quiet loading regression checks."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
JAVA = ROOT / "app/src/main/java/com/harleytg/dmzrankedunofficial"
HTML = (ROOT / "app/src/main/assets/ranked-hub/index.html").read_text()

class HubPolishTests(unittest.TestCase):
    def test_selector_uses_original_logos_and_four_cards(self):
        self.assertEqual(HTML.count('class="tile tile--'), 4)
        self.assertIn('dmz-v1-discord.webp', HTML)
        self.assertIn('arc-ranked.webp', HTML)
        self.assertIn('dmz_community.png', HTML)
        self.assertIn('grid-template-columns:repeat(2,minmax(0,1fr))', HTML)

    def test_staggered_motion_and_reduce_motion(self):
        self.assertIn('@keyframes hubEnter', HTML)
        self.assertIn('@keyframes hubScan', HTML)
        self.assertIn('@keyframes hubBreath', HTML)
        self.assertIn('html.reduce-motion', HTML)
        self.assertIn('prefers-reduced-motion:reduce', HTML)
        activity = (JAVA / "RankedHubActivity.java").read_text()
        self.assertIn('loadLauncherHtml(reduceMotion)', activity)
        self.assertIn('setJavaScriptEnabled(false)', activity)

    def test_real_settings_gear_in_shared_header(self):
        header = (JAVA / "RankedHeaderView.java").read_text()
        self.assertIn('R.drawable.ic_settings', header)
        self.assertIn('ImageButton button', header)
        self.assertIn('Open app settings', header)

    def test_optional_verbose_loaders_and_recovery_controls(self):
        intro = (JAVA / "RankedIntroView.java").read_text()
        self.assertNotIn('HARLEY\'S STUDIOS  //  RANKED NETWORK', intro)
        load = (JAVA / "RankedLoadCoordinator.java").read_text()
        self.assertIn('visible=verbose;', load)
        self.assertIn('GAME UNAVAILABLE', load)
        self.assertIn('addAction("RETRY",retry)', load)
        self.assertNotIn('COPY DIAGNOSTICS', load)
        self.assertIn('startupStatus', intro)
        settings = (JAVA / "SettingsActivity.java").read_text()
        self.assertIn('PREF_VERBOSE_LOADING', settings)
        self.assertNotIn('verboseLoading.setEnabled(false)', settings)
        main = (JAVA / "MainActivity.java").read_text()
        self.assertIn('com.harleytg.rankedhub.beta', main)
        self.assertIn('loadingVerboseText.setVisibility(verbose ? View.VISIBLE : View.GONE)', main)

if __name__ == "__main__":
    unittest.main()
