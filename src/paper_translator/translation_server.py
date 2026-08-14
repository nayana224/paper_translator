from __future__ import annotations

import json
import os
from collections.abc import Iterator
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from paper_translator.academic_glossary import AcademicGlossary
from paper_translator.ollama_client import DEFAULT_MODEL, OllamaClient
from paper_translator.pdfjs_assets import is_pdfjs_ready, pdfjs_install_dir

MAX_TRANSLATE_CHARACTERS = 6000
MAX_TERM_CHARACTERS = 200


class TranslationRequest(BaseModel):
    text: str = Field(min_length=1, max_length=MAX_TRANSLATE_CHARACTERS)


class AcademicTermResponse(BaseModel):
    english: str
    korean: str
    source: str


class TranslationResponse(BaseModel):
    translation: str
    model: str
    terms: list[AcademicTermResponse]


class GlossaryUpdateRequest(BaseModel):
    english: str = Field(min_length=1, max_length=MAX_TERM_CHARACTERS)
    korean: str = Field(min_length=1, max_length=MAX_TERM_CHARACTERS)


class GlossaryDeleteRequest(BaseModel):
    english: str = Field(min_length=1, max_length=MAX_TERM_CHARACTERS)


class HealthResponse(BaseModel):
    status: str
    model: str


def _web_root() -> Path:
    return Path(__file__).resolve().parent / "web"


def _term_responses(
    glossary: AcademicGlossary,
    text: str,
) -> list[AcademicTermResponse]:
    return [
        AcademicTermResponse(
            english=english,
            korean=korean,
            source="user" if glossary.is_user_term(english) else "default",
        )
        for english, korean in glossary.terms_for_text(text)
    ]


def create_app(
    model: str = DEFAULT_MODEL,
    glossary: AcademicGlossary | None = None,
    ollama_client: OllamaClient | None = None,
    pdfjs_root: Path | None = None,
) -> FastAPI:
    """웹 UI와 Ollama 번역 API를 하나의 localhost 서비스로 제공한다."""
    app = FastAPI(
        title="Paper Translator",
        version="1.0.0",
        docs_url="/api/docs",
        redoc_url=None,
    )
    app.state.glossary = glossary or AcademicGlossary()
    app.state.ollama_client = ollama_client or OllamaClient(model=model)

    web_root = _web_root()
    app.mount("/assets", StaticFiles(directory=web_root), name="assets")

    selected_pdfjs_root = pdfjs_root or pdfjs_install_dir()
    if is_pdfjs_ready(selected_pdfjs_root):
        app.mount(
            "/pdfjs",
            StaticFiles(directory=selected_pdfjs_root),
            name="pdfjs",
        )

    @app.get("/", include_in_schema=False)
    def index() -> FileResponse:
        return FileResponse(web_root / "index.html")

    @app.get("/health", response_model=HealthResponse)
    def health() -> HealthResponse:
        client: OllamaClient = app.state.ollama_client
        return HealthResponse(status="ok", model=client.model)

    @app.get("/api/glossary", response_model=list[AcademicTermResponse])
    def list_glossary() -> list[AcademicTermResponse]:
        current_glossary: AcademicGlossary = app.state.glossary
        return [
            AcademicTermResponse(english=english, korean=korean, source=source)
            for english, korean, source in current_glossary.all_terms_with_source()
        ]

    @app.post("/api/glossary", response_model=list[AcademicTermResponse])
    def save_glossary_term(payload: GlossaryUpdateRequest) -> list[AcademicTermResponse]:
        current_glossary: AcademicGlossary = app.state.glossary
        try:
            current_glossary.save_term(payload.english, payload.korean)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return list_glossary()

    @app.delete("/api/glossary", response_model=list[AcademicTermResponse])
    def delete_glossary_term(payload: GlossaryDeleteRequest) -> list[AcademicTermResponse]:
        current_glossary: AcademicGlossary = app.state.glossary
        try:
            current_glossary.delete_user_term(payload.english)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return list_glossary()

    @app.post("/api/translate", response_model=TranslationResponse)
    def translate(payload: TranslationRequest) -> TranslationResponse:
        client: OllamaClient = app.state.ollama_client
        current_glossary: AcademicGlossary = app.state.glossary
        preferred_terms = current_glossary.terms_for_text(payload.text)
        try:
            translation = client.translate_english_to_korean(
                payload.text,
                preferred_terms,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except RuntimeError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc

        return TranslationResponse(
            translation=translation,
            model=client.model,
            terms=_term_responses(current_glossary, payload.text),
        )

    @app.post("/api/translate/stream")
    def translate_stream(payload: TranslationRequest) -> StreamingResponse:
        client: OllamaClient = app.state.ollama_client
        current_glossary: AcademicGlossary = app.state.glossary
        preferred_terms = current_glossary.terms_for_text(payload.text)
        terms = _term_responses(current_glossary, payload.text)

        def stream_events() -> Iterator[bytes]:
            metadata = {
                "type": "meta",
                "model": client.model,
                "terms": [term.model_dump() for term in terms],
            }
            yield (json.dumps(metadata, ensure_ascii=False) + "\n").encode("utf-8")
            try:
                for chunk in client.stream_english_to_korean(
                    payload.text,
                    preferred_terms,
                ):
                    event = {"type": "chunk", "text": chunk}
                    yield (json.dumps(event, ensure_ascii=False) + "\n").encode("utf-8")
            except (ValueError, RuntimeError) as exc:
                event = {"type": "error", "message": str(exc)}
                yield (json.dumps(event, ensure_ascii=False) + "\n").encode("utf-8")
                return
            yield b'{"type":"done"}\n'

        return StreamingResponse(
            stream_events(),
            media_type="application/x-ndjson; charset=utf-8",
            headers={"Cache-Control": "no-store"},
        )

    return app


app = create_app(model=os.environ.get("PAPER_TRANSLATOR_MODEL", DEFAULT_MODEL))
