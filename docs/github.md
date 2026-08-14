# GitHub 저장소 준비

이 문서는 Paper Translator를 GitHub repository로 처음 올리는 절차의 기준 문서입니다.

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
않습니다. README에는 placeholder만 사용합니다.

## 2. Git 초기화

```bash
git init
git branch -M main
git add .
git status
git commit -m "feat: 웹 논문 번역기 초기 버전 추가"
```

Commit 전 `git status`에서 의도하지 않은 파일이 없는지 다시 확인합니다.

## 3. GitHub 빈 repository 생성

GitHub에서 새 repository를 만들 때 local repository와 충돌하지 않도록 README/.gitignore/License를 자동
생성하지 않은 빈 repository로 시작하는 방법이 가장 단순합니다.

remote 등록:

```bash
git remote add origin <YOUR_REPOSITORY_URL>
git remote -v
git push -u origin main
```

## 4. 첫 tag

실제 연구실 server와 browser에서 기능 확인 후 tag를 만듭니다.

```bash
git tag -a v1.0.0 -m "Paper Translator Web v1.0.0"
git push origin v1.0.0
```

## 5. GitHub Actions

`.github/workflows/ci.yml`은 push와 pull request에서 다음을 확인합니다.

- Python 3.10 / 3.12 unit test
- source compile

PDF.js 다운로드나 Ollama inference는 CI에서 실행하지 않습니다. 외부 service가 필요한 runtime 검증은
연구실 server에서 별도로 수행합니다.

## 6. Release

별도 Windows/Linux/Android binary를 배포하지 않습니다. Web application은 server repository를 update하고
browser를 새로고침하면 모든 client에 반영됩니다.

Release에는 source tag와 변경 내용만 관리하면 충분합니다.
