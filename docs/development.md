# 개발 및 검증

이 문서는 Paper Translator code를 변경할 때 사용하는 개발 절차의 기준 문서입니다.

프로젝트 변경은 `nayana224/my_instruction`의 최신 `AGENTS.md`와 필요한 관련 guide를 우선합니다.

## 개발 환경

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -e ".[test]"
```

## Test

repository root에서 실행합니다.

```bash
python -m unittest discover -s tests -v
python -m compileall -q src tests
```

Web UI 변경은 browser에서 최소 다음을 확인합니다.

1. desktop width와 mobile width에서 layout이 깨지지 않는지
2. PDF drag & drop과 file chooser가 모두 동작하는지
3. browser-native selection이 유지되는지
4. Auto translate가 짧은 selection에만 자동으로 실행되는지
5. streaming translation이 중간부터 화면에 표시되는지
6. Markdown이 raw marker가 아니라 렌더링되는지
7. glossary 추가/수정/삭제가 다음 번역에 반영되는지

## 코드 책임

- `ollama_client.py`: Ollama protocol과 prompt
- `academic_glossary.py`: glossary persistence와 term matching
- `translation_server.py`: HTTP boundary와 static asset routing
- `pdfjs_assets.py`: 고정 PDF.js release 설치
- `web/`: browser UI와 PDF interaction

외부 API/파일 입력은 boundary에서 검증하고 내부 코드에 동일한 방어 로직을 반복하지 않습니다.

## 성능 변경

Server 언어를 바꾸거나 async framework를 추가하기 전에 실제 병목을 측정합니다.

현재 translation path:

```text
Browser → FastAPI → Ollama → GPU inference → FastAPI stream → Browser
```

우선 측정 대상:

- request 시작 → 첫 translation chunk 시간
- model 전체 generation 시간
- server CPU usage
- network RTT

model generation이 대부분을 차지한다면 server language 변경은 보류합니다.

## Commit

한 logical change 단위로 commit합니다.

```text
<type>: <한글 요약>
```

예:

```text
feat: 웹 PDF 번역 화면 추가
fix: 긴 선택 자동 번역 제한 수정
docs: Tailscale 운영 절차 정리
```
