# Blog Writer

## 개요

Blog Writer는 사용자가 정리해 둔 원고와 이미지 메모를 파일로 받아, 블로그 글 작성 패키지로 변환하는 CLI 기반 파이프라인입니다.

목표는 개인 블로그에 바로 가져갈 수 있는 범용 Markdown 초안과 이미지 계획, 커버 이미지 프롬프트를 안정적으로 만드는 것입니다. Astro나 MDX에 종속된 결과물을 만들지 않고, 이후 개인 블로그 프로젝트에서 별도 변환할 수 있도록 일반 Markdown을 기준으로 둡니다.

이 MVP는 한 명의 기본 작성자를 전제로 합니다. `samples/`에 작성자의 기존 글을 넣고 `blog-writer profile`을 실행하면 `writer-style/` 아래에 작성자 스타일 파일이 생성됩니다. 이후 `draft` 명령은 이 스타일 파일을 참고해 새 원고를 정리합니다.

핵심 흐름은 세 단계입니다.

```bash
blog-writer profile
blog-writer draft inputs/draft.md
blog-writer cover-prompt outputs/<slug>
```

생성 결과는 사람이 사용할 파일과 내부 작업 파일로 나뉩니다.

```text
outputs/<slug>/public/  사람이 실제로 확인하고 사용할 결과물
outputs/<slug>/work/    디버깅, 재생성, 판단 근거를 위한 내부 작업물
```

## 실제 사용자 사용 방법

### 1. 작성자 샘플 준비

기본 작성자의 기존 블로그 글을 `samples/`에 Markdown 파일로 저장합니다.

```text
samples/
  sample-essay-01.md
  sample-essay-02.md
```

처음 실행하거나 샘플 글을 바꾼 뒤에는 작성자 스타일 파일을 다시 만듭니다.

```bash
blog-writer profile
```

생성되는 파일:

```text
writer-style/writer-profile.md  사람이 읽는 작성자 스타일 분석
writer-style/style-rules.md     draft 명령이 참고하는 작성 규칙
```

`writer-style/style-rules.md`가 없거나 오래된 상태라면 `draft` 결과의 문체 일관성이 떨어질 수 있습니다.

### 2. 새 원고 준비

새로 변환할 원고를 `inputs/draft.md`에 작성합니다. 제목은 Markdown H1으로 쓰는 것을 권장합니다.

```md
# 파일 기반 블로그 작성 파이프라인

원고를 먼저 파일로 정리하고, 작성자 스타일을 참고해 블로그 초안을 만드는 흐름을 설명합니다.
```

이미지가 있다면 `inputs/assets/`에 넣습니다.

```text
inputs/
  draft.md
  assets/
    workflow-screen.png
```

이미지 위치는 사용자가 원고에 직접 표시하는 방식을 권장합니다. 이미지 내용을 AI가 모두 비교해서 자동 배치하는 방식은 토큰 비용과 일관성 문제가 커질 수 있기 때문입니다.

본문 중간에 넣을 때:

```md
<!-- image: workflow-screen.png | alt: 파일 기반 블로그 작성 흐름 화면 | caption: 입력과 출력 폴더를 나누어 확인합니다. -->
```

원고 끝에 메모로 정리할 때:

```md
## 이미지 메모

- workflow-screen.png: 본문 흐름 설명 아래
```

### 3. 블로그 패키지 생성

원고를 준비한 뒤 draft 명령을 실행합니다.

```bash
blog-writer draft inputs/draft.md
```

원고 제목을 기준으로 `outputs/<slug>/` 폴더가 생성됩니다. 특정 slug를 쓰고 싶다면 다음처럼 지정합니다.

```bash
blog-writer draft inputs/draft.md --slug my-post
```

### 4. 커버 이미지 프롬프트 재생성

`draft` 명령은 기본적으로 `cover-prompt.md`도 생성합니다. 글을 수정한 뒤 커버 프롬프트만 다시 만들고 싶다면 다음 명령을 실행합니다.

```bash
blog-writer cover-prompt outputs/<slug>
```

이 명령은 실제 커버 이미지는 생성하지 않습니다. `outputs/<slug>/public/cover-prompt.md`에 외부 이미지 생성 도구로 가져갈 프롬프트만 작성합니다.

### 5. 결과물 확인

먼저 사람이 사용할 public 파일을 확인합니다.

```text
outputs/<slug>/public/post.md          최종 범용 Markdown 블로그 초안
outputs/<slug>/public/image-plan.md    본문 이미지 배치, alt, caption 계획
outputs/<slug>/public/cover-prompt.md  외부 이미지 생성 도구용 커버 프롬프트
```

그다음 필요할 때 내부 work 파일을 확인합니다.

```text
outputs/<slug>/work/brief.md       원고 분석 브리프
outputs/<slug>/work/outline.md     제목, 목차, 섹션 구조
outputs/<slug>/work/edit-notes.md  편집 판단과 파이프라인 경계 기록
```

검수 체크리스트는 `docs/checklists/blog-writer-review.md`에 있습니다.

## 샘플 실행

저장소에는 예시 작성자 샘플과 입력 템플릿이 포함되어 있습니다.

```bash
npm install
node ./bin/blog-writer.js profile
node ./bin/blog-writer.js draft inputs/draft.md --slug sample-run
node ./bin/blog-writer.js cover-prompt outputs/sample-run
```

로컬 개발 중 전역 설치 없이 실행하려면 `blog-writer` 대신 `node ./bin/blog-writer.js`를 사용하면 됩니다.

## 폴더 구조

```text
samples/       기본 작성자의 기존 글 샘플
writer-style/  profile 명령으로 생성되는 작성자 스타일 파일
inputs/        새 원고와 사용자 제공 이미지
outputs/       생성된 블로그 작성 패키지
skills/        Codex와 Claude Code용 얇은 CLI 사용 가이드
docs/          파일 계약, 체크리스트, LLM 경계 문서
```

전체 파일 계약은 `docs/file-contract.md`를 참고하세요.

## MVP 제한사항

- 실제 커버 이미지는 생성하지 않습니다. `cover-prompt.md`만 만들고, 이미지 생성 도구 연결은 이후 단계입니다.
- 본문 이미지를 AI가 자동으로 보고 배치하지 않습니다. 사용자가 이미지 마커나 이미지 메모로 위치를 지정합니다.
- MDX, Astro frontmatter, 개인 블로그 전용 컴포넌트는 만들지 않습니다. 이 변환은 별도 다운스트림 프로젝트에서 처리합니다.
- 여러 작성자 프로필을 지원하지 않습니다. 현재 MVP는 기본 작성자 한 명을 전제로 합니다.
- 실제 LLM provider 호출은 아직 구현하지 않았습니다. 현재는 파일 기반 placeholder와 dry-run prompt package 경계가 준비되어 있습니다.

## 개발

```bash
npm test
node ./bin/blog-writer.js --help
```

LLM provider 없이 prompt package만 확인하려면 다음 명령을 사용할 수 있습니다.

```bash
node ./bin/blog-writer.js dry-run profile
```

LLM 경계와 task 이름은 `docs/reference/llm-boundary.md`를 참고하세요.
