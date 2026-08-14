# GitHub 저장소 및 release

이 문서는 Paper Translator를 GitHub에 공개하고 release를 관리하는 절차의 기준 문서입니다.

Repository:

```text
https://github.com/nayana224/paper_translator
```

## 1. 공개 전 확인

repository root에서 다음을 확인합니다.

```bash
git status --short
find . -maxdepth 3 -type f | sort
```

다음 항목이 포함되지 않았는지 확인합니다.

- `.venv/`
- `.env`
- 개인 PDF
- credential / token / private key
- 사용자 glossary JSON
- 개인 browser history export
- 실제 private infrastructure 정보를 담은 별도 설정 파일

Tailscale device URL은 credential은 아니지만 public repository의 default configuration으로 hard-code하지
않습니다. README와 example에는 generic placeholder를 사용합니다.

## 2. Fresh clone 검증

release 전에는 기존 개발 환경이 아닌 별도 directory에서 최소 한 번 fresh clone 검증을 수행합니다.

```bash
cd /tmp
git clone https://github.com/nayana224/paper_translator.git paper_translator_release_test
cd paper_translator_release_test

./scripts/check_environment.sh || true
./scripts/setup.sh
source .venv/bin/activate
python -m unittest discover -s tests -v
paper-translator-server
```

다른 terminal에서:

```bash
curl http://127.0.0.1:8765/health
```

그 다음 실제 browser에서 PDF open → selection → streaming translation을 확인합니다.

## 3. Commit

Commit message는 project `AGENTS.md` 규칙에 따라 `<type>: <한글 요약>` 형식을 사용합니다.

예:

```bash
git add .
git status
git commit -m "fix: PDF 선택 번역 오류 수정"
```

Commit 전 `git status`에서 의도하지 않은 파일이 없는지 다시 확인합니다.

## 4. GitHub Actions

`.github/workflows/ci.yml`은 `main` push와 pull request에서 다음을 확인합니다.

- Python 3.10 / 3.12 unit test
- Python source compile
- JavaScript syntax

PDF.js 다운로드나 Ollama inference는 CI에서 실행하지 않습니다. 외부 service와 GPU가 필요한 runtime 검증은
server 환경에서 별도로 수행합니다.

HTTPS Personal Access Token으로 workflow 파일을 push할 경우 GitHub token 설정에 따라 workflow 수정 권한이
필요할 수 있습니다. 일반 source 변경과 CI workflow 권한은 구분해서 관리합니다.

## 5. Release 전 check

```bash
source .venv/bin/activate
python -m unittest discover -s tests -v
python -m compileall -q src tests
node --check src/paper_translator/web/app.js
./scripts/check_environment.sh
```

추가 runtime check:

```bash
curl http://127.0.0.1:8765/health
```

실제 browser에서 최소 한 문장을 TranslateGemma로 번역합니다.

## 6. Version tag

실제 server와 browser에서 기능 확인 후 tag를 만듭니다.

```bash
git tag -a v1.0.0 -m "Paper Translator Web v1.0.0"
git push origin v1.0.0
```

## 7. Release 방식

별도 Windows/Linux/Android binary를 배포하지 않습니다. Web application은 Linux server repository를
update하고 browser를 새로고침하면 모든 client에 반영됩니다.

Release에는 다음을 기록합니다.

- source tag
- 주요 변경 내용
- 지원 server 환경
- 필요한 Ollama model
- breaking change 또는 migration 필요 여부

## 8. Update

배포 server에서는 작업 tree가 깨끗한 상태에서 update합니다.

```bash
cd /path/to/paper_translator
git status
git pull --ff-only
source .venv/bin/activate
python -m pip install -e .
```

dependency 또는 PDF.js version이 변경된 release에서는 release note의 추가 절차를 따릅니다.
