"""Prevent Android launchers from adding black adaptive-icon backplates to beta."""
from pathlib import Path
import xml.etree.ElementTree as ET
import unittest
import hashlib
ROOT=Path(__file__).resolve().parents[1]
BETA=ROOT/"app/src/beta/res"
SHA="4ef2ea7cc932ab309b15604b5275af2616116e38"
ANDROID="{http://schemas.android.com/apk/res/android}"

class RankedHubIconAlphaTests(unittest.TestCase):
    def test_launcher_assets_are_original_transparent_logo(self):
        for path in [
            BETA/"drawable-nodpi/ranked_hq_logo.webp",
            BETA/"mipmap-nodpi/ic_launcher.webp",
            BETA/"mipmap-nodpi/ic_launcher_round.webp"
        ]:
            content=path.read_bytes()
            self.assertEqual(hashlib.sha1(
                (f"blob {len(content)}\0").encode()+content).hexdigest(),SHA)

    def test_webp_assets_are_full_resolution_with_alpha(self):
        for path in [
            BETA/"drawable-nodpi/ranked_hq_logo.webp",
            BETA/"mipmap-nodpi/ic_launcher.webp",
            BETA/"mipmap-nodpi/ic_launcher_round.webp",
            ROOT/"app/src/main/assets/ranked-hub/ranked-hq-selected.webp",
            ROOT/"app/src/main/res/drawable-nodpi/ranked_hq_logo.webp"
        ]:
            data = path.read_bytes()
            self.assertGreater(len(data), 50000, str(path))
            self.assertEqual(data[:4], b"RIFF")
            self.assertEqual(data[8:16], b"WEBPVP8X")
            self.assertTrue(data[20] & 0x10, "WebP must preserve transparency")
            self.assertEqual(1 + int.from_bytes(data[24:27], "little"), 512)
            self.assertEqual(1 + int.from_bytes(data[27:30], "little"), 512)

    def test_adaptive_logo_fits_official_66dp_safe_zone(self):
        layer=ET.parse(BETA/"drawable/ranked_hub_launcher_foreground.xml").getroot()
        for side in ("Left","Top","Right","Bottom"):
            self.assertEqual(layer.attrib[ANDROID+"inset"+side],"21dp")
        # 108dp total icon - 21dp inset on either side = 66dp of artwork.
        self.assertEqual(108-2*21,66)
        splash=ET.parse(BETA/"drawable/ranked_hub_splash_icon.xml").getroot()
        self.assertEqual(splash.attrib[ANDROID+"insetTop"],"20dp")
        self.assertNotEqual(splash.attrib[ANDROID+"insetTop"],
                            layer.attrib[ANDROID+"insetTop"])

    def test_beta_adaptive_icons_preserve_transparent_background(self):
        for name in ("ic_launcher.xml","ic_launcher_round.xml"):
            root=ET.parse(BETA/"mipmap-anydpi-v26"/name).getroot()
            self.assertEqual(root.tag,"adaptive-icon")
            self.assertEqual(root.find("background").attrib[ANDROID+"drawable"],
                             "@android:color/transparent")
            self.assertEqual(root.find("foreground").attrib[ANDROID+"drawable"],
                             "@drawable/ranked_hub_launcher_foreground")
        # Existing legacy production icon stays as shipped.
        original=ET.parse(ROOT/"app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml").getroot()
        self.assertEqual(original.tag,"adaptive-icon")

if __name__=="__main__": unittest.main()
