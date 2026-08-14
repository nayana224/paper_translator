from __future__ import annotations

import os

import uvicorn

from paper_translator.ollama_client import DEFAULT_MODEL
from paper_translator.pdfjs_assets import is_pdfjs_ready, pdfjs_install_dir

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8765


def main() -> int:
    pdfjs_root = pdfjs_install_dir()
    if not is_pdfjs_ready(pdfjs_root):
        print("PDF.js가 설치되어 있지 않습니다.")
        print("먼저 `paper-translator-install-pdfjs`를 실행하세요.")
        return 1

    host = os.environ.get("PAPER_TRANSLATOR_HOST", DEFAULT_HOST)
    port = int(os.environ.get("PAPER_TRANSLATOR_PORT", str(DEFAULT_PORT)))
    model = os.environ.get("PAPER_TRANSLATOR_MODEL", DEFAULT_MODEL)

    if host not in {"127.0.0.1", "localhost"}:
        print(
            "WARNING: Paper Translator is binding beyond localhost. "
            "Tailscale Serve를 사용할 때는 127.0.0.1을 유지하는 것을 권장합니다."
        )

    os.environ["PAPER_TRANSLATOR_MODEL"] = model
    uvicorn.run(
        "paper_translator.translation_server:app",
        host=host,
        port=port,
        log_level="info",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
