import * as pdfjsLib from "/pdfjs/build/pdf.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdfjs/build/pdf.worker.mjs";

const MAX_TRANSLATE_CHARACTERS = 6000;
const MAX_AUTO_TRANSLATE_CHARACTERS = 1500;
const MIN_AUTO_TRANSLATE_CHARACTERS = 8;
const HISTORY_LIMIT = 20;
const MIN_PDF_SCALE = 0.5;
const MAX_PDF_SCALE = 3.5;
const PDF_ZOOM_STEP = 0.15;

const state = {
  currentFile: null,
  pdfSessionId: null,
  pdfLoadingTask: null,
  pdfDocument: null,
  currentPage: 0,
  zoomScale: 1,
  renderTask: null,
  textLayer: null,
  renderSequence: 0,
  openSequence: 0,
  selectionTimer: null,
  activeTranslationController: null,
  translationText: "",
  history: [],
  historyIndex: -1,
  glossary: [],
};

const elements = {
  pdfPanel: document.getElementById("pdfPanel"),
  pdfInput: document.getElementById("pdfInput"),
  pdfViewport: document.getElementById("pdfViewport"),
  pdfPage: document.getElementById("pdfPage"),
  pdfCanvas: document.getElementById("pdfCanvas"),
  pdfTextLayer: document.getElementById("pdfTextLayer"),
  emptyState: document.getElementById("emptyState"),
  documentName: document.getElementById("documentName"),
  openPdfButton: document.getElementById("openPdfButton"),
  previousPageButton: document.getElementById("previousPageButton"),
  nextPageButton: document.getElementById("nextPageButton"),
  pageIndicator: document.getElementById("pageIndicator"),
  zoomOutButton: document.getElementById("zoomOutButton"),
  zoomInButton: document.getElementById("zoomInButton"),
  zoomIndicator: document.getElementById("zoomIndicator"),
  autoTranslateToggle: document.getElementById("autoTranslateToggle"),
  serverStatus: document.getElementById("serverStatus"),
  modelBadge: document.getElementById("modelBadge"),
  translationOutput: document.getElementById("translationOutput"),
  streamStatus: document.getElementById("streamStatus"),
  copyTranslationButton: document.getElementById("copyTranslationButton"),
  termList: document.getElementById("termList"),
  manageGlossaryButton: document.getElementById("manageGlossaryButton"),
  englishInput: document.getElementById("englishInput"),
  characterCount: document.getElementById("characterCount"),
  copyEnglishButton: document.getElementById("copyEnglishButton"),
  translateButton: document.getElementById("translateButton"),
  historyPreviousButton: document.getElementById("historyPreviousButton"),
  historyNextButton: document.getElementById("historyNextButton"),
  historyIndicator: document.getElementById("historyIndicator"),
  glossaryDialog: document.getElementById("glossaryDialog"),
  closeGlossaryButton: document.getElementById("closeGlossaryButton"),
  glossaryEnglishInput: document.getElementById("glossaryEnglishInput"),
  glossaryKoreanInput: document.getElementById("glossaryKoreanInput"),
  saveGlossaryButton: document.getElementById("saveGlossaryButton"),
  deleteGlossaryButton: document.getElementById("deleteGlossaryButton"),
  glossaryTable: document.getElementById("glossaryTable"),
};

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderInlineMarkdown(text) {
  let safe = escapeHtml(text);
  safe = safe.replace(/`([^`]+)`/g, "<code>$1</code>");
  safe = safe.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  safe = safe.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  safe = safe.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");
  return safe;
}

function renderMarkdown(markdown) {
  const lines = markdown.replaceAll("\r\n", "\n").split("\n");
  const output = [];
  let listType = null;

  function closeList() {
    if (listType) {
      output.push(`</${listType}>`);
      listType = null;
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    const unordered = line.match(/^\s*[-*]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);

    if (heading) {
      closeList();
      const level = heading[1].length;
      output.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    if (unordered || ordered) {
      const nextListType = unordered ? "ul" : "ol";
      if (listType !== nextListType) {
        closeList();
        listType = nextListType;
        output.push(`<${listType}>`);
      }
      output.push(`<li>${renderInlineMarkdown((unordered || ordered)[1])}</li>`);
      continue;
    }

    closeList();
    if (line.trim()) {
      output.push(`<p>${renderInlineMarkdown(line)}</p>`);
    }
  }

  closeList();
  return output.join("");
}

function normalizeSelectedText(text) {
  return text
    .replaceAll("\u00ad", "")
    .replace(/-\s*\n\s*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function historyStorageKey() {
  if (!state.currentFile) {
    return "paper-translator-history-v1:manual";
  }
  const file = state.currentFile;
  return `paper-translator-history-v1:${file.name}:${file.size}:${file.lastModified}`;
}

function updateHistoryControls() {
  const count = state.history.length;
  const position = state.historyIndex >= 0 ? state.historyIndex + 1 : 0;
  elements.historyIndicator.textContent = `${position} / ${count}`;
  elements.historyPreviousButton.disabled = state.historyIndex <= 0;
  elements.historyNextButton.disabled =
    state.historyIndex < 0 || state.historyIndex >= count - 1;
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(historyStorageKey());
    const parsed = raw ? JSON.parse(raw) : [];
    state.history = Array.isArray(parsed) ? parsed.slice(-HISTORY_LIMIT) : [];
  } catch {
    state.history = [];
  }
  state.historyIndex = state.history.length ? state.history.length - 1 : -1;
  updateHistoryControls();
}

function saveHistory() {
  localStorage.setItem(historyStorageKey(), JSON.stringify(state.history));
}

function addHistory(sourceText, translatedText) {
  const last = state.history.at(-1);
  if (!last || last.sourceText !== sourceText || last.translatedText !== translatedText) {
    state.history.push({ sourceText, translatedText });
    state.history = state.history.slice(-HISTORY_LIMIT);
  }
  state.historyIndex = state.history.length - 1;
  saveHistory();
  updateHistoryControls();
}

function showHistoryRecord(index) {
  if (index < 0 || index >= state.history.length) {
    return;
  }
  state.historyIndex = index;
  const record = state.history[index];
  elements.englishInput.value = record.sourceText;
  renderTranslation(record.translatedText);
  updateInputState();
  updateHistoryControls();
}

function updateInputState() {
  const length = elements.englishInput.value.length;
  elements.characterCount.textContent = `${length} / ${MAX_TRANSLATE_CHARACTERS}`;
  elements.translateButton.disabled = length === 0 || length > MAX_TRANSLATE_CHARACTERS;
}

function renderTranslation(markdown) {
  state.translationText = markdown;
  if (!markdown.trim()) {
    elements.translationOutput.classList.add("placeholder");
    elements.translationOutput.textContent =
      "PDF에서 문장을 선택하거나 아래 English input에 직접 입력하세요.";
    return;
  }
  elements.translationOutput.classList.remove("placeholder");
  elements.translationOutput.innerHTML = renderMarkdown(markdown);
}

function renderTerms(terms) {
  if (!terms || terms.length === 0) {
    elements.termList.className = "term-list empty-list";
    elements.termList.textContent = "검출된 용어가 없습니다.";
    return;
  }

  elements.termList.className = "term-list";
  elements.termList.replaceChildren(
    ...terms.map((term) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "term-row";
      const english = document.createElement("span");
      english.className = "english-term";
      english.textContent = term.english;
      const korean = document.createElement("span");
      korean.className = "korean-term";
      korean.textContent = term.korean;
      row.append(english, korean);
      row.addEventListener("click", () => openGlossaryDialog(term));
      return row;
    }),
  );
}

async function checkHealth() {
  try {
    const response = await fetch("/health", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    elements.serverStatus.textContent = "Server connected";
    elements.modelBadge.textContent = `Local · ${payload.model}`;
  } catch (error) {
    elements.serverStatus.textContent = `Server unavailable: ${error.message}`;
  }
}

async function translateCurrentInput() {
  const text = elements.englishInput.value.trim();
  if (!text) {
    return;
  }
  if (text.length > MAX_TRANSLATE_CHARACTERS) {
    elements.streamStatus.textContent = "선택한 구절을 6000자 이하로 줄여주세요.";
    return;
  }

  state.activeTranslationController?.abort();
  const controller = new AbortController();
  state.activeTranslationController = controller;
  renderTranslation("");
  renderTerms([]);
  elements.streamStatus.textContent = "Translating...";
  elements.translateButton.disabled = true;

  try {
    const response = await fetch("/api/translate/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });
    if (!response.ok || !response.body) {
      throw new Error((await response.text()) || `HTTP ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let translatedText = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) {
          continue;
        }
        const event = JSON.parse(line);
        if (event.type === "meta") {
          elements.modelBadge.textContent = `Local · ${event.model}`;
          renderTerms(event.terms);
        } else if (event.type === "chunk") {
          translatedText += event.text;
          renderTranslation(translatedText);
          elements.translationOutput.scrollTop = elements.translationOutput.scrollHeight;
        } else if (event.type === "error") {
          throw new Error(event.message);
        }
      }
    }

    translatedText = translatedText.trim();
    if (!translatedText) {
      throw new Error("빈 번역 결과가 반환되었습니다.");
    }
    renderTranslation(translatedText);
    addHistory(text, translatedText);
    elements.streamStatus.textContent = "Translation completed";
  } catch (error) {
    if (error.name !== "AbortError") {
      elements.streamStatus.textContent = `Translation failed: ${error.message}`;
    }
  } finally {
    if (state.activeTranslationController === controller) {
      state.activeTranslationController = null;
    }
    updateInputState();
  }
}

function scheduleSelectedText(text) {
  const normalized = normalizeSelectedText(text);
  if (!normalized) {
    return;
  }

  elements.englishInput.value = normalized.slice(0, MAX_TRANSLATE_CHARACTERS);
  updateInputState();
  elements.streamStatus.textContent = "";

  if (!elements.autoTranslateToggle.checked) {
    return;
  }
  if (
    normalized.length < MIN_AUTO_TRANSLATE_CHARACTERS ||
    normalized.length > MAX_AUTO_TRANSLATE_CHARACTERS
  ) {
    if (normalized.length > MAX_AUTO_TRANSLATE_CHARACTERS) {
      elements.streamStatus.textContent =
        "긴 선택은 자동 번역하지 않습니다. Translate를 누르세요.";
    }
    return;
  }
  void translateCurrentInput();
}

function updateViewerControls() {
  const pages = state.pdfDocument?.numPages ?? 0;
  const page = state.currentPage || 0;
  elements.pageIndicator.textContent = pages ? `Page ${page} / ${pages}` : "Page - / -";
  elements.zoomIndicator.textContent = pages ? `${Math.round(state.zoomScale * 100)}%` : "100%";
  elements.previousPageButton.disabled = !pages || page <= 1;
  elements.nextPageButton.disabled = !pages || page >= pages;
  elements.zoomOutButton.disabled = !pages || state.zoomScale <= MIN_PDF_SCALE;
  elements.zoomInButton.disabled = !pages || state.zoomScale >= MAX_PDF_SCALE;
}

function cancelPageRender() {
  state.renderSequence += 1;
  state.renderTask?.cancel();
  state.renderTask = null;
  state.textLayer?.cancel?.();
  state.textLayer = null;
}

async function closePdfDocument() {
  cancelPageRender();
  if (state.pdfLoadingTask) {
    await state.pdfLoadingTask.destroy().catch(() => {});
  } else if (state.pdfDocument) {
    await state.pdfDocument.destroy().catch(() => {});
  }
  state.pdfLoadingTask = null;
  state.pdfDocument = null;
  state.currentPage = 0;
  state.zoomScale = 1;
  elements.pdfTextLayer.replaceChildren();
  const context = elements.pdfCanvas.getContext("2d");
  context?.clearRect(0, 0, elements.pdfCanvas.width, elements.pdfCanvas.height);
  updateViewerControls();
}

async function deletePdfSession() {
  if (!state.pdfSessionId) {
    return;
  }
  const sessionId = state.pdfSessionId;
  state.pdfSessionId = null;
  try {
    await fetch(`/api/pdf-session/${sessionId}`, { method: "DELETE" });
  } catch {
    // Server가 이미 종료된 경우 cleanup 실패는 무시한다.
  }
}

function computePageWidthScale(page) {
  const baseViewport = page.getViewport({ scale: 1 });
  const availableWidth = Math.max(elements.pdfViewport.clientWidth - 48, 240);
  return Math.min(
    Math.max(availableWidth / baseViewport.width, MIN_PDF_SCALE),
    MAX_PDF_SCALE,
  );
}

async function renderTextLayer(page, viewport, renderSequence) {
  elements.pdfTextLayer.replaceChildren();
  elements.pdfTextLayer.style.width = `${viewport.width}px`;
  elements.pdfTextLayer.style.height = `${viewport.height}px`;
  elements.pdfTextLayer.style.setProperty("--scale-factor", viewport.scale.toString());

  const textContent = await page.getTextContent({ includeMarkedContent: true });
  if (renderSequence !== state.renderSequence) {
    return;
  }

  const textLayer = new pdfjsLib.TextLayer({
    textContentSource: textContent,
    container: elements.pdfTextLayer,
    viewport,
  });
  state.textLayer = textLayer;
  await textLayer.render();

  if (renderSequence === state.renderSequence) {
    state.textLayer = null;
  }
}

async function renderCurrentPage() {
  if (!state.pdfDocument || state.currentPage < 1) {
    return;
  }

  cancelPageRender();
  const renderSequence = state.renderSequence;
  elements.streamStatus.textContent = "PDF page rendering...";

  try {
    const page = await state.pdfDocument.getPage(state.currentPage);
    if (renderSequence !== state.renderSequence) {
      return;
    }

    const viewport = page.getViewport({ scale: state.zoomScale });
    const outputScale = window.devicePixelRatio || 1;
    const canvasContext = elements.pdfCanvas.getContext("2d", { alpha: false });
    if (!canvasContext) {
      throw new Error("Canvas 2D context를 생성하지 못했습니다.");
    }

    elements.pdfPage.style.width = `${viewport.width}px`;
    elements.pdfPage.style.height = `${viewport.height}px`;
    elements.pdfCanvas.width = Math.floor(viewport.width * outputScale);
    elements.pdfCanvas.height = Math.floor(viewport.height * outputScale);
    elements.pdfCanvas.style.width = `${viewport.width}px`;
    elements.pdfCanvas.style.height = `${viewport.height}px`;

    const transform =
      outputScale === 1 ? null : [outputScale, 0, 0, outputScale, 0, 0];
    const renderTask = page.render({
      canvasContext,
      transform,
      viewport,
    });
    state.renderTask = renderTask;
    await renderTask.promise;

    if (renderSequence !== state.renderSequence) {
      return;
    }
    state.renderTask = null;

    try {
      await renderTextLayer(page, viewport, renderSequence);
      if (renderSequence === state.renderSequence) {
        elements.streamStatus.textContent = "";
      }
    } catch (error) {
      if (renderSequence === state.renderSequence) {
        elements.streamStatus.textContent =
          `PDF는 표시됐지만 text selection을 준비하지 못했습니다: ${error.message}`;
      }
    }
    updateViewerControls();
  } catch (error) {
    if (error?.name === "RenderingCancelledException") {
      return;
    }
    if (renderSequence === state.renderSequence) {
      state.renderTask = null;
      elements.streamStatus.textContent = `PDF page render failed: ${error.message}`;
    }
  }
}

async function openPdf(file) {
  if (!file || (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf"))) {
    return;
  }

  const openSequence = state.openSequence + 1;
  state.openSequence = openSequence;
  state.currentFile = file;
  elements.documentName.textContent = file.name;
  elements.streamStatus.textContent = "PDF 여는 중...";
  elements.emptyState.classList.add("is-hidden");
  elements.pdfViewport.classList.remove("is-hidden");
  loadHistory();
  if (state.historyIndex >= 0) {
    showHistoryRecord(state.historyIndex);
  }

  try {
    await closePdfDocument();
    await deletePdfSession();

    const response = await fetch("/api/pdf-session", {
      method: "POST",
      headers: { "Content-Type": "application/pdf" },
      body: file,
    });
    if (!response.ok) {
      throw new Error((await response.text()) || `HTTP ${response.status}`);
    }

    const payload = await response.json();
    if (openSequence !== state.openSequence) {
      await fetch(`/api/pdf-session/${payload.session_id}`, { method: "DELETE" }).catch(() => {});
      return;
    }

    state.pdfSessionId = payload.session_id;
    const loadingTask = pdfjsLib.getDocument({
      url: payload.url,
      cMapUrl: "/pdfjs/cmaps/",
      cMapPacked: true,
      standardFontDataUrl: "/pdfjs/standard_fonts/",
      wasmUrl: "/pdfjs/wasm/",
    });
    state.pdfLoadingTask = loadingTask;
    const pdfDocument = await loadingTask.promise;

    if (openSequence !== state.openSequence) {
      await loadingTask.destroy().catch(() => {});
      return;
    }

    state.pdfDocument = pdfDocument;
    state.currentPage = 1;
    const firstPage = await pdfDocument.getPage(1);
    state.zoomScale = computePageWidthScale(firstPage);
    updateViewerControls();
    elements.pdfViewport.scrollTop = 0;
    await renderCurrentPage();
  } catch (error) {
    if (openSequence !== state.openSequence) {
      return;
    }
    await closePdfDocument();
    elements.pdfViewport.classList.add("is-hidden");
    elements.emptyState.classList.remove("is-hidden");
    elements.streamStatus.textContent = `PDF open failed: ${error.message}`;
  }
}

function changePage(delta) {
  const pages = state.pdfDocument?.numPages ?? 0;
  if (!pages) {
    return;
  }
  const nextPage = Math.min(Math.max(state.currentPage + delta, 1), pages);
  if (nextPage === state.currentPage) {
    return;
  }
  state.currentPage = nextPage;
  elements.pdfViewport.scrollTop = 0;
  updateViewerControls();
  void renderCurrentPage();
}

function changeZoom(delta) {
  if (!state.pdfDocument) {
    return;
  }
  const nextScale = Math.min(
    Math.max(state.zoomScale + delta, MIN_PDF_SCALE),
    MAX_PDF_SCALE,
  );
  if (Math.abs(nextScale - state.zoomScale) < 0.001) {
    return;
  }
  state.zoomScale = nextScale;
  updateViewerControls();
  void renderCurrentPage();
}

function selectedPdfText() {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return "";
  }

  const range = selection.getRangeAt(0);
  const startNode =
    range.startContainer.nodeType === Node.ELEMENT_NODE
      ? range.startContainer
      : range.startContainer.parentElement;
  const endNode =
    range.endContainer.nodeType === Node.ELEMENT_NODE
      ? range.endContainer
      : range.endContainer.parentElement;
  if (
    !startNode ||
    !endNode ||
    !elements.pdfTextLayer.contains(startNode) ||
    !elements.pdfTextLayer.contains(endNode)
  ) {
    return "";
  }
  return selection.toString();
}

function handlePdfSelectionChange() {
  if (state.selectionTimer) {
    clearTimeout(state.selectionTimer);
  }
  state.selectionTimer = setTimeout(() => {
    const text = selectedPdfText();
    if (text) {
      scheduleSelectedText(text);
    }
  }, 180);
}

async function copyText(text) {
  if (text) {
    await navigator.clipboard.writeText(text);
  }
}

async function loadGlossary() {
  const response = await fetch("/api/glossary", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Glossary HTTP ${response.status}`);
  }
  state.glossary = await response.json();
  renderGlossaryTable();
}

function renderGlossaryTable() {
  elements.glossaryTable.replaceChildren(
    ...state.glossary.map((term) => {
      const row = document.createElement("div");
      row.className = "glossary-table-row";
      const english = document.createElement("span");
      english.textContent = term.english;
      const korean = document.createElement("span");
      korean.textContent = term.korean;
      const source = document.createElement("span");
      source.textContent = term.source === "user" ? "User" : "Default";
      source.className = term.source === "user" ? "source-user" : "";
      row.append(english, korean, source);
      row.addEventListener("click", () => {
        elements.glossaryEnglishInput.value = term.english;
        elements.glossaryKoreanInput.value = term.korean;
        elements.deleteGlossaryButton.disabled = term.source !== "user";
      });
      return row;
    }),
  );
}

async function openGlossaryDialog(term = null) {
  try {
    await loadGlossary();
  } catch (error) {
    elements.streamStatus.textContent = `Glossary failed: ${error.message}`;
    return;
  }
  elements.glossaryEnglishInput.value = term?.english ?? "";
  elements.glossaryKoreanInput.value = term?.korean ?? "";
  elements.deleteGlossaryButton.disabled = (term?.source ?? "default") !== "user";
  elements.glossaryDialog.showModal();
}

async function saveGlossaryTerm() {
  const english = elements.glossaryEnglishInput.value.trim();
  const korean = elements.glossaryKoreanInput.value.trim();
  if (!english || !korean) {
    return;
  }
  const response = await fetch("/api/glossary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ english, korean }),
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  state.glossary = await response.json();
  renderGlossaryTable();
  elements.deleteGlossaryButton.disabled = false;
}

async function deleteGlossaryTerm() {
  const english = elements.glossaryEnglishInput.value.trim();
  if (!english) {
    return;
  }
  const response = await fetch("/api/glossary", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ english }),
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  state.glossary = await response.json();
  renderGlossaryTable();
  elements.glossaryEnglishInput.value = "";
  elements.glossaryKoreanInput.value = "";
  elements.deleteGlossaryButton.disabled = true;
}

function bindEvents() {
  elements.openPdfButton.addEventListener("click", () => elements.pdfInput.click());
  elements.pdfInput.addEventListener("change", () => void openPdf(elements.pdfInput.files?.[0]));
  elements.previousPageButton.addEventListener("click", () => changePage(-1));
  elements.nextPageButton.addEventListener("click", () => changePage(1));
  elements.zoomOutButton.addEventListener("click", () => changeZoom(-PDF_ZOOM_STEP));
  elements.zoomInButton.addEventListener("click", () => changeZoom(PDF_ZOOM_STEP));
  elements.translateButton.addEventListener("click", () => void translateCurrentInput());
  elements.englishInput.addEventListener("input", updateInputState);
  elements.englishInput.addEventListener("keydown", (event) => {
    if (event.ctrlKey && event.key === "Enter") {
      event.preventDefault();
      void translateCurrentInput();
    }
  });
  elements.copyTranslationButton.addEventListener("click", () => void copyText(state.translationText));
  elements.copyEnglishButton.addEventListener("click", () => void copyText(elements.englishInput.value));
  elements.historyPreviousButton.addEventListener("click", () => showHistoryRecord(state.historyIndex - 1));
  elements.historyNextButton.addEventListener("click", () => showHistoryRecord(state.historyIndex + 1));
  elements.manageGlossaryButton.addEventListener("click", () => void openGlossaryDialog());
  elements.closeGlossaryButton.addEventListener("click", () => elements.glossaryDialog.close());
  elements.saveGlossaryButton.addEventListener("click", () => {
    void saveGlossaryTerm().catch((error) => {
      elements.streamStatus.textContent = `Glossary save failed: ${error.message}`;
    });
  });
  elements.deleteGlossaryButton.addEventListener("click", () => {
    void deleteGlossaryTerm().catch((error) => {
      elements.streamStatus.textContent = `Glossary delete failed: ${error.message}`;
    });
  });

  for (const eventName of ["dragenter", "dragover"]) {
    elements.pdfPanel.addEventListener(eventName, (event) => {
      event.preventDefault();
      elements.pdfPanel.classList.add("is-dragging");
    });
  }
  for (const eventName of ["dragleave", "drop"]) {
    elements.pdfPanel.addEventListener(eventName, (event) => {
      event.preventDefault();
      elements.pdfPanel.classList.remove("is-dragging");
    });
  }
  elements.pdfPanel.addEventListener("drop", (event) => {
    const file = [...event.dataTransfer.files].find(
      (candidate) =>
        candidate.type === "application/pdf" || candidate.name.toLowerCase().endsWith(".pdf"),
    );
    if (file) {
      void openPdf(file);
    }
  });

  document.addEventListener("selectionchange", handlePdfSelectionChange);
  window.addEventListener("pagehide", () => {
    if (state.pdfSessionId) {
      void fetch(`/api/pdf-session/${state.pdfSessionId}`, {
        method: "DELETE",
        keepalive: true,
      }).catch(() => {});
    }
  });
}

bindEvents();
updateInputState();
updateViewerControls();
loadHistory();
void checkHealth();
