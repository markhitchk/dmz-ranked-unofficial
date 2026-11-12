"""Offline Ranked Hub grid and original website branding regression tests."""
import hashlib
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "app/src/main/assets/ranked-hub"

def git_blob_sha(blob):
    return hashlib.sha1(f"blob {len(blob)}\0".encode() + blob).hexdigest()

class RankedHubGridTests(unittest.TestCase):
    def test_offline_home_has_real_two_column_grid(self):
        html = (ASSETS / "index.html").read_text()
        self.assertIn("grid-template-columns:repeat(2,minmax(0,1fr))", html)
        self.assertIn("ranked-hub/index.html", (ROOT / "app/src/main/java/com/harleytg/dmzrankedunofficial/RankedHubActivity.java").read_text())
        for target in ("dmz-v1", "arc-raiders", "community"):
            self.assertIn("rankedhub://open/" + target, html)
        self.assertIn("COMING SOON", html)
        self.assertNotIn("rankedhub://open/coming", html)
        self.assertNotIn("ONE HUB.", html)

    def test_official_site_logos_are_bundled(self):
        self.assertEqual(git_blob_sha((ASSETS / "dmz-v1.svg").read_bytes()),
                         "3108faeecfca610cfd93f292d64934b96708db10")
        self.assertEqual(git_blob_sha((ASSETS / "arc-ranked.webp").read_bytes()),
                         "19ddced610d2273b658e062f4ef50b024969fa68")
        html = (ASSETS / "index.html").read_text()
        for name in ("dmz-v1-discord.webp", "arc-ranked.webp", "dmz_community.png"):
            self.assertIn(name, html)
        # Studio logo is now in the shared native header rather than duplicated
        # inside the scrolling grid.
        header = (ROOT / "app/src/main/java/com/harleytg/dmzrankedunofficial/RankedHeaderView.java").read_text()
        self.assertIn("ranked-hub-selected.webp", header)

    def test_android_stages_original_studio_and_legacy_artwork(self):
        gradle = (ROOT / "app/build.gradle").read_text()
        for term in ("prepareRankedHubAssets", "generatedHubAssetsDir",
                     "harleys_studios_official.png", "dmz_ranked_logo.png", "bundleOfficialStudioLogo"):
            self.assertIn(term, gradle)

    def test_native_hub_routes_only_to_known_activities(self):
        java = (ROOT / "app/src/main/java/com/harleytg/dmzrankedunofficial/RankedHubActivity.java").read_text()
        for term in ("RankedSafeArea.apply(root)", "new Intent(this, MainActivity.class)",
                     "RankedSiteActivity.SITE_DMZ_V1", "RankedSiteActivity.SITE_ARC", "rankedhub"):
            self.assertIn(term, java)

if __name__ == "__main__":
    unittest.main()
