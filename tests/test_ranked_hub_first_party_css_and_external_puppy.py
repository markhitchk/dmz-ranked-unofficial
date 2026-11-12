"""App-only origin restricted CSS and external Puppy Clicker browser."""
from pathlib import Path
import unittest
R=Path(__file__).resolve().parents[1]
J=R/"app/src/main/java/com/harleytg/dmzrankedunofficial"
A=R/"app/src/main/assets"
class RankedOwnedOverridesTests(unittest.TestCase):
    def test_scoped_css(self):
        overrides=(J/"RankedSiteOverrides.java").read_text()
        activity=(J/"RankedSiteActivity.java").read_text()
        settings=(J/"SettingsActivity.java").read_text()
        self.assertIn('"https".equalsIgnoreCase(uri.getScheme())',overrides)
        self.assertIn("approvedHost.equalsIgnoreCase(uri.getHost())",overrides)
        self.assertIn("RankedSiteActivity.SITE_DMZ_V1",overrides)
        self.assertIn("RankedSiteActivity.SITE_ARC",overrides)
        self.assertIn("RankedSiteOverrides.apply",activity)
        self.assertIn("PREF_CSS_OVERRIDES",settings)
        self.assertIn("firstPartyCssOverridesSwitch",settings)
        for filename,scope in [("mw4.css",'data-ranked-hub-site="dmz-v1"'),
                               ("arc.css",'data-ranked-hub-site="arc-raiders"')]:
            css=(A/"ranked-overrides"/filename).read_text()
            self.assertIn(scope,css)
            self.assertNotIn("dmzranked.com",css)
    def test_browser_for_puppy(self):
        hub=(J/"RankedHubActivity.java").read_text()
        html=(A/"ranked-hub/projects.html").read_text()
        self.assertIn("openPuppyInBrowser()",hub)
        self.assertIn("new Intent(Intent.ACTION_VIEW",hub)
        self.assertIn("https://puppy-clicker.vercel.app/",hub)
        self.assertIn("OPEN IN BROWSER",html)
        self.assertNotIn("openSite(RankedSiteActivity.SITE_PUPPY)",hub)
if __name__=="__main__":unittest.main()
