# Blog Writer: 파일 기반 CLI 파이프라인 기획

## 배경

Blog Writer는 사용자가 직접 정리한 원고를 블로그에 바로 활용할 수 있는 Markdown 원고 패키지로 바꾸는 파일 기반 CLI 파이프라인이다. 최종 패키지에는 정리된 블로그 원고, 섹션 구조, 본문 이미지 배치 계획, 커버 이미지 생성 프롬프트가 포함된다.

이 프로젝트는 MVP 단계에서 특정 개인 블로그 프레임워크에 종속되지 않는다. Astro, MDX, 블로그별 frontmatter, 배포 자동화는 별도 프로젝트나 후속 export preset으로 다룬다.

Codex와 Claude Code skill은 얇은 보조 레이어로 둔다. skill은 입력 파일을 준비하는 법, CLI를 실행하는 법, 결과물을 검수하는 법만 안내하고, 파이프라인 로직을 중복해서 품지 않는다.

## 목표

- 줄글 또는 어느 정도 정리된 초안을 범용 Markdown 블로그 원고로 재구성한다.
- 프로젝트의 `samples/`에 저장된 기존 작성 글을 분석해 재사용 가능한 작성자 스타일 가이드를 만든다.
- 원고자의 문체, 전개 방식, 제목 습관, 글의 리듬을 최대한 유지한다.
- 사람이 사용할 결과물과 파이프라인 내부 작업물을 명확히 분리한다.
- MVP에서는 사용자가 지정한 이미지 배치를 우선한다.
- MVP에서는 실제 커버 이미지를 생성하지 않고 고품질 커버 이미지 프롬프트를 생성한다.
- 추후 웹 UI, 이미지 생성 provider, 블로그별 export preset을 붙일 수 있도록 구조를 열어둔다.

## 비목표

- MVP에서 웹 UI를 만들지 않는다.
- MVP에서 Astro 또는 MDX 전용 결과물을 만들지 않는다.
- MVP에서 커버 이미지를 실제로 자동 생성하지 않는다.
- MVP에서 AI 이미지 이해를 사용해 본문 이미지를 자동 배치하지 않는다.
- MVP에서 여러 작성자 프로필을 지원하지 않는다.

## 기본 실행 방식

MVP는 파일을 주 인터페이스로 사용한다.

```bash
blog-writer profile
blog-writer draft inputs/draft.md
blog-writer cover-prompt outputs/<slug>
```

긴 원고를 CLI에 직접 붙여넣는 방식은 주 사용 방식으로 채택하지 않는다. 원고, 이미지, 생성 파일, 중간 작업물이 모두 디스크에 남아야 재현성과 검수가 좋아진다.

## 제안 폴더 구조

```text
blog-writer/
  samples/
    post-001.md
    post-002.md
    post-003.md

  writer-style/
    writer-profile.md
    style-rules.md

  inputs/
    draft.md
    assets/
      photo-01.jpg
      photo-02.jpg

  outputs/
    <slug>/
      public/
        post.md
        image-plan.md
        cover-prompt.md
        assets/

      work/
        brief.md
        outline.md
        edit-notes.md
```

## 폴더 역할

### `samples/`

기본 작성자의 기존 블로그 글을 저장한다. 사용자가 직접 관리한다.

`blog-writer profile` 명령은 이 샘플들을 분석해 재사용 가능한 스타일 파일을 생성한다.

### `writer-style/`

생성된 작성자 스타일 가이드를 저장한다.

- `writer-profile.md`: 작성자의 문체, 제목 패턴, 글 전개 방식, 반복 표현을 사람이 읽기 좋게 정리한 문서
- `style-rules.md`: 이후 생성 명령이 반드시 먼저 읽어야 하는 작성 규칙

### `inputs/`

새로 변환할 원고와 사용자가 제공한 이미지를 저장한다.

### `outputs/<slug>/public/`

사람이 실제로 사용할 결과물을 저장한다.

- `post.md`: 최종 범용 Markdown 블로그 원고
- `image-plan.md`: 본문 이미지 배치, alt text, caption, 선택적 생성 프롬프트
- `cover-prompt.md`: 외부 이미지 생성 도구에 넣을 커버 이미지 프롬프트
- `assets/`: 사용자가 제공했거나 추후 생성된 asset

### `outputs/<slug>/work/`

파이프라인 내부 작업물을 저장한다.

- `brief.md`: 원고 분석 브리프
- `outline.md`: 제목, 목차, 섹션 구조
- `edit-notes.md`: 편집 판단, 문체 유지 판단, 변환 의도

## 이미지 배치 정책

MVP에서는 사용자가 이미지 위치를 지정한다고 가정한다.

원고 중간 마커 예시:

```md
본문 문단입니다.

<!-- image: photo-01.jpg | alt: 작업 전 화면 | caption: 초기 상태 -->

다음 문단이 이어집니다.
```

원고 끝 이미지 메모 예시:

```md
## 이미지 메모

- photo-01.jpg: 도입부 아래
- photo-02.jpg: 문제 해결 과정 섹션
```

AI 기반 자동 이미지 배치는 토큰과 이미지 처리 비용이 커질 수 있으므로 명시적 옵션으로 추후 추가한다.

```bash
blog-writer draft inputs/draft.md --auto-place-images
```

## 커버 이미지 정책

MVP에서는 `cover-prompt.md`만 생성한다. 실제 이미지는 생성하지 않는다.

추후 provider 기반 생성을 붙일 수 있다.

```bash
blog-writer cover-generate outputs/<slug> --provider openai
```

provider 후보:

- OpenAI image generation
- Midjourney manual workflow
- Local image model
- 기타 외부 이미지 생성 도구

## CLI 명령 초안

### `blog-writer profile`

`samples/`의 기존 글을 분석해 작성자 스타일 파일을 생성한다.

출력:

```text
writer-style/
  writer-profile.md
  style-rules.md
```

### `blog-writer draft inputs/draft.md`

입력 원고를 블로그 원고 패키지로 변환한다.

출력:

```text
outputs/<slug>/
  public/
    post.md
    image-plan.md
    cover-prompt.md
    assets/
  work/
    brief.md
    outline.md
    edit-notes.md
```

### `blog-writer cover-prompt outputs/<slug>`

기존 산출물에서 커버 이미지 프롬프트만 다시 생성한다.

## 후속 단계

### Phase 1: MVP

- 파일 기반 CLI
- 작성자 스타일 분석
- Markdown 원고 생성
- 이미지 배치 계획 생성
- 커버 이미지 프롬프트 생성
- Codex와 Claude Code용 얇은 skill 안내

### Phase 2: 품질 개선

- 제목 후보 다중 생성
- 문체 일관성 검수
- 이미지 마커 검증
- 결과물 체크리스트
- 재생성 옵션

### Phase 3: 웹 UI

- 원고 텍스트 입력
- 이미지 업로드
- 이미지 배치 메모 입력
- 결과물 다운로드
- `public/` 미리보기

### Phase 4: Provider 확장

- OpenAI 이미지 생성 연동
- 블로그별 export preset
- Astro/MDX 변환 흐름과 별도 연동
- 선택적 자동 이미지 배치

## Acceptance Criteria

- `samples/`를 사용해 작성자 스타일 파일을 생성할 수 있다.
- `inputs/draft.md`로 `outputs/<slug>/public/post.md`를 생성할 수 있다.
- 최종 결과물과 내부 작업물이 `public/`, `work/`로 분리된다.
- `post.md`는 특정 프레임워크에 종속되지 않는 범용 Markdown이다.
- `image-plan.md`는 본문 이미지 위치, alt text, caption을 기록한다.
- `cover-prompt.md`는 외부 이미지 생성 도구에 사용할 수 있는 프롬프트를 포함한다.
- MVP는 파일 기반 CLI로 동작한다.
