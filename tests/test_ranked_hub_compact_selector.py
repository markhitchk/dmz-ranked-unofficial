"""Ensure full-height game cards preserve footer and all game launches."""
from pathlib import Path
import unittest
import re
HTML=Path(__file__).resolve().parents[1]/"app/src/main/assets/ranked-hub/index.html"

class RankedHubResponsiveSelector(unittest.TestCase):
 def test_mobile_grid_stretches_to_fill_screen(self):
  html=HTML.read_text()
  self.assertIn("/* FULL-VIEWPORT GAME SELECTOR */",html)
  block=html.split("/* FULL-VIEWPORT GAME SELECTOR */",1)[1].split("/* FULL-VIEWPORT LANDSCAPE */",1)[0]
  for token in ("height:100dvh","grid-template-rows:repeat(2,minmax(0,1fr))",
                ".tile {height:auto;max-height:none;min-height:0",
                ".foot {flex:0 0 auto","min-height:42px"):
   self.assertIn(token,block)

 def test_rotated_grid_remains_four_columns(self):
  html=HTML.read_text()
  landscape=html.split("/* FULL-VIEWPORT LANDSCAPE */",1)[1]
  for token in ("height:100dvh",
                "grid-template-columns:repeat(4,minmax(0,1fr))",
                "grid-template-rows:minmax(0,1fr)"):
   self.assertIn(token,landscape)

 def test_game_links_and_footer_copy_preserved(self):
  html=HTML.read_text()
  for text in ("HARLEY'S STUDIOS · RANKED NETWORK",
               "Independent websites keep separate accounts and standings.",
               "DMZRanked.com is a third-party community project.",
               "OPEN MW4 DMZ ↗","OPEN ARC ↗",
               "rankedhub://open/dmz-v1","rankedhub://open/arc-raiders",
               "rankedhub://open/community"):
   self.assertIn(text,html)
  self.assertIn("grid-template-columns:repeat(2,minmax(0,1fr))",html)

if __name__=="__main__": unittest.main()
