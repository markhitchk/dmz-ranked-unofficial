"""Official user-selected Ranked Hub and MW4 DMZ icon regression tests."""
import hashlib
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]
ASSETS=ROOT/"app/src/main/assets/ranked-hub"
JAVA=ROOT/"app/src/main/java/com/harleytg/dmzrankedunofficial"
DISCORD_URL="https://cdn.discordapp.com/icons/1560773091674685563/add804ea564a54751612a45d8a5aeb1c.webp?size=512"
HUB_SHA="b27a070a9dc11817cfb1ebe01f0704cefbbf4261"

def git_blob_sha(data):
    return hashlib.sha1(f"blob {len(data)}\0".encode()+data).hexdigest()

class SelectedBrandingTests(unittest.TestCase):
    def test_hub_logo_is_exact_chosen_user_artwork(self):
        asset=ASSETS/"ranked-hub-logo.webp"
        self.assertTrue(asset.is_file(), "Missing selected Ranked Hub logo")
        self.assertEqual(git_blob_sha(asset.read_bytes()),HUB_SHA)
        header=(JAVA/"RankedHeaderView.java").read_text()
        self.assertIn('logo = "ranked-hub-logo.webp"',header)
        self.assertIn("Harley's Studios",header)

    def test_dmz_v1_uses_user_selected_discord_server_icon(self):
        html=(ASSETS/"index.html").read_text()
        header=(JAVA/"RankedHeaderView.java").read_text()
        gradle=(ROOT/"app/build.gradle").read_text()
        self.assertIn('src="dmz-v1-discord.webp"',html)
        self.assertIn('logo = "dmz-v1-discord.webp"',header)
        self.assertIn(DISCORD_URL,gradle)
        self.assertIn("dmz-v1-discord.webp",gradle)
        self.assertIn("WEBP",gradle)
        self.assertIn("ranked-hub/dmz-v1-discord.webp", (JAVA/"RankedSettingsStyler.java").read_text())

    def test_beta_android_launcher_uses_ranked_hub_logo(self):
        base=ROOT/"app/src/beta/res"
        src=base/"drawable-nodpi/ranked_hub_logo.webp"
        self.assertTrue(src.exists())
        self.assertEqual(git_blob_sha(src.read_bytes()),HUB_SHA)
        for name in ["ic_launcher.xml","ic_launcher_round.xml"]:
            xml=(base/"mipmap-anydpi-v26"/name).read_text()
            self.assertIn("@drawable/ranked_hub_launcher_foreground",xml)
        foreground=(base/"drawable/ranked_hub_launcher_foreground.xml").read_text()
        self.assertIn("@drawable/ranked_hub_logo",foreground)

    def test_studio_and_arc_logos_remain_untouched(self):
        header=(JAVA/"RankedHeaderView.java").read_text()
        self.assertIn('logo = "arc-ranked.webp"',header)
        self.assertIn('logo = "dmz_community.png"',header)
        self.assertIn("bundleOfficialStudioLogo",(ROOT/"app/build.gradle").read_text())

if __name__ == "__main__":
    unittest.main()
