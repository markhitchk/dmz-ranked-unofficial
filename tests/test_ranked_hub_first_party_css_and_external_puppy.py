"""First-party MW4/ARC sites render their original CSS without app-injected banners."""
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]
JAVA=ROOT/"app/src/main/java/com/harleytg/dmzrankedunofficial"
ASSETS=ROOT/"app/src/main/assets/ranked-overrides"
LAYOUT=ROOT/"app/src/main/res/layout/activity_settings.xml"

class NativeWebsiteRenderingTests(unittest.TestCase):
    def test_no_first_party_css_or_welcome_injection(self):
        activity=(JAVA/"RankedSiteActivity.java").read_text()
        settings=(JAVA/"SettingsActivity.java").read_text()
        layout=LAYOUT.read_text()
        self.assertNotIn("RankedSiteOverrides.apply",activity)
        self.assertNotIn("applyAppSiteCss",activity)
        self.assertNotIn("firstPartyCssOverrides",settings)
        self.assertNotIn("firstPartyCssOverrides",layout)
        self.assertFalse((JAVA/"RankedSiteOverrides.java").exists())
        for name in ("arc.css","mw4.css","welcome.css","welcome.js"):
            self.assertFalse((ASSETS/name).exists(),name)
        self.assertIn('homeUrl = "https://dmz-ranked.vercel.app/#v1"',activity)
        self.assertIn('homeUrl = "https://arc-raiders-ranked.vercel.app/"',activity)

    def test_puppy_clicker_stays_external(self):
        hub=(JAVA/"RankedHubActivity.java").read_text()
        html=(ROOT/"app/src/main/assets/ranked-hub/projects.html").read_text()
        self.assertIn("openPuppyInBrowser()",hub)
        self.assertIn("new Intent(Intent.ACTION_VIEW",hub)
        self.assertIn("https://puppy-clicker.vercel.app/",hub)
        self.assertIn("OPEN IN BROWSER",html)
        self.assertNotIn("openSite(RankedSiteActivity.SITE_PUPPY)",hub)

if __name__=="__main__":unittest.main()
