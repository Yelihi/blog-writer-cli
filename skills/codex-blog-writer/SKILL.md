---
name: codex-blog-writer
description: Use when turning a user's draft, sample posts, and image notes into a Blog Writer CLI output package inside this repository.
---

# Codex Blog Writer

Use this skill as a thin wrapper around the Blog Writer CLI. Do not reimplement blog planning, rewriting, image planning, or cover prompt logic inside the skill. The CLI is the source of truth.

## Before Running

1. Confirm the repository root contains `package.json` for `blog-writer`.
2. Check whether `samples/` has the default author's existing posts.
3. Check whether `writer-style/writer-profile.md` and `writer-style/style-rules.md` already exist.
4. If style files are missing or samples changed, run:

```bash
blog-writer profile
```

## Input Setup

Use `inputs/draft.md` for the user's draft. If the user provides images, place them under `inputs/assets/` and ask the user to mark placement in the draft when automatic placement would be ambiguous or token-heavy.

Supported image marker:

```md
<!-- image: file-name.jpg | alt: short description | caption: visible caption -->
```

Supported image notes:

```md
## 이미지 메모

- photo-01.jpg: 도입부 아래
```

## Workflow

Run the commands in this order:

```bash
blog-writer profile
blog-writer draft inputs/draft.md
blog-writer cover-prompt outputs/<slug>
```

Skip `blog-writer profile` only when `writer-style/writer-profile.md` and `writer-style/style-rules.md` are already current.

## Review

Open `docs/checklists/blog-writer-review.md` and verify the generated package before reporting completion. Human-facing files are in `outputs/<slug>/public/`; internal work files are in `outputs/<slug>/work/`.

## Boundaries

- Do not reimplement or duplicate CLI behavior in this skill.
- Do not generate the actual cover image.
- Do not add Astro, MDX, or blog-specific frontmatter unless a separate downstream project asks for it.
- Preserve the default author's style by using `writer-style/style-rules.md`.
