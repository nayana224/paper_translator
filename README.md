# Paper Translator

연구 논문 PDF를 브라우저에서 읽으면서 선택한 영어 문장을 한국어로 번역하는 private web app입니다.
실제 모델 추론은 server PC의 Ollama/TranslateGemma가 수행하고, Windows/Linux/Android에서는
브라우저만 사용합니다.

## 주요 기능

- PDF.js library를 직접 사용하는 canvas renderer와 selectable text layer
- PDF drag & drop / 파일 선택
- 선택 영역 자동 번역과 직접 영어 입력 번역
- TranslateGemma streaming 응답 표시
- Markdown 렌더링
- Academic glossary와 사용자 용어 override
- 브라우저별 최근 번역 history
- 모바일 responsive UI
- Tailscale Serve를 통한 tailnet 전용 HTTPS 접근

## 지원 구조

- **Server:** Linux, Python 3.10+, Ollama, `translategemma:4b`
- **Client:** Windows / Linux / Android / iOS의 최신 브라우저
- **Remote access:** Tailscale Serve 권장

Windows와 Android에 별도 실행 파일이나 APK를 설치하는 구조가 아닙니다. Server를 한 곳에서 실행하고,
각 client는 같은 web 주소에 접속합니다.

## 빠른 시작

Ollama가 이미 설치되어 있고 `ollama` 명령이 동작하는 Linux server를 기준으로 합니다.

```bash
git clone https://github.com/nayana224/paper_translator.git
cd paper_translator

./scripts/setup.sh
source .venv/bin/activate
paper-translator-server
```

로컬 브라우저에서 다음 주소를 엽니다.

```text
http://127.0.0.1:8765
```

직접 설치하려면 다음 순서를 사용합니다.

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -e .

ollama pull translategemma:4b
paper-translator-install-pdfjs
paper-translator-server
```

환경 확인만 먼저 하려면:

```bash
./scripts/check_environment.sh
```

Tailscale 환경에서는 server를 localhost에 유지하고 Tailscale Serve로 공유합니다.

```bash
tailscale serve --bg 8765
```

상세 설치와 운영 절차는 [docs/setup.md](docs/setup.md)와
[docs/operations.md](docs/operations.md)를 참고하세요.

## 문서

- [설치 및 초기 설정](docs/setup.md)
- [시스템 구조](docs/architecture.md)
- [HTTP API](docs/api.md)
- [운영 및 Tailscale](docs/operations.md)
- [개발 및 검증](docs/development.md)
- [GitHub 저장소 및 release](docs/github.md)
- [공식 참고자료](docs/references.md)
- [보안 정책](SECURITY.md)

## 데이터 저장

- 사용자 glossary: `~/.config/paper-translator/glossary.json`
- PDF 원본: PDF.js 렌더링을 위해 server 메모리에 임시 등록하며 디스크에는 저장하지 않습니다.
- PDF 임시 session: 최대 50 MiB/file, 최근 4개까지만 server memory에 유지합니다.
- 최근 번역 history: 각 브라우저의 `localStorage`
- Ollama model: Ollama의 기본 model storage를 사용합니다.

## 보안

기본 server bind는 `127.0.0.1:8765`입니다. 공개 인터넷에 직접 노출하지 마세요.
원격 접속은 Tailscale Serve처럼 접근 제어가 있는 private network를 권장합니다.

## 범위

이 프로젝트는 개인 연구용 영어 논문 → 한국어 번역에 집중합니다. 설명 생성, RAG, 코드 분석,
공개 인터넷 서비스 운영은 현재 범위에 포함하지 않습니다.

## License

MIT License. 자세한 내용은 [LICENSE](LICENSE)를 참고하세요.
