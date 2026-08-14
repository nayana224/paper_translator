# Security

Paper Translator는 개인 tailnet 내부 사용을 기본 전제로 합니다.

## 권장 배포

- `paper-translator-server`: `127.0.0.1:8765`
- Ollama: `127.0.0.1:11434`
- Remote access: Tailscale Serve
- Tailscale Funnel: 사용하지 않음
- 공유기 port forwarding: 사용하지 않음

## 주의

`PAPER_TRANSLATOR_HOST=0.0.0.0`으로 실행하면 local network 또는 host firewall 설정에 따라 service가
의도보다 넓게 노출될 수 있습니다. Tailscale Serve를 사용할 때는 localhost bind를 유지하세요.

Repository에 다음을 commit하지 않습니다.

- credentials / API token
- private key
- `.env`
- 개인 PDF
- 사용자 glossary data
- 개인 history

보안 문제가 의심되면 public issue에 credential이나 private network detail을 올리지 마세요.
