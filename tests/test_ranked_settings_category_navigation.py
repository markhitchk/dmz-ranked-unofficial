"""Ranked Hub's Settings screenshot-style category navigation contract."""
from pathlib import Path
import xml.etree.ElementTree as ET
import unittest
BASE=Path(__file__).resolve().parents[1]
JAVA=BASE/"app/src/main/java/com/harleytg/dmzrankedunofficial"
NS="{http://schemas.android.com/apk/res/android}"

class RankedSettingsMenuTests(unittest.TestCase):
    def test_category_overview_exists_before_detail_sections(self):
        tree=ET.parse(BASE/"app/src/main/res/layout/activity_settings.xml").getroot()
        scroll=next(v for v in tree.iter() if v.attrib.get(NS+"id")=="@+id/settingsScroll")
        container=next(iter(scroll))
        ids=[v.attrib.get(NS+"id","") for v in container]
        self.assertIn("@+id/settingsCategoryOverview",ids)
        self.assertLess(ids.index("@+id/settingsCategoryOverview"),ids.index("@+id/aboutCard"))
        self.assertTrue(any(v.attrib.get(NS+"id")=="@+id/settingsIntroDescription" for v in tree.iter()))

    def test_navigator_has_real_subpages_and_screen_reader_friendly_cards(self):
        s=(JAVA/"RankedSettingsNavigator.java").read_text()
        for term in ("Ranked Games & Accounts","Notifications",
                     "Appearance & Performance","Home-screen Widget",
                     "Site Data & Backups","Help & Support","Advanced & About",
                     "settingsCategoryOverview","setOnClickListener","setContentDescription",
                     "minHeight","activeCategory","openCategory","onBack","setBackground",
                     "setVisibility","rankedDestinationsSection","rankedBackupSection",
                     "operatorBackupSection","developerSection","dangerZoneSection"):
            self.assertIn(term,s)

    def test_back_and_search_are_aware_of_subpage_state(self):
        s=(JAVA/"SettingsActivity.java").read_text()
        for term in ("RankedSettingsNavigator", "handleSettingsBack()",
                     "settingsNavigator.apply", "onBackPressed()",
                     "onSaveInstanceState(Bundle", "settingsNavigator.saveState",
                     "settingsNavigator.restoreState"):
            self.assertIn(term,s)

    def test_original_community_settings_are_not_replaced(self):
        s=(JAVA/"SettingsActivity.java").read_text()
        self.assertIn("if (isRankedHubBuild())",s)
        self.assertIn("RankedHeaderView.THEME_COMMUNITY",s)
        self.assertIn("applySearch(",s)
        self.assertIn("isCommunityContext()",s)
        self.assertIn("R.id.siteNotificationsCard",s)

if __name__=="__main__": unittest.main()
