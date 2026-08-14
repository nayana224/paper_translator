# HTTP API

이 문서는 Paper Translator server의 public HTTP interface 기준 문서입니다.

기본 local base URL:

```text
http://127.0.0.1:8765
```

Tailscale Serve를 사용할 때 client는 해당 device의 `https://<device>.<tailnet>.ts.net` 주소를 사용합니다.

## GET /health

Server와 configured model 정보를 확인합니다.

응답 예:

```json
{
  "status": "ok",
  "model": "translategemma:4b"
}
```

이 endpoint는 Ollama inference를 실행하지 않습니다.

## POST /api/translate

완료된 번역을 하나의 JSON response로 반환합니다.

Request:

```json
{
  "text": "We select a grasp point."
}
```

Response:

```json
{
  "translation": "파지 지점을 선택합니다.",
  "model": "translategemma:4b",
  "terms": [
    {
      "english": "grasp point",
      "korean": "파지 지점",
      "source": "default"
    }
  ]
}
```

최대 입력 길이는 6000 characters입니다.

## POST /api/translate/stream

Web UI가 사용하는 streaming endpoint입니다.

Request body는 `/api/translate`와 동일합니다. Response content type은
`application/x-ndjson`이며 각 line은 하나의 JSON event입니다.

초기 metadata:

```json
{"type":"meta","model":"translategemma:4b","terms":[]}
```

번역 chunk:

```json
{"type":"chunk","text":"파지 "}
```

완료:

```json
{"type":"done"}
```

실패:

```json
{"type":"error","message":"..."}
```

## GET /api/glossary

현재 default/user glossary를 모두 반환합니다.

## POST /api/glossary

사용자 term을 추가하거나 override합니다.

```json
{
  "english": "granular food",
  "korean": "입상 식품"
}
```

## DELETE /api/glossary

사용자 term만 삭제할 수 있습니다.

```json
{
  "english": "granular food"
}
```

Default term의 user override를 삭제하면 default translation이 다시 사용됩니다.

## API 문서 UI

Server 실행 중 다음 주소에서 FastAPI OpenAPI UI를 확인할 수 있습니다.

```text
/api/docs
```
