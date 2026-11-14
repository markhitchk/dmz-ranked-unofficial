"""Ranked HQ package identity and explicit legacy app transfer regressions."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
JAVA = ROOT / "app/src/main/java/com/harleytg/dmzrankedunofficial"

class PackageTransferTests(unittest.TestCase):
    def test_beta_id_is_independent_while_original_stable_remains_intact(self):
        g = (ROOT / "app/build.gradle").read_text()
        self.assertIn("applicationId 'com.harleytg.dmzranked'", g)
        self.assertIn("variant.applicationId.set('com.harleytg.rankedhub.beta')", g)
        self.assertIn("withBuildType('beta')", g)
        self.assertIn("versionCode 192", g)
        self.assertIn("versionName '1.0.88'", g)

    def test_migration_uses_only_explicit_installed_legacy_sources(self):
        s=(JAVA/"RankedHubDataTransfer.java").read_text()
        for token in ("com.harleytg.dmzranked.beta",
                      "com.harleytg.dmzranked",
                      "SIGNATURE_MATCH",
                      "checkSignatures",
                      "/export",
                      "sourcePackage",
                      "operatorBackups"):
            self.assertIn(token,s)
        self.assertIn("MAX_TRANSFER_BYTES",s)
        self.assertIn("SAFE_BOOLEAN_KEYS",s)
        self.assertIn("SAFE_STRING_KEYS",s)
        self.assertIn("sanitizeOperatorBackups",s)
        self.assertIn("setString",s) if "setString" in s else self.assertIn("putString",s)

    def test_settings_offers_manual_import_and_never_auto_imports(self):
        s=(JAVA/"SettingsActivity.java").read_text()
        for token in ("com.harleytg.rankedhub.beta",
                      "confirmRankedHubImport",
                      "RankedHubDataTransfer.importFrom",
                      "Import from previous app",
                      "getPackageName()"):
            self.assertIn(token,s)
        # Selection must require an explicit click, not app startup.
        self.assertNotIn("RankedHubDataTransfer.importFrom(this", (JAVA/"RankedHubActivity.java").read_text())

    def test_migration_does_not_transfer_auth_data(self):
        s=(JAVA/"RankedHubDataTransfer.java").read_text()
        for token in ("access_?token","password","refresh_?token","session","token","blockedKey","blockedValue"):
            self.assertIn(token,s)
        self.assertIn("MAX_OPERATOR_VALUE_CHARS",s)
        self.assertIn("website_operator_verified",s)

    def test_queries_allow_both_existing_packages(self):
        s=(ROOT/"app/src/main/AndroidManifest.xml").read_text()
        self.assertIn('android:authorities="com.harleytg.dmzranked.migration"',s)
        self.assertIn('android:authorities="com.harleytg.dmzranked.beta.migration"',s)
        self.assertIn('android:authorities="${applicationId}.migration"',s)

if __name__=="__main__":
    unittest.main()
