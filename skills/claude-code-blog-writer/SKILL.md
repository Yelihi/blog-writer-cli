---
name: claude-code-blog-writer
description: Use when Claude Code needs to operate this Blog Writer repository to prepare Markdown blog outputs from drafts, samples, and image notes.
---

# Claude Code Blog Writer

This skill is a thin operating guide for the Blog Writer CLI. Do not duplicate CLI logic in prompts, scripts, or ad hoc transformations. Claude Code should prepare files, run commands, inspect outputs, and report the result.

## Preconditions

- Work from the repository root.
- Confirm `samples/` contains the default author's reference posts when style regeneration is needed.
- Confirm `writer-style/writer-profile.md` and `writer-style/style-rules.md` exist before drafting.
- If either style file is absent or stale, run:

```bash
blog-writer profile
```

## Prepare Inputs

Place the new draft at `inputs/draft.md`. Put user-supplied images in `inputs/assets/`.

Prefer explicit user placement for images:

```md
<!-- image: file-name.jpg | alt: short description | caption: visible caption -->
```

If inline placement is not convenient, use image notes:

```md
## 이미지 메모

- photo-01.jpg: 도입부 아래
```

## CLI Flow

```bash
blog-writer profile
blog-writer draft inputs/draft.md
blog-writer cover-prompt outputs/<slug>
```

If the generated slug is not obvious, read the `blog-writer draft` output and use that path for the cover prompt command.

## Verify Outputs

Use `docs/checklists/blog-writer-review.md`.

Expected human-facing files:

- `outputs/<slug>/public/post.md`
- `outputs/<slug>/public/image-plan.md`
- `outputs/<slug>/public/cover-prompt.md`

Expected internal work files:

- `outputs/<slug>/work/brief.md`
- `outputs/<slug>/work/outline.md`
- `outputs/<slug>/work/edit-notes.md`

## Boundaries

- Do not duplicate the blog transformation logic outside the CLI.
- Do not call an image provider from this skill.
- Do not make MDX- or Astro-specific changes here.
- Keep `writer-style/writer-profile.md` as human-readable context and `writer-style/style-rules.md` as the operative style guide.
