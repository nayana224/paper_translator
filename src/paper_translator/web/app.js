const MAX_TRANSLATE_CHARACTERS = 6000;
const MAX_AUTO_TRANSLATE_CHARACTERS = 1500;
const MIN_AUTO_TRANSLATE_CHARACTERS = 8;
const HISTORY_LIMIT = 20;
const PDF_VIEWER_CSS = `
  #toolbarContainer,
  #sidebarContainer,
  #secondaryToolbar,
  #findbar,
  #editorUndoBar {
    display: none !important;
  }
  #mainContainer {
    inset-inline-start: 0 !important;
  }
  #viewerContainer {
    inset: 0 !important;
    background: #eef0f5 !important;
  }
  .pdfViewer .page {
    box-shadow: 0 2px 14px rgba(28, 34, 52, 0.10) !important;
    border: 0 !important;
    margin: 14px auto !important;
  }
  ::selection {
    background: rgba(79, 70, 229, 0.32) !important;
  }
`;

const state = {
  currentFile: null,
  selectionTimer: null,
  activeTranslationController: null,
  translationText: "",
  history: [],
  historyIndex: -1,
  glossary: [],
  viewerReady: false,
  viewerListenersBound: false,
  viewerSelectionBound: false,
};

const elements = {
  pdfPanel: document.getElementById("pdfPanel"),
  pdfInput: document.getElementById("pdfInput"),
  pdfFrame: document.getElementById("pdfFrame"),
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
      const content = unordered ? unordered[1] : ordered[1];
      output.push(`<li>${renderInlineMarkdown(content)}</li>`);
      continue;
    }

    closeList();
    if (!line.trim()) {
      continue;
    }
    output.push(`<p>${renderInlineMarkdown(line)}</p>`);
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

function loadHistory() {
  try {
    const value = localStorage.getItem(historyStorageKey());
    const parsed = value ? JSON.parse(value) : [];
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
  const record = { sourceText, translatedText };
  const last = state.history.at(-1);
  if (!last || last.sourceText !== sourceText || last.translatedText !== translatedText) {
    state.history.push(record);
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
  state.translationText = record.translatedText;
  renderTranslation(record.translatedText);
  updateInputState();
  updateHistoryControls();
}

function updateHistoryControls() {
  const count = state.history.length;
  const position = state.historyIndex >= 0 ? state.historyIndex + 1 : 0;
  elements.historyIndicator.textContent = `${position} / ${count}`;
  elements.historyPreviousButton.disabled = state.historyIndex <= 0;
  elements.historyNextButton.disabled = state.historyIndex < 0 || state.historyIndex >= count - 1;
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

  if (state.activeTranslationController) {
    state.activeTranslationController.abort();
  }
  const controller = new AbortController();
  state.activeTranslationController = controller;

  state.translationText = "";
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
      const detail = await response.text();
      throw new Error(detail || `HTTP ${response.status}`);
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
    elements.streamStatus.textContent =
      normalized.length > MAX_AUTO_TRANSLATE_CHARACTERS
        ? "긴 선택은 자동 번역하지 않습니다. Translate를 누르세요."
        : "";
    return;
  }
  void translateCurrentInput();
}

function bindPdfSelection() {
  if (state.viewerSelectionBound) {
    return;
  }
  const frameDocument = elements.pdfFrame.contentDocument;
  const frameWindow = elements.pdfFrame.contentWindow;
  if (!frameDocument || !frameWindow) {
    return;
  }
  state.viewerSelectionBound = true;

  frameDocument.addEventListener("selectionchange", () => {
    if (state.selectionTimer) {
      clearTimeout(state.selectionTimer);
    }
    state.selectionTimer = setTimeout(() => {
      scheduleSelectedText(frameWindow.getSelection()?.toString() ?? "");
    }, 180);
  });
}

function injectViewerStyle() {
  const frameDocument = elements.pdfFrame.contentDocument;
  if (!frameDocument || frameDocument.getElementById("paper-translator-style")) {
    return;
  }
  const style = frameDocument.createElement("style");
  style.id = "paper-translator-style";
  style.textContent = PDF_VIEWER_CSS;
  frameDocument.head.appendChild(style);
}

async function waitForPdfApplication() {
  const frameWindow = elements.pdfFrame.contentWindow;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const app = frameWindow?.PDFViewerApplication;
    if (app?.initialized) {
      return app;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("PDF.js viewer initialization timed out.");
}

function bindViewerEvents(app) {
  if (state.viewerListenersBound) {
    return;
  }
  state.viewerListenersBound = true;
  app.eventBus.on("pagechanging", () => updateViewerStatus(app));
  app.eventBus.on("scalechanging", () => updateViewerStatus(app));
}

function updateViewerStatus(app) {
  const page = app.page || 0;
  const pages = app.pagesCount || app.pdfDocument?.numPages || 0;
  elements.pageIndicator.textContent = `Page ${page || "-"} / ${pages || "-"}`;

  const scale = app.pdfViewer?.currentScale;
  if (typeof scale === "number" && Number.isFinite(scale)) {
    elements.zoomIndicator.textContent = `${Math.round(scale * 100)}%`;
  }
}

async function openPdf(file) {
  if (!file || (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf"))) {
    return;
  }

  state.currentFile = file;
  state.viewerReady = false;
  elements.documentName.textContent = file.name;
  elements.emptyState.classList.add("is-hidden");
  elements.pdfFrame.classList.remove("is-hidden");
  loadHistory();
  if (state.historyIndex >= 0) {
    showHistoryRecord(state.historyIndex);
  }

  try {
    const app = await waitForPdfApplication();
    const data = new Uint8Array(await file.arrayBuffer());
    if (app.pdfDocument) {
      await app.close();
    }
    await app.open({ data });
    app.pdfViewer.currentScaleValue = "page-width";
    injectViewerStyle();
    bindPdfSelection();
    bindViewerEvents(app);
    state.viewerReady = true;
    updateViewerStatus(app);
  } catch (error) {
    elements.streamStatus.textContent = `PDF open failed: ${error.message}`;
  }
}

async function currentPdfApplication() {
  if (!state.viewerReady) {
    return null;
  }
  return elements.pdfFrame.contentWindow?.PDFViewerApplication ?? null;
}

async function changePage(delta) {
  const app = await currentPdfApplication();
  if (!app?.pdfDocument) {
    return;
  }
  const nextPage = Math.min(Math.max(app.page + delta, 1), app.pagesCount);
  app.page = nextPage;
}

async function changeZoom(delta) {
  const app = await currentPdfApplication();
  if (!app?.pdfViewer) {
    return;
  }
  const current = app.pdfViewer.currentScale || 1;
  const next = Math.min(Math.max(current + delta, 0.5), 3.5);
  app.pdfViewer.currentScaleValue = next.toFixed(2);
}

async function copyText(text) {
  if (!text) {
    return;
  }
  await navigator.clipboard.writeText(text);
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
  const source = term?.source ?? "default";
  elements.deleteGlossaryButton.disabled = source !== "user";
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
  elements.previousPageButton.addEventListener("click", () => void changePage(-1));
  elements.nextPageButton.addEventListener("click", () => void changePage(1));
  elements.zoomOutButton.addEventListener("click", () => void changeZoom(-0.15));
  elements.zoomInButton.addEventListener("click", () => void changeZoom(0.15));
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

  elements.pdfFrame.addEventListener("load", () => {
    state.viewerListenersBound = false;
    state.viewerSelectionBound = false;
    injectViewerStyle();
    bindPdfSelection();
  });
}

bindEvents();
updateInputState();
loadHistory();
void checkHealth();
