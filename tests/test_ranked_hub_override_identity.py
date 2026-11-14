"""Ranked HQ beta must not show original DMZRanked.com app branding."""
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]
JS=(ROOT/"remote/app-ui/app.js").read_text()
CSS=(ROOT/"remote/app-ui/app.css").read_text()
NATIVE=(ROOT/"app/src/main/java/com/harleytg/dmzrankedunofficial/MainActivity.java").read_text()
ASSETS=ROOT/"app/src/main/assets/ranked-hub"

class HubOverrideIdentityTests(unittest.TestCase):
    def test_hub_is_package_scoped_and_uses_real_offline_logo(self):
        self.assertIn('com.harleytg.rankedhub.beta',JS)
        self.assertIn('APP_DISPLAY_NAME = IS_RANKED_HUB ? "Ranked HQ"',JS)
        self.assertIn('title.textContent = APP_DISPLAY_NAME;',JS)
        self.assertIn('logo.alt = IS_RANKED_HUB ?',JS)
        self.assertIn('ranked-hq-selected.webp',NATIVE)
        self.assertIn('data:image/webp;base64,',NATIVE)
        self.assertTrue((ASSETS/"ranked-hq-selected.webp").is_file())
        self.assertIn('info.put("logoUrl", isRankedHubBeta()',NATIVE)

    def test_legacy_dmz_app_branding_is_not_replaced_for_other_packages(self):
        self.assertIn('IS_RANKED_HUB ? "Ranked HQ" : "DMZ Ranked Unofficial App"',JS)
        self.assertIn('if (!isRankedHubBeta()) return javascript;',NATIVE)
        self.assertIn('if (!isRankedHubBeta()) return INSTALL_HARLEYS_STUDIOS_MESSAGE_SCRIPT;',NATIVE)
        self.assertIn('DMZ Ranked Unofficial App',NATIVE)
        self.assertIn('DMZ Ranked Unofficial App',JS)
        self.assertIn('dmzranked.com website',JS)

    def test_streamed_and_fallback_overrides_are_both_rebranded(self):
        self.assertIn('view.evaluateJavascript(brandedMessageScript(), null)',NATIVE)
        self.assertNotIn('view.evaluateJavascript(INSTALL_HARLEYS_STUDIOS_MESSAGE_SCRIPT, null)',NATIVE)
        self.assertIn('brandedAppUiJavascript(javascript)',NATIVE)
        self.assertIn('RANKED_HUB_BRAND_CSS',NATIVE)
        self.assertIn('data-hs-ranked-hub',NATIVE)
        self.assertIn('html[data-hs-ranked-hub="true"]',CSS)
        self.assertIn('logo.src=',NATIVE)
        self.assertIn('appBuildLabel()',JS)
        self.assertIn('Ranked HQ Beta connects',JS)
        self.assertIn('Harley',JS)

if __name__=="__main__":unittest.main()
