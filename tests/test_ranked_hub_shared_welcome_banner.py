"""Ranked Hub's shared welcome banner appears on both owned ranked websites."""
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]
APP=ROOT/"app/src/main"
ASSETS=APP/"assets/ranked-overrides"
JAVA=APP/"java/com/harleytg/dmzrankedunofficial"
class WelcomeBannerTests(unittest.TestCase):
    def test_identical_shared_welcome_on_mw4_and_arc(self):
        code=(ASSETS/"welcome.js").read_text()
        css=(ASSETS/"welcome.css").read_text()
        self.assertIn("Welcome back, ",code)
        self.assertIn("Welcome, Guest!",code)
        self.assertIn("Thank you for using ",code)
        self.assertIn("Harley's Studios",code)
        self.assertIn("Ranked Hub",code)
        self.assertIn("'BETA'",code)
        self.assertIn("Ranked Hub app logo",code)
        self.assertIn("App-only display override",code)
        self.assertIn("does not modify or affect the dmzranked.com website",code)
        self.assertIn(".top-hud .hud-identity",code)
        self.assertIn(".my-standing-identity .my-standing-name",code)
        self.assertIn('data-ranked-hub-site="dmz-v1"',css)
        self.assertIn('data-ranked-hub-site="arc-raiders"',css)

    def test_mw4_fob_startup_css_does_not_hide_app_banner(self):
        css=(ASSETS/"welcome.css").read_text()
        js=(ASSETS/"welcome.js").read_text()
        # MW4's original startup CSS hides unknown body children with a
        # two-ID !important selector; the app's exemption must outrank it.
        self.assertIn("html[data-start-version=\"v1\"][data-ranked-hub-site=\"dmz-v1\"]",css)
        self.assertIn("#ranked-hub-welcome-banner#ranked-hub-welcome-banner",css)
        self.assertIn("display:flex!important",css)
        self.assertIn("--ranked-hub-welcome-offset",css)
        self.assertIn(".mw4-main.page-operations",css)
        self.assertIn(".fob-game-hud",css)
        self.assertIn(".navigation-rail",css)
        self.assertIn("banner.offsetHeight",js)
        self.assertIn("computed.marginTop",js)
        self.assertIn("computed.marginBottom",js)
        self.assertIn("window.addEventListener('resize',schedule)",js)
        self.assertIn("style.removeProperty('--ranked-hub-welcome-offset')",js)

    def test_installed_banner_is_secure_and_removable(self):
        code=(JAVA/"RankedSiteOverrides.java").read_text()
        self.assertIn('"https".equalsIgnoreCase(uri.getScheme())',code)
        self.assertIn("approvedHost.equalsIgnoreCase(uri.getHost())",code)
        self.assertIn("RankedSiteActivity.SITE_DMZ_V1",code)
        self.assertIn("RankedSiteActivity.SITE_ARC",code)
        self.assertIn("ranked-overrides/welcome.js",code)
        self.assertIn("ranked-overrides/welcome.css",code)
        self.assertIn("ranked-hub/ranked-hub-selected.webp",code)
        self.assertIn("data:image/webp;base64,",code)
        self.assertIn("first_party_css_overrides",code)
        self.assertIn("window.__rankedHubWelcome.destroy()",code)
        self.assertNotIn("addJavascriptInterface",code)
        self.assertIn("logoNode.alt='Ranked Hub app logo'",(ASSETS/"welcome.js").read_text())

if __name__=="__main__": unittest.main()
