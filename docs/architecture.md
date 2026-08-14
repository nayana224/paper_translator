# 시스템 구조

이 문서는 Paper Translator의 설계와 책임 경계를 설명하는 기준 문서입니다.

## 전체 구조

```text
Windows / Linux / Android browser
              │
              │ HTTPS (Tailscale Serve)
              ▼
      Paper Translator Web
      127.0.0.1:8765
        │           │
        │           ├─ Web UI / PDF.js assets
        │           ├─ PDF memory session
        │           ├─ Academic glossary
        │           └─ Translation API
        │
        ▼
      Ollama
  127.0.0.1:11434
        │
        ▼
  translategemma:4b
        │
        ▼
       GPU
```

## Browser 책임

Browser는 다음을 담당합니다.

- 사용자 장치의 PDF 파일 선택
- PDF.js viewer 표시
- text selection
- 직접 영어 입력
- streaming translation 표시
- Markdown 렌더링
- 최근 번역 history의 `localStorage` 저장

PDF를 열 때 browser는 원본 binary를 Paper Translator server의 임시 PDF session으로 한 번 전송합니다.
PDF.js는 같은-origin HTTP URL을 통해 해당 session을 읽습니다. 이 구조는 browser별 Blob URL과 iframe
초기화 차이를 피하기 위한 것입니다.

## Server 책임

FastAPI server는 다음을 담당합니다.

- Web UI와 PDF.js static asset 제공
- PDF binary를 memory-only session으로 임시 제공
- HTTP input validation
- Academic glossary 중앙 관리
- TranslateGemma prompt 구성
- Ollama localhost API 호출
- streaming translation 중계

PDF session은 디스크에 기록하지 않습니다. 한 파일은 최대 50 MiB이며 최근 4개 session만 memory에
유지합니다. 새 PDF를 열면 browser는 이전 session 삭제를 요청합니다.

Ollama의 API와 model 이름을 browser에 직접 노출할 필요가 없도록 server boundary를 유지합니다.

## Ollama 책임

Ollama는 model lifecycle과 GPU inference를 담당합니다. Paper Translator는 Ollama를
`127.0.0.1:11434`에서만 호출합니다.

## 응답 지연

전체 번역 시간의 주요 비용은 model inference입니다. Web server는 prompt 구성과 streaming relay만
수행합니다. 사용자 체감 지연을 줄이기 위해 `/api/translate/stream`은 Ollama의 streaming output을
완료까지 기다리지 않고 browser에 전달합니다.

PDF는 문서를 처음 열 때 한 번 전송되므로 remote client에서는 파일 크기와 network 상태에 따라 최초
로딩 시간이 추가될 수 있습니다. 문장 선택 후 번역 request에는 선택한 text만 전송합니다.

현재 구조에서 Python server를 다른 언어로 교체하는 것은 우선순위가 낮습니다. 실제 profiling에서
server CPU time이나 relay overhead가 병목으로 확인될 때만 재검토합니다.

## Academic glossary

기본 glossary와 사용자 override를 server에서 합칩니다.

```text
Default term
    │
    ├─ user override 없음 → Default 사용
    │
    └─ user override 있음 → User term 우선
```

선택한 영어 구절에 포함된 용어만 TranslateGemma prompt의 preferred terminology로 전달합니다.

## History

최근 번역 history는 browser `localStorage`에 저장됩니다. 따라서 같은 device/browser에서는 재실행 후
복원되지만 여러 device 사이에 동기화되지 않습니다. 중앙 history sync는 현재 범위 밖입니다.
