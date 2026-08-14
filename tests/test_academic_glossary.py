import tempfile
import unittest
from pathlib import Path

from paper_translator.academic_glossary import AcademicGlossary


class AcademicGlossaryTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.path = Path(self.temp_dir.name) / "glossary.json"
        self.glossary = AcademicGlossary(path=self.path)

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def test_longer_term_wins_over_overlapping_short_term(self) -> None:
        terms = self.glossary.terms_for_text("We select a grasp point.")
        self.assertIn(("grasp point", "파지 지점"), terms)
        self.assertNotIn(("grasp", "파지"), terms)

    def test_user_override_is_persisted(self) -> None:
        self.glossary.save_term("granular food", "과립형 식품")
        reloaded = AcademicGlossary(path=self.path)
        self.assertIn(
            ("granular food", "과립형 식품"),
            reloaded.terms_for_text("granular food"),
        )
        self.assertTrue(reloaded.is_user_term("granular food"))

    def test_deleting_override_restores_default(self) -> None:
        self.glossary.save_term("granular food", "과립형 식품")
        self.glossary.delete_user_term("granular food")
        self.assertIn(
            ("granular food", "입상 식품"),
            self.glossary.terms_for_text("granular food"),
        )
        self.assertFalse(self.glossary.is_user_term("granular food"))


if __name__ == "__main__":
    unittest.main()
