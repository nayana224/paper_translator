import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

from paper_translator.academic_glossary import AcademicGlossary
from paper_translator.translation_server import create_app


class FakeOllamaClient:
    model = "fake-model"

    def translate_english_to_korean(self, text, preferred_terms=None):  # noqa: ANN001
        return "번역 결과"

    def stream_english_to_korean(self, text, preferred_terms=None):  # noqa: ANN001
        yield "번역 "
        yield "결과"


class TranslationServerTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        glossary = AcademicGlossary(Path(self.temp_dir.name) / "glossary.json")
        app = create_app(glossary=glossary, ollama_client=FakeOllamaClient())
        self.client = TestClient(app)

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def test_health(self) -> None:
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["model"], "fake-model")

    def test_translate_returns_terms(self) -> None:
        response = self.client.post(
            "/api/translate",
            json={"text": "Select a grasp point."},
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["translation"], "번역 결과")
        self.assertEqual(payload["terms"][0]["english"], "grasp point")

    def test_stream_returns_ndjson_events(self) -> None:
        with self.client.stream(
            "POST",
            "/api/translate/stream",
            json={"text": "Select a grasp point."},
        ) as response:
            body = "".join(response.iter_text())
        self.assertIn('"type": "meta"', body)
        self.assertIn('"type": "chunk"', body)
        self.assertIn('"type":"done"', body)

    def test_glossary_update_and_delete(self) -> None:
        update = self.client.post(
            "/api/glossary",
            json={"english": "granular food", "korean": "과립형 식품"},
        )
        self.assertEqual(update.status_code, 200)
        user_rows = [row for row in update.json() if row["source"] == "user"]
        self.assertTrue(any(row["english"] == "granular food" for row in user_rows))

        delete = self.client.request(
            "DELETE",
            "/api/glossary",
            json={"english": "granular food"},
        )
        self.assertEqual(delete.status_code, 200)
        restored = [
            row
            for row in delete.json()
            if row["english"] == "granular food"
        ][0]
        self.assertEqual(restored["source"], "default")
        self.assertEqual(restored["korean"], "입상 식품")


if __name__ == "__main__":
    unittest.main()
