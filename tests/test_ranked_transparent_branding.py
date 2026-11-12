"""Beta-specific transparency checks for launcher, splash and in-app logo."""
from pathlib import Path
import hashlib
import unittest

ROOT = Path(__file__).resolve().parents[1]
BETA = ROOT / "app/src/beta/res"

def sha_git(b):
    return hashlib.sha1(f"blob {len(b)}\0".encode() + b).hexdigest()

class TransparentBetaBrandingTests(unittest.TestCase):
    def test_adaptive_launcher_layers_are_transparent_and_use_original_art(self):
        for filename in ["ic_launcher.xml", "ic_launcher_round.xml"]:
            xml = (BETA / "mipmap-anydpi-v26" / filename).read_text()
            self.assertIn("<adaptive-icon", xml)
            self.assertIn('android:drawable="@android:color/transparent"', xml)
            self.assertIn('android:drawable="@drawable/ranked_hub_launcher_foreground"', xml)
            self.assertNotIn('android:drawable="@color/dmz_black"', xml)
        inset = (BETA/"drawable/ranked_hub_launcher_foreground.xml").read_text()
        self.assertIn('android:insetLeft="10dp"', inset)

    def test_splash_uses_beta_artwork_not_dmz_artwork(self):
        xml=(BETA/"values-v31/themes.xml").read_text()
        self.assertIn('android:windowSplashScreenAnimatedIcon',xml)
        self.assertIn('@drawable/ranked_hub_splash_icon',xml)
        self.assertIn('android:windowSplashScreenIconBackgroundColor',xml)
        self.assertIn('@android:color/transparent',xml)
        self.assertNotIn('@drawable/dmz_splash_icon',xml)
        splash=(BETA/"drawable/ranked_hub_splash_icon.xml").read_text()
        self.assertIn('@drawable/ranked_hub_logo',splash)

    def test_beta_legacy_icons_use_alpha_artwork(self):
        selected=(BETA/"drawable-nodpi/ranked_hub_logo.webp").read_bytes()
        self.assertEqual(sha_git(selected),"b27a070a9dc11817cfb1ebe01f0704cefbbf4261")
        for name in ("ic_launcher.webp","ic_launcher_round.webp"):
            self.assertEqual(sha_git((BETA/"mipmap-nodpi"/name).read_bytes()),
                             sha_git(selected))

    def test_in_app_images_have_no_opaque_plate(self):
        xml=(ROOT/"app/src/main/res/layout/activity_settings.xml").read_text()
        from_pos=xml.index('android:id="@+id/aboutLogo"')
        about=xml[from_pos:xml.index("/>",from_pos)]
        self.assertIn('android:background="@android:color/transparent"',about)
        header=(ROOT/"app/src/main/java/com/harleytg/dmzrankedunofficial/RankedHeaderView.java").read_text()
        self.assertIn("ranked-hub-selected.webp",header)
        self.assertIn("object-fit:contain",header)

if __name__=="__main__":
    unittest.main()
