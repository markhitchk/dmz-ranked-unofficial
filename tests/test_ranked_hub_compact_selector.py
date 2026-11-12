"""Ranked Hub viewport-filling game grid, including footer and rotation handling."""
from pathlib import Path
import re
import unittest

HTML=Path(__file__).resolve().parents[1]/"app/src/main/assets/ranked-hub/index.html"

class RankedHubFullScreenSelector(unittest.TestCase):
    def test_portrait_uses_remaining_viewport_instead_of_fixed_cards(self):
        html=HTML.read_text()
        portrait=re.search(
            r'/\* FULL-VIEWPORT GAME SELECTOR \*/\s*@media\s*\(max-width:599px\)\s*\{(?P<css>.*?)\n  \}',
            html,re.S)
        self.assertIsNotNone(portrait,"Required full-viewport phone layout is missing")
        css=portrait.group("css")
        for token in (
            ".wrap {display:flex;flex-direction:column",
            "height:100dvh",
            ".grid {flex:1 1 auto",
            "grid-template-rows:repeat(2,minmax(0,1fr))",
            ".tile {height:auto;max-height:none;min-height:0",
            ".logo {flex:1 1 auto",
            ".foot {flex:0 0 auto",
        ):
            self.assertIn(token,css)

    def test_rotated_phone_still_keeps_network_notice_on_screen(self):
        html=HTML.read_text()
        landscape=re.search(
            r'/\* FULL-VIEWPORT LANDSCAPE \*/\s*@media\s*\(min-width:600px\)\s*and\s*\(max-height:650px\)\s*\{(?P<css>.*?)\n  \}',
            html,re.S)
        self.assertIsNotNone(landscape)
        css=landscape.group("css")
        for token in ("height:100dvh",
                      "grid-template-columns:repeat(4,minmax(0,1fr))",
                      "grid-template-rows:minmax(0,1fr)",
                      ".tile {height:auto;max-height:none;min-height:0",
                      ".foot {flex:0 0 auto"):
            self.assertIn(token,css)

    def test_preserves_branding_text_all_game_links_and_accessible_actions(self):
        html=HTML.read_text()
        for phrase in (
            "HARLEY'S STUDIOS · RANKED NETWORK",
            "Independent websites keep separate accounts and standings.",
            "DMZRanked.com is a third-party community project.",
            "OPEN MW4 DMZ ↗",
            "OPEN ARC ↗",
            'rankedhub://open/dmz-v1',
            'rankedhub://open/arc-raiders',
            'rankedhub://open/community',
        ):
            self.assertIn(phrase,html)
        self.assertIn('grid-template-columns:repeat(2,minmax(0,1fr))',html)

if __name__ == "__main__":
    unittest.main()
