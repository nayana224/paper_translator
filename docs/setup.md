# 설치 및 초기 설정

이 문서는 Paper Translator server를 처음 준비하는 절차의 기준 문서입니다.
운영 중 재시작과 Tailscale 설정은 [operations.md](operations.md)를 참고하세요.

## 1. 전제 조건

권장 환경:

- Linux server
- Python 3.10 이상
- NVIDIA GPU가 연결된 Ollama host
- Ollama에서 `translategemma:4b` 실행 가능
- remote access가 필요하면 Tailscale

Ollama와 NVIDIA driver 설치 자체는 이 repository의 책임 범위 밖입니다. Ollama 설치는 공식 문서를
따르고, 설치 후 아래 명령이 정상 동작하는지 먼저 확인합니다.

```bash
ollama --version
```

공식 source는 [references.md](references.md)에 정리되어 있습니다.

## 2. 권장 설치

fresh clone에서는 repository root에서 다음 명령을 권장합니다.

```bash
./scripts/check_environment.sh || true
./scripts/setup.sh
```

`setup.sh`가 수행하는 작업:

1. Linux / Python / Ollama 존재 여부 확인
2. `.venv` 생성 또는 재사용
3. 현재 repository를 editable install
4. `translategemma:4b`가 없으면 `ollama pull`
5. 고정된 PDF.js legacy distribution 설치

다음 항목은 자동으로 변경하지 않습니다.

- NVIDIA driver
- CUDA
- Ollama 자체 설치
- Tailscale 자체 설치 또는 로그인
- firewall / router 설정

설치 후:

```bash
source .venv/bin/activate
paper-translator-server
```

## 3. 수동 Python 환경

자동 setup을 사용하지 않는 경우 repository root에서 실행합니다.

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -e .
```

정상 확인:

```bash
command -v paper-translator-server
```

`.venv/bin/paper-translator-server`가 확인되면 package installation이 완료된 상태입니다.

## 4. TranslateGemma

설치:

```bash
ollama pull translategemma:4b
```

확인:

```bash
ollama ls
```

`translategemma:4b`가 목록에 있어야 합니다.

간단한 model 검증:

```bash
ollama run translategemma:4b
```

영어 논문 문장을 넣어 한국어 번역이 반환되는지 확인합니다.

## 5. PDF.js

Paper Translator는 Mozilla 공식 PDF.js release의 고정 버전을 사용자 data directory에 설치합니다.

```bash
paper-translator-install-pdfjs
```

기본 경로:

```text
~/.local/share/paper-translator/pdfjs/5.7.284-legacy
```

repository에는 PDF.js 배포 바이너리를 포함하지 않습니다.

## 6. Server 실행

```bash
paper-translator-server
```

기본 bind:

```text
127.0.0.1:8765
```

정상 예상 로그:

```text
Uvicorn running on http://127.0.0.1:8765
```

health check:

```bash
curl http://127.0.0.1:8765/health
```

정상 응답 예:

```json
{"status":"ok","model":"translategemma:4b"}
```

브라우저에서는 다음 주소를 엽니다.

```text
http://127.0.0.1:8765
```

## 7. 환경변수

기본값을 바꿔야 할 때만 사용합니다.

```bash
export PAPER_TRANSLATOR_HOST=127.0.0.1
export PAPER_TRANSLATOR_PORT=8765
export PAPER_TRANSLATOR_MODEL=translategemma:4b
```

Tailscale Serve를 사용할 때는 `PAPER_TRANSLATOR_HOST=127.0.0.1`을 그대로 유지하는 것을 권장합니다.

## 8. 초기 기능 확인

1. `./scripts/check_environment.sh`의 `[FAIL]` 항목이 없는지 확인합니다.
2. Web UI가 표시되는지 확인합니다.
3. PDF를 drag & drop으로 엽니다.
4. PDF의 영어 한 문장을 선택합니다.
5. Auto translate가 켜져 있으면 번역이 streaming으로 표시되는지 확인합니다.
6. Academic terms가 검출되는지 확인합니다.
7. glossary에서 사용자 용어를 저장한 뒤 같은 구절을 재번역해 용어가 유지되는지 확인합니다.
