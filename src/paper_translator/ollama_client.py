from __future__ import annotations

import json
from collections.abc import Iterator
from urllib import error, request

DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434"
DEFAULT_MODEL = "translategemma:4b"


def build_translation_prompt(
    text: str,
    preferred_terms: list[tuple[str, str]] | None = None,
) -> str:
    """TranslateGemma English→Korean 요청과 사용자 선호 용어를 만든다."""
    stripped_text = text.strip()
    if not stripped_text:
        raise ValueError("번역할 텍스트가 비어 있습니다.")

    terminology = ""
    if preferred_terms:
        term_lines = "\n".join(
            f"- {english} => {korean}" for english, korean in preferred_terms
        )
        terminology = (
            "\nUse the following preferred academic terminology whenever the corresponding "
            "English term appears. Keep the terminology consistent:\n"
            f"{term_lines}\n"
        )

    return (
        "You are a professional English (en) to Korean (ko) academic translator. "
        "Accurately convey the meaning and nuances of the original English text while "
        "using precise Korean academic terminology.\n"
        "Do not summarize, omit, explain, or add information. "
        "Preserve equations, symbols, citations, identifiers, and Markdown structure. "
        "Produce only the Korean translation."
        f"{terminology}\n"
        "Please translate the following English text into Korean:\n\n"
        f"{stripped_text}"
    )


class OllamaClient:
    """localhost Ollama API를 통해 논문 번역을 요청한다."""

    def __init__(
        self,
        model: str = DEFAULT_MODEL,
        base_url: str = DEFAULT_OLLAMA_URL,
        timeout_seconds: float = 180.0,
    ) -> None:
        self.model = model
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds

    def translate_english_to_korean(
        self,
        text: str,
        preferred_terms: list[tuple[str, str]] | None = None,
    ) -> str:
        prompt = build_translation_prompt(text, preferred_terms)
        chunks = self.stream_translation_prompt(prompt)
        translation = "".join(chunks).strip()
        if not translation:
            raise RuntimeError("Ollama가 빈 번역 결과를 반환했습니다.")
        return translation

    def stream_english_to_korean(
        self,
        text: str,
        preferred_terms: list[tuple[str, str]] | None = None,
    ) -> Iterator[str]:
        prompt = build_translation_prompt(text, preferred_terms)
        yield from self.stream_translation_prompt(prompt)

    def stream_translation_prompt(self, prompt: str) -> Iterator[str]:
        payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "stream": True,
            "keep_alive": "10m",
        }
        encoded_payload = json.dumps(payload).encode("utf-8")
        http_request = request.Request(
            f"{self.base_url}/api/chat",
            data=encoded_payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        try:
            response = request.urlopen(http_request, timeout=self.timeout_seconds)
        except error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"Ollama HTTP 오류 {exc.code}: {detail}") from exc
        except error.URLError as exc:
            raise RuntimeError(
                "Ollama에 연결할 수 없습니다. `ollama serve` 상태와 "
                "127.0.0.1:11434를 확인하세요."
            ) from exc

        with response:
            for raw_line in response:
                line = raw_line.decode("utf-8").strip()
                if not line:
                    continue
                try:
                    payload_line = json.loads(line)
                except json.JSONDecodeError as exc:
                    raise RuntimeError("Ollama streaming 응답이 올바른 JSON이 아닙니다.") from exc

                if payload_line.get("error"):
                    raise RuntimeError(f"Ollama 오류: {payload_line['error']}")

                message = payload_line.get("message")
                if isinstance(message, dict):
                    content = message.get("content")
                    if isinstance(content, str) and content:
                        yield content
