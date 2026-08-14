import unittest

from paper_translator.selection_text import normalize_selected_text


class SelectionTextTest(unittest.TestCase):
    def test_collapses_whitespace(self) -> None:
        text = "The proposed\n method   estimates mass."
        self.assertEqual(
            normalize_selected_text(text),
            "The proposed method estimates mass.",
        )

    def test_rejoins_line_end_hyphen(self) -> None:
        self.assertEqual(
            normalize_selected_text("neural net-\nwork"),
            "neural network",
        )


if __name__ == "__main__":
    unittest.main()
