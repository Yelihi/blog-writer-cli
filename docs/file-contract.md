# Blog Writer File Contract

이 문서는 Blog Writer MVP가 사용하는 파일과 폴더의 계약을 정의한다. 이후 구현 Issue는 이 계약을 기준으로 입력을 읽고 결과물을 생성한다.

## Source Folders

### `samples/`

기본 작성자의 기존 글 샘플을 저장한다.

- 사용자가 직접 관리한다.
- Markdown 파일을 우선한다.
- `blog-writer profile`은 이 폴더의 글을 분석해 작성자 스타일 파일을 만든다.
- 예시 파일명: `samples/post-001.md`, `samples/post-002.md`

### `writer-style/`

`samples/` 분석 결과를 저장한다.

- `writer-style/writer-profile.md`: 사람이 읽는 작성자 스타일 분석
- `writer-style/style-rules.md`: 이후 생성 명령이 반드시 참고할 작성 규칙

## Input Folders

### `inputs/draft.md`

새로 변환할 원고를 저장한다.

- 줄글 또는 어느 정도 정리된 초안을 허용한다.
- 이미지 위치는 원고 중간 마커 또는 원고 끝 이미지 메모로 지정한다.
- 이 파일은 샘플 템플릿으로 제공되며 실제 작업 시 복사하거나 덮어써도 된다.

### `inputs/assets/`

원고에 사용할 이미지를 저장한다.

- 이미지 파일명은 원고의 이미지 마커 또는 이미지 메모와 일치해야 한다.
- MVP는 이미지 내용을 AI로 분석해 자동 배치하지 않는다.
- 권장 파일명은 짧고 설명적인 kebab-case다. 예: `setup-screen.jpg`, `result-view.png`

## Output Folders

### `outputs/<slug>/public/`

사람이 실제로 사용할 결과물을 저장한다.

- `post.md`: 최종 범용 Markdown 블로그 원고
- `image-plan.md`: 이미지 위치, alt text, caption, 추가 생성 프롬프트
- `cover-prompt.md`: 외부 이미지 생성 도구에 넣을 커버 이미지 프롬프트
- `assets/`: 복사되었거나 추후 생성된 asset

### `outputs/<slug>/work/`

파이프라인 내부 작업물을 저장한다.

- `brief.md`: 원고 분석 브리프
- `outline.md`: 제목, 목차, 섹션 구조
- `edit-notes.md`: 편집 판단, 문체 유지 판단, 변환 의도

`public/`은 사용자가 열어보는 폴더이고, `work/`는 디버깅과 재생성을 위한 폴더다.

## Image Marker Rules

원고 중간에 이미지를 넣고 싶을 때는 HTML comment 마커를 사용한다.

```md
<!-- image: file-name.jpg | alt: 이미지 설명 | caption: 화면 아래에 표시할 설명 -->
```

규칙:

- `image:` 값은 `inputs/assets/` 안의 파일명과 일치해야 한다.
- `alt:`는 접근성과 검색을 위한 짧은 설명이다.
- `caption:`은 본문에 표시할 수 있는 설명이다.
- MVP에서는 마커 위치를 사용자가 지정한 이미지 위치로 신뢰한다.

## Image Notes

원고 중간에 마커를 넣기 어렵다면 원고 끝에 이미지 메모를 작성할 수 있다.

```md
## 이미지 메모

- photo-01.jpg: 도입부 아래
- photo-02.jpg: 문제 해결 과정 섹션
```

MVP에서는 이 메모를 기반으로 `image-plan.md`를 만든다. AI 기반 자동 이미지 배치는 추후 `--auto-place-images` 옵션으로 분리한다.

## Slug Rules

출력 폴더 이름인 `<slug>`는 다음 순서로 결정한다.

1. CLI에서 `--slug`가 제공되면 그 값을 사용한다.
2. 원고에 제목이 있으면 제목을 slug로 변환한다.
3. 둘 다 없으면 입력 파일명을 slug로 변환한다.

slug 변환 규칙:

- 영문자는 소문자로 변환한다.
- 공백과 `_`는 `-`로 변환한다.
- 파일 시스템에서 문제가 될 수 있는 문자는 제거한다.
- 연속된 `-`는 하나로 줄인다.
- 앞뒤 `-`는 제거한다.

예시:

- `My First Post` -> `my-first-post`
- `draft.md` -> `draft`
- `블로그 원고 정리` -> `블로그-원고-정리`
