# 운영 및 Tailscale

이 문서는 연구실 PC에서 Paper Translator를 private service로 운영하는 절차의 기준 문서입니다.

## 기본 원칙

- Ollama는 외부 network에 직접 공개하지 않습니다.
- Paper Translator server도 기본적으로 `127.0.0.1:8765`에만 bind합니다.
- Remote access는 Tailscale Serve를 사용합니다.
- Tailscale Funnel은 사용하지 않습니다.

## Server 시작

```bash
cd <repository>
source .venv/bin/activate
paper-translator-server
```

확인:

```bash
curl http://127.0.0.1:8765/health
```

## Tailscale Serve

Tailscale login이 완료되어 있다고 가정합니다.

현재 사용자에게 Tailscale operator 권한이 없다면 한 번만 실행합니다.

```bash
sudo tailscale set --operator=$USER
```

Serve 시작:

```bash
tailscale serve --bg 8765
```

상태 확인:

```bash
tailscale serve status
```

출력 예:

```text
https://<device>.<tailnet>.ts.net (tailnet only)
|-- / proxy http://127.0.0.1:8765
```

HTTPS 확인:

```bash
curl https://<device>.<tailnet>.ts.net/health
```

## 다른 장치에서 사용

Windows/Linux/Android device를 같은 tailnet에 연결한 뒤 browser에서 Tailscale Serve URL을 엽니다.
별도 desktop executable 또는 Android APK는 필요하지 않습니다.

## Server 종료

Foreground로 실행한 `paper-translator-server`는 `Ctrl+C`로 종료합니다.

Tailscale Serve proxy를 해제하려면:

```bash
tailscale serve --https=443 off
```

## 재부팅 후 자동 실행

Tailscale Serve의 background configuration은 Tailscale daemon이 관리합니다. Paper Translator server의
자동 시작은 systemd user service 등을 통해 별도로 구성할 수 있습니다.

자동 시작을 설정할 때도 server bind는 `127.0.0.1`로 유지합니다.

## 문제 확인 순서

원격 browser에서 접속되지 않을 때 한 번에 여러 설정을 바꾸지 않고 아래 순서로 확인합니다.

1. `curl http://127.0.0.1:8765/health`
2. `curl https://<device>.<tailnet>.ts.net/health`
3. `tailscale serve status`
4. `ollama ls`
5. 번역 API 단독 호출

`/health`가 정상인데 번역만 실패한다면 Tailscale보다 Ollama/model 쪽을 우선 확인합니다.
