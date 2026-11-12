"""Regression contract for the Superpowers launch/settings/backup plan."""
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[1]
JAVA=ROOT/"app/src/main/java/com/harleytg/dmzrankedunofficial"
def source(name): return (JAVA/name).read_text()

class RankedPlanImplementation(unittest.TestCase):
    def test_real_native_intro_with_reduced_motion(self):
        intro=source("RankedIntroView.java")
        hub=source("RankedHubActivity.java")
        self.assertIn("ranked-hub/ranked-hub-selected.webp",intro)
        self.assertIn("ObjectAnimator",intro)
        self.assertIn("reduced_motion",hub)
        self.assertIn("onPageFinished",hub)
        self.assertIn("RankedIntroView",hub)
        self.assertNotIn("Thread.sleep",intro)

    def test_loading_is_callback_driven_with_recovery(self):
        loader=source("RankedLoadCoordinator.java")
        site=source("RankedSiteActivity.java")
        for event in ("onPageStarted","onPageCommitVisible","onReceivedError",
                      "onReceivedSslError","onPageFinished"):
            self.assertIn(event,site)
        for action in ("RETRY", "HUB","BROWSER","TIMEOUT","ERROR"):
            self.assertIn(action,loader)
        self.assertIn("verbose, () -> webView.loadUrl(homeUrl)",site)
        self.assertIn("visible=verbose;", loader)
        self.assertIn("15_000",loader)
        self.assertNotIn("percentComplete = 100",loader)

    def test_site_settings_have_context_and_safe_legacy_visibility(self):
        site=source("RankedSiteActivity.java")
        settings=source("SettingsActivity.java")
        xml=(ROOT/"app/src/main/res/layout/activity_settings.xml").read_text()
        self.assertIn("EXTRA_LAUNCHER_THEME",site)
        self.assertIn("rankedDestinationsSection",xml)
        self.assertIn("rankedMw4SettingsCard",xml)
        self.assertIn("rankedArcSettingsCard",xml)
        self.assertIn("rankedCommunitySettingsCard",xml)
        self.assertIn("RankedHeaderView.THEME_COMMUNITY",settings)
        self.assertIn("operatorBackupSection",settings)
        self.assertIn("settingsScroll",xml)
        self.assertIn('android:clipToPadding="true"',xml)

    def test_safe_portable_backup_actions_are_exposed(self):
        backup=source("RankedBackupManager.java")
        settings=source("SettingsActivity.java")
        xml=(ROOT/"app/src/main/res/layout/activity_settings.xml").read_text()
        for term in ("PBKDF2WithHmacSHA256", "AES/GCM/NoPadding","formatVersion",
                     "ZipOutputStream","ZipInputStream","SHA-256","operatorBackups"):
            self.assertIn(term,backup)
        for term in ("ACTION_CREATE_DOCUMENT","ACTION_OPEN_DOCUMENT",
                     "RankedBackupManager", "confirmBackupImport"):
            self.assertIn(term,settings)
        self.assertIn("rankedBackupExportCard",xml)
        self.assertIn("rankedBackupImportCard",xml)

    def test_no_claim_of_remote_site_backup_without_contract(self):
        xml=(ROOT/"app/src/main/res/layout/activity_settings.xml").read_text()
        settings=source("SettingsActivity.java")
        self.assertIn("Website backup requires site support",xml)
        self.assertIn("com.harleytg.rankedhub.beta",settings)

if __name__=="__main__":
    unittest.main()
