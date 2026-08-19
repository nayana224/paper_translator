from pathlib import Path


WEB_ROOT = Path(__file__).resolve().parents[1] / "src" / "paper_translator" / "web"


def test_pdf_markup_uses_canvas_and_text_layer() -> None:
    index_html = (WEB_ROOT / "index.html").read_text(encoding="utf-8")

    assert 'id="pdfCanvas"' in index_html
    assert 'id="pdfTextLayer"' in index_html
    assert 'id="pdfViewport"' in index_html
    assert "<iframe" not in index_html


def test_pdf_renderer_uses_pdfjs_library_without_embedded_viewer() -> None:
    app_js = (WEB_ROOT / "app.js").read_text(encoding="utf-8")

    assert 'from "/pdfjs/build/pdf.mjs"' in app_js
    assert "pdfjsLib.getDocument" in app_js
    assert "new pdfjsLib.TextLayer" in app_js
    assert "viewer.html" not in app_js
    assert "PDFViewerApplication" not in app_js
