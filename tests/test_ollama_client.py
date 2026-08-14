import unittest

from paper_translator.ollama_client import build_translation_prompt


class TranslationPromptTest(unittest.TestCase):
    def test_prompt_contains_text(self) -> None:
        prompt = build_translation_prompt("A grasp point is selected.")
        self.assertIn("A grasp point is selected.", prompt)
        self.assertIn("English (en) to Korean (ko)", prompt)

    def test_prompt_contains_preferred_terms(self) -> None:
        prompt = build_translation_prompt(
            "A grasp point is selected.",
            [("grasp point", "파지 지점")],
        )
        self.assertIn("grasp point => 파지 지점", prompt)

    def test_empty_text_is_rejected(self) -> None:
        with self.assertRaises(ValueError):
            build_translation_prompt("   ")


if __name__ == "__main__":
    unittest.main()
