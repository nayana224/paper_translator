#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV_DIR="${ROOT_DIR}/.venv"
MODEL_NAME="${PAPER_TRANSLATOR_MODEL:-translategemma:4b}"

cd "${ROOT_DIR}"

if [[ "$(uname -s)" != "Linux" ]]; then
  echo "[ERROR] This setup script currently supports Linux server environments only." >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "[ERROR] python3 is required." >&2
  exit 1
fi

if ! command -v ollama >/dev/null 2>&1; then
  echo "[ERROR] Ollama is not installed or not available in PATH." >&2
  echo "        See docs/setup.md and docs/references.md." >&2
  exit 1
fi

if [[ ! -d "${VENV_DIR}" ]]; then
  echo "[1/4] Creating Python virtual environment..."
  python3 -m venv "${VENV_DIR}"
else
  echo "[1/4] Reusing existing Python virtual environment."
fi

# shellcheck disable=SC1091
source "${VENV_DIR}/bin/activate"

echo "[2/4] Installing Paper Translator..."
python -m pip install --upgrade pip
python -m pip install -e .

if ollama show "${MODEL_NAME}" >/dev/null 2>&1; then
  echo "[3/4] Ollama model already available: ${MODEL_NAME}"
else
  echo "[3/4] Pulling Ollama model: ${MODEL_NAME}"
  ollama pull "${MODEL_NAME}"
fi

echo "[4/4] Installing the pinned PDF.js distribution..."
paper-translator-install-pdfjs

echo
echo "Setup completed."
echo "Run:"
echo "  source .venv/bin/activate"
echo "  paper-translator-server"
echo
echo "Then open http://127.0.0.1:8765 in a browser."
