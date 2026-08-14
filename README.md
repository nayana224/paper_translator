# Paper Translator

연구 논문 PDF를 브라우저에서 읽으면서 선택한 영어 문장을 한국어로 번역하는 private web app입니다.
실제 모델 추론은 연구실 PC의 Ollama/TranslateGemma가 수행하고, Windows/Linux/Android에서는
브라우저만 사용합니다.

## 주요 기능

- PDF.js 기반 PDF viewer와 browser-native text selection
- PDF drag & drop / 파일 선택
- 선택 영역 자동 번역과 직접 영어 입력 번역
- TranslateGemma streaming 응답 표시
- Markdown 렌더링
- Academic glossary와 사용자 용어 override
- 브라우저별 최근 번역 history
- 모바일 responsive UI
- Tailscale Serve를 통한 tailnet 전용 HTTPS 접근

## 요구 환경

- Server: Linux, Python 3.10+, Ollama, `translategemma:4b`
- Client: 최신 Chrome/Firefox/Safari/Edge 계열 브라우저
- Remote access: Tailscale 권장

## 빠른 시작

```bash
git clone <YOUR_REPOSITORY_URL>
cd paper_translator

python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -e .

ollama pull translategemma:4b
paper-translator-install-pdfjs
paper-translator-server
```

로컬 브라우저에서 `http://127.0.0.1:8765`를 엽니다.

Tailscale 환경에서는 서버를 localhost에 유지하고 Tailscale Serve로 공유합니다.

```bash
tailscale serve --bg 8765
```

상세 설치와 운영 절차는 [docs/setup.md](docs/setup.md)를 참고하세요.

## 문서

- [설치 및 초기 설정](docs/setup.md)
- [시스템 구조](docs/architecture.md)
- [HTTP API](docs/api.md)
- [운영 및 Tailscale](docs/operations.md)
- [개발 및 검증](docs/development.md)
- [GitHub 저장소 준비](docs/github.md)
- [공식 참고자료](docs/references.md)
- [보안 정책](SECURITY.md)

## 데이터 저장

- 사용자 glossary: `~/.config/paper-translator/glossary.json`
- PDF 원본: 기본적으로 서버에 업로드하지 않으며 브라우저 메모리에서 PDF.js가 읽습니다.
- 최근 번역 history: 각 브라우저의 `localStorage`
- Ollama model: Ollama의 기본 model storage를 사용합니다.

## 범위

이 프로젝트는 개인 연구용 영어 논문 → 한국어 번역에 집중합니다. 설명 생성, RAG, 코드 분석,
공개 인터넷 서비스 운영은 현재 범위에 포함하지 않습니다.
