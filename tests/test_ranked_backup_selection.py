"""Restore/export selection must not silently replace unselected site data."""
from pathlib import Path
import unittest
root=Path(__file__).resolve().parents[1]/"app/src/main/java/com/harleytg/dmzrankedunofficial"
class BackupSelectionTests(unittest.TestCase):
 def test_encrypted_backup_supports_site_scoped_selection(self):
  s=(root/"RankedBackupManager.java").read_text()
  self.assertIn("Set<String> selectedSiteIds",s)
  self.assertIn("selectedSiteIds.contains(",s)
  self.assertIn("formatVersion",s)
  self.assertIn("ZipInputStream",s)
  self.assertIn("RankedSiteSafeBackupStore.validate",s)
  self.assertIn("revert.putStringSet",s) # failed import rollback preserves string-set preferences
 def test_restore_preview_requires_explicit_choice(self):
  s=(root/"SettingsActivity.java").read_text()
  self.assertIn("setMultiChoiceItems",s)
  self.assertIn("restoreBackup(this,preview,selected",s)
  self.assertIn("exportBackup(this,uri,password,selected",s)
  self.assertIn("CANCEL",s)
if __name__=="__main__":unittest.main()
