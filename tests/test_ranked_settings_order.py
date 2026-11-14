"""Settings layout hierarchy: section order is a user-visible navigation contract."""
from pathlib import Path
import unittest
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
XML = ROOT / "app/src/main/res/layout/activity_settings.xml"
ACTIVITY = ROOT / "app/src/main/java/com/harleytg/dmzrankedunofficial/SettingsActivity.java"
NS = "{http://schemas.android.com/apk/res/android}"

def ident(node):
    return node.attrib.get(NS + "id", "").replace("@+id/", "")

class RankedSettingsOrderTests(unittest.TestCase):
    def test_settings_are_ordered_by_user_task(self):
        root = ET.parse(XML).getroot()
        scroll = next(node for node in root.iter() if ident(node) == "settingsScroll")
        container = next(child for child in scroll if child.tag == "LinearLayout")
        order = [ident(child) for child in container if ident(child)]
        expected = [
            "searchEmptyState",
            "settingsCategoryOverview",
            "aboutCard",
            "rankedDestinationsSection",
            "appearanceSection",
            "appExperienceSection",
            "rankedBackupSection",
            "operatorBackupSection",
            "notificationsSection",
            "widgetSection",
            "updatesSection",
            "pageActionsSection",
            "dataTransferSection",
            "betaProgramSection",
            "helpSection",
            "developerSection",
            "dangerZoneSection",
        ]
        self.assertEqual(order, expected)

    def test_reduced_motion_lives_in_appearance_not_an_orphan(self):
        root=ET.parse(XML).getroot()
        appearance=next(node for node in root.iter() if ident(node)=="appearanceSection")
        self.assertIn("reducedMotionCard",[ident(child) for child in appearance])
        scroll=next(node for node in root.iter() if ident(node)=="settingsScroll")
        container=next(child for child in scroll if child.tag=="LinearLayout")
        self.assertNotIn("reducedMotionCard",[ident(child) for child in container])

    def test_game_settings_hide_hub_navigation_and_legacy_community_controls(self):
        s=ACTIVITY.read_text()
        self.assertIn("launcherTheme == RankedHeaderView.THEME_HUB",s)
        self.assertIn('boolean destinationsMatch = isRankedHubBuild()',s)
        self.assertIn('boolean backupsMatch = isRankedHubBuild()',s)
        self.assertIn("isCommunityContext()",s)
        self.assertIn("R.id.operatorBackupSection",s)
        self.assertIn("R.id.widgetSection",s)

if __name__=="__main__":
    unittest.main()
