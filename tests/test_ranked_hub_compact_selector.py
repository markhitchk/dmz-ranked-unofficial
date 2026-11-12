"""Ranked Hub mobile game-selector density and notice visibility regression."""
from pathlib import Path
import re
import unittest

HTML=Path(__file__).resolve().parents[1]/"app/src/main/assets/ranked-hub/index.html"

class RankedHubCompactSelector(unittest.TestCase):
    def test_mobile_selector_is_compact_enough_for_network_notice(self):
        html=HTML.read_text()
        mobile=re.search(r'@media\s*\(max-width:599px\)\s*\{(?P<css>.*?)\n  \}',html,re.S)
        self.assertIsNotNone(mobile,"Create a dedicated narrow-phone CSS rule")
        css=mobile.group("css")
        for token in (".tile {", "height:152px", "min-height:0", ".logo {", "min-height:0",
                      ".logo img {max-height:56px}", ".foot {", ".action {", ".section {"):
            self.assertIn(token,css)
        self.assertIn("HARLEY'S STUDIOS · RANKED NETWORK",html)
        self.assertIn("Independent websites keep separate accounts and standings.",html)
        self.assertIn("DMZRanked.com is a third-party community project.",html)

    def test_phone_landscape_uses_one_row_to_keep_notice_in_view(self):
        html=HTML.read_text()
        landscape=re.search(r'@media\s*\(min-width:600px\)\s*and\s*\(max-height:650px\)\s*\{(?P<css>.*?)\n  \}',html,re.S)
        self.assertIsNotNone(landscape,"Landscape phone requires a compact four-up row")
        self.assertIn("grid-template-columns:repeat(4,minmax(0,1fr))",landscape.group("css"))
        self.assertIn("height:138px",landscape.group("css"))

    def test_tile_logo_and_button_do_not_force_extra_height(self):
        html=HTML.read_text()
        mobile=re.search(r'@media\\s*\\(max-width:599px\\)\\s*\\{(?P<css>.*?)\\n  \\}',html,re.S)
        self.assertIsNotNone(mobile)
        css=mobile.group("css")
        self.assertIn(".logo {flex:0 0 48px",css)
        self.assertIn(".action {",css)
        self.assertIn("min-height:31px",css)
        self.assertIn(".name {",css)
        self.assertIn("max-height:152px",css)

    def test_game_destinations_and_tap_target_remain_readable(self):
        html=HTML.read_text()
        self.assertIn('grid-template-columns:repeat(2,minmax(0,1fr))',html)
        for destination in ("dmz-v1","arc-raiders","community"):
            self.assertIn('rankedhub://open/'+destination,html)
        self.assertIn('OPEN MW4 DMZ ↗',html)
        self.assertIn('OPEN ARC ↗',html)

if __name__=="__main__":
    unittest.main()
