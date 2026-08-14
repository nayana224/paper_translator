from __future__ import annotations

import os
import shutil
import tempfile
import urllib.request
import zipfile
from pathlib import Path

PDFJS_VERSION = "5.7.284"
PDFJS_VARIANT = "legacy"
PDFJS_RELEASE_URL = (
    "https://github.com/mozilla/pdf.js/releases/download/"
    f"v{PDFJS_VERSION}/pdfjs-{PDFJS_VERSION}-legacy-dist.zip"
)


def pdfjs_install_dir() -> Path:
    """현재 사용자 계정에서 사용하는 PDF.js 설치 경로를 반환한다."""
    data_home = os.environ.get("XDG_DATA_HOME")
    base_dir = Path(data_home).expanduser() if data_home else Path.home() / ".local/share"
    return base_dir / "paper-translator" / "pdfjs" / f"{PDFJS_VERSION}-{PDFJS_VARIANT}"


def is_pdfjs_ready(root: Path | None = None) -> bool:
    candidate = root or pdfjs_install_dir()
    required_files = (
        candidate / "web/viewer.html",
        candidate / "web/viewer.mjs",
        candidate / "build/pdf.mjs",
        candidate / "build/pdf.worker.mjs",
    )
    return all(path.is_file() for path in required_files)


def install_pdfjs() -> Path:
    """Mozilla 공식 release에서 고정된 PDF.js 배포판을 설치한다."""
    destination = pdfjs_install_dir()
    if is_pdfjs_ready(destination):
        return destination

    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="paper-translator-pdfjs-") as temp_dir_text:
        temp_dir = Path(temp_dir_text)
        archive_path = temp_dir / "pdfjs-dist.zip"
        http_request = urllib.request.Request(
            PDFJS_RELEASE_URL,
            headers={"User-Agent": "paper-translator"},
        )
        with urllib.request.urlopen(http_request, timeout=120) as response:
            archive_path.write_bytes(response.read())

        extract_dir = temp_dir / "extract"
        with zipfile.ZipFile(archive_path) as archive:
            archive.extractall(extract_dir)

        if not is_pdfjs_ready(extract_dir):
            raise RuntimeError("다운로드한 PDF.js 배포판에서 필수 파일을 찾지 못했습니다.")

        if destination.exists():
            shutil.rmtree(destination)
        shutil.copytree(extract_dir, destination)

    return destination


def main() -> int:
    print(
        f"Installing PDF.js v{PDFJS_VERSION} ({PDFJS_VARIANT}) "
        "from Mozilla official release..."
    )
    try:
        destination = install_pdfjs()
    except Exception as exc:
        print(f"PDF.js installation failed: {exc}")
        return 1

    print(f"PDF.js v{PDFJS_VERSION} ({PDFJS_VARIANT}) is ready: {destination}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
