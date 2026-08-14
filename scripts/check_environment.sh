#!/usr/bin/env bash
set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODEL_NAME="${PAPER_TRANSLATOR_MODEL:-translategemma:4b}"
FAILED=0

check_ok() {
  printf '[OK] %s\n' "$1"
}

check_fail() {
  printf '[FAIL] %s\n' "$1" >&2
  FAILED=1
}

check_warn() {
  printf '[WARN] %s\n' "$1"
}

echo "Paper Translator environment check"
echo "Repository: ${ROOT_DIR}"
echo

if [[ "$(uname -s)" == "Linux" ]]; then
  check_ok "Linux server environment"
else
  check_fail "Server OS must currently be Linux"
fi

if command -v python3 >/dev/null 2>&1; then
  PYTHON_VERSION="$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:3])))')"
  if python3 -c 'import sys; raise SystemExit(sys.version_info < (3, 10))'; then
    check_ok "Python ${PYTHON_VERSION}"
  else
    check_fail "Python 3.10+ required; found ${PYTHON_VERSION}"
  fi
else
  check_fail "python3 command not found"
fi

if command -v ollama >/dev/null 2>&1; then
  check_ok "Ollama command available"
  if ollama show "${MODEL_NAME}" >/dev/null 2>&1; then
    check_ok "Ollama model available: ${MODEL_NAME}"
  else
    check_fail "Ollama model missing: ${MODEL_NAME}"
  fi
else
  check_fail "Ollama command not found"
fi

if [[ -x "${ROOT_DIR}/.venv/bin/paper-translator-server" ]]; then
  check_ok "Paper Translator virtual environment installed"
else
  check_warn "Project virtual environment is not installed yet; run ./scripts/setup.sh"
fi

PDFJS_DIR="${HOME}/.local/share/paper-translator/pdfjs/5.7.284-legacy"
if [[ -d "${PDFJS_DIR}" ]]; then
  check_ok "PDF.js 5.7.284 legacy installed"
else
  check_fail "PDF.js is missing; run paper-translator-install-pdfjs"
fi

if command -v tailscale >/dev/null 2>&1; then
  check_ok "Tailscale command available (optional remote access)"
else
  check_warn "Tailscale not installed; local browser access still works"
fi

if command -v curl >/dev/null 2>&1; then
  check_ok "curl available for health checks"
else
  check_warn "curl not found; browser access still works"
fi

echo
if [[ "${FAILED}" -eq 0 ]]; then
  echo "Environment check passed."
  exit 0
fi

echo "Environment check failed. Fix the [FAIL] items above." >&2
exit 1
