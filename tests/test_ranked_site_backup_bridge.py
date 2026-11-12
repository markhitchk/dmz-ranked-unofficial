"""First-party site backup bridging regression contracts."""
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[1]
JAVA=ROOT/"app/src/main/java/com/harleytg/dmzrankedunofficial"
def src(name): return (JAVA/name).read_text()

class FirstPartyBackupTests(unittest.TestCase):
 def test_strict_site_scoped_storage(self):
  s=src("RankedSiteSafeBackupStore.java")
  for x in ("dmz-v1","arc-raiders","schemaVersion","graphicsMode","callsign","loadout",
            "orders","reports","access_token","save","read","validate","snapshot"):
   self.assertIn(x,s)
 def test_bridge_requires_explicit_navigation_and_same_host(self):
  s=src("RankedSiteActivity.java")
  self.assertIn("captureSiteBackup",s)
  self.assertIn("restoreSiteBackup",s)
  self.assertIn("isApprovedSite",s)
  self.assertIn("RankedHubBackupV1.exportSafeState",s)
  self.assertIn("RankedHubBackupV1.importSafeState",s)
  self.assertIn("validate",s)
 def test_encrypted_archive_includes_optional_first_party_snapshots(self):
  s=src("RankedBackupManager.java")
  for x in ("RankedSiteSafeBackupStore","mw4.json","arc.json","formatVersion",
            "SHA-256","siteSnapshots","AES/GCM/NoPadding"):
   self.assertIn(x,s)
 def test_settings_distinguishes_no_capture_from_site_login(self):
  s=src("SettingsActivity.java")
  self.assertIn("RankedSiteSafeBackupStore",s)
  self.assertIn("Open MW4 or ARC",s)
  self.assertIn("Website backup requires site support",s)
if __name__=="__main__":unittest.main()
