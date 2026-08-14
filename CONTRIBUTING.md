# Contributing

이 repository의 code/documentation 변경은 `nayana224/my_instruction`의 최신 지침을 우선합니다.

변경 전:

1. 관련 code와 현재 interface를 확인합니다.
2. 필요한 범위만 수정합니다.
3. unrelated refactor/rename/format cleanup을 하지 않습니다.

변경 후:

```bash
python -m unittest discover -s tests -v
python -m compileall -q src tests
```

Web behavior를 변경했다면 [docs/development.md](docs/development.md)의 browser 검증 항목도 확인합니다.
