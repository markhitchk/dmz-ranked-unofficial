"""Hub Beta Android channels and original client isolation."""
from pathlib import Path
import unittest
R=Path(__file__).resolve().parents[1]
J=R/"app/src/main/java/com/harleytg/dmzrankedunofficial"
def txt(p):return (J/p).read_text()
class HubChannelsTests(unittest.TestCase):
    def test_four_channels(self):
        s=txt("HubNotificationChannels.java")
        for key in ("MW4","ARC","COMMUNITY","APP","ranked_hub_mw4_v1",
                    "ranked_hub_arc_v1","ranked_hub_community_v1","ranked_hub_app_v1"):
            self.assertIn(key,s)
        self.assertIn("getNotificationChannel(id)",s)
        self.assertIn("notifyFirstParty",s)
    def test_existing_community_alerts_routed(self):
        self.assertIn("HubNotificationChannels.notifyCommunity",txt("NotificationSync.java"))
        self.assertIn("HubNotificationChannels.notifyCommunity",txt("MainActivity.java"))
        self.assertIn("HubNotificationChannels.isHub",txt("NotificationSync.java"))
        self.assertIn("HubNotificationChannels.isHub",txt("MainActivity.java"))
    def test_settings_exposes_all_channels(self):
        s=txt("SettingsActivity.java")
        self.assertIn("HubNotificationChannels.notifyApp",s)
        self.assertIn("Settings.ACTION_APP_NOTIFICATION_SETTINGS",s)
        self.assertIn("HubNotificationChannels.ensure(this)",s)
        self.assertIn("HubNotificationChannels.ensure(this)",txt("RankedHubActivity.java"))
if __name__=="__main__":unittest.main()
