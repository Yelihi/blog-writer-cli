---
name: codex-blog-writer
description: Use when turning a user's draft, sample posts, and image notes into a Blog Writer CLI output package inside this repository.
---

# Codex Blog Writer

Use this skill to turn `inputs/draft.md` into the final files under `outputs/<slug>/`.
The CLI prepares the package and mechanical files. Codex must do the writing pass.

## Before Running

1. Confirm the repository root contains `package.json` for `blog-writer`.
2. Check whether `samples/` has the default author's existing posts.
3. Check whether `writer-style/writer-profile.md` and `writer-style/style-rules.md` already exist.
4. If style files are missing or samples changed, run:

```bash
node ./bin/blog-writer.js profile
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
node ./bin/blog-writer.js profile
node ./bin/blog-writer.js draft inputs/draft.md
node ./bin/blog-writer.js cover-prompt outputs/<slug>
```

Skip `node ./bin/blog-writer.js profile` only when `writer-style/writer-profile.md` and `writer-style/style-rules.md` are already current. Use `blog-writer ...` only after `npm link` or another install step has put the package bin on PATH.

## Codex Writing Pass

After `draft` runs, read these files before editing `outputs/<slug>/public/post.md`:

- `inputs/draft.md`
- `writer-style/writer-profile.md`
- `writer-style/style-rules.md`
- every Markdown file in `samples/`
- `outputs/<slug>/work/brief.md`
- `outputs/<slug>/work/outline.md`

Then overwrite:

- `outputs/<slug>/public/post.md` with the final blog post.
- `outputs/<slug>/work/brief.md` with the real source brief.
- `outputs/<slug>/work/outline.md` with the real structure used.
- `outputs/<slug>/work/edit-notes.md` with concise editing notes.

Rules for the final post:

- Follow the sample essays' structure and rhythm. Do not force `머리말`, `본문`, `마무리`, or a table of contents unless the samples actually use that pattern.
- Preserve the user's concrete claims and examples from `inputs/draft.md`; do not invent unsupported facts.
- Use `writer-style/style-rules.md` as the binding style rule set.
- Actively use Markdown-native visual aids when they improve understanding: tables for comparisons, Mermaid diagrams for flows or state changes, blockquotes for key claims, and code blocks for concrete examples.
- Actively use Markdown emphasis where it helps scanning: bold for core claims, inline code for API names and exact tokens, and concise callouts/quotes for caveats. Do not decorate every paragraph.
- Keep Markdown framework-agnostic: no frontmatter, MDX components, or Astro-only syntax.
- Keep image markers or clearly account for them in `image-plan.md`.

## Review

Open `docs/checklists/blog-writer-review.md` and verify the generated package before reporting completion. Human-facing files are in `outputs/<slug>/public/`; internal work files are in `outputs/<slug>/work/`.

## Boundaries

- Do not duplicate mechanical CLI behavior in this skill.
- Do not generate the actual cover image.
- Do not add Astro, MDX, or blog-specific frontmatter unless a separate downstream project asks for it.
- Preserve the default author's style by using `writer-style/style-rules.md`.
