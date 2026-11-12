"""The second launcher, genuine Puppy Clicker artwork, and optional verbose UI."""
from pathlib import Path
import unittest
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
JAVA = ROOT / "app/src/main/java/com/harleytg/dmzrankedunofficial"
ASSETS = ROOT / "app/src/main/assets/ranked-hub"

class ProjectsLauncherTests(unittest.TestCase):
    def test_projects_launcher_is_bundled_and_navigable_without_javascript(self):
        html = (ASSETS / "index.html").read_text()
        projects = (ASSETS / "projects.html").read_text()
        hub = (JAVA / "RankedHubActivity.java").read_text()
        self.assertIn('rankedhub://open/projects', html)
        self.assertIn('rankedhub://open/puppy-clicker', projects)
        self.assertIn('rankedhub://open/home', projects)
        self.assertIn('src="puppy_clicker.png"', projects)
        self.assertIn('src="official_studio.png"', projects)
        self.assertIn('NEXT RANKED GAME', projects)
        self.assertIn('COMING SOON', projects)
        self.assertNotIn('<script', projects)
        self.assertIn('setJavaScriptEnabled(false)', hub)
        self.assertIn('if (projectsPage)', hub)
        self.assertIn('PROJECTS_ASSET', hub)

    def test_puppy_site_is_explicit_allowlisted_in_its_own_webview(self):
        site = (JAVA / "RankedSiteActivity.java").read_text()
        header = (JAVA / "RankedHeaderView.java").read_text()
        gradle = (ROOT / "app/build.gradle").read_text()
        self.assertIn('SITE_PUPPY = "puppy-clicker"', site)
        self.assertIn('https://puppy-clicker.vercel.app/', site)
        self.assertIn('isApprovedSite(uri)', site)
        self.assertIn('SITE_PUPPY.equals', site)
        self.assertIn('logo = "puppy_clicker.png"', header)
        self.assertIn('120206a7057633b3da2c49ba70c001926c19860c', gradle)
        self.assertIn('Puppy-Clicker/main/assets/logos/puppy_clicker.png', gradle)

    def test_verbose_loading_has_a_real_settings_toggle(self):
        strings = (ROOT / "app/src/main/res/values/strings.xml").read_text()
        activity = (JAVA / "SettingsActivity.java").read_text()
        hub = (JAVA / "RankedHubActivity.java").read_text()
        intro = (JAVA / "RankedIntroView.java").read_text()
        site = (JAVA / "RankedSiteActivity.java").read_text()
        main = (JAVA / "MainActivity.java").read_text()
        xml = ET.parse(ROOT / "app/src/main/res/layout/activity_settings.xml")
        ids = [node.attrib.get('{http://schemas.android.com/apk/res/android}id','')
               for node in xml.iter()]
        self.assertIn('@+id/verboseLoadingSwitch', ids)
        self.assertIn('Verbose startup &amp; loading', strings)
        self.assertIn('PREF_VERBOSE_LOADING, isRankedHubBuild()', activity)
        self.assertIn('prefs.getBoolean("verbose_loading", true)', hub)
        self.assertIn('startupStatus.setVisibility(verbose', intro)
        self.assertIn('boolean verbose = sitePreferences.getBoolean("verbose_loading"', site)
        self.assertIn('PREF_VERBOSE_LOADING,', main)
        self.assertNotIn('verboseLoading.setEnabled(false)', activity)

if __name__ == "__main__":
    unittest.main()
