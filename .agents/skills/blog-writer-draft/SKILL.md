---
name: blog-writer-draft
description: Use when the user asks Codex to complete a Blog Writer draft package in this repository, especially requests like "write from inputs/draft.md", "finish post.md", "run the blog writer workflow", or "$blog-writer-draft". This skill runs the CLI as packaging support, then performs the Codex writing pass so outputs/<slug>/public/post.md is actually finished.
---

# Blog Writer Draft

Use this skill to turn `inputs/draft.md` into a finished Blog Writer output package.
The CLI creates folders and mechanical files; Codex must do the writing pass.

## Workflow

1. Confirm the repository root contains `package.json` for `blog-writer`.
2. Check whether `samples/` contains Markdown sample posts.
3. Check whether `writer-style/writer-profile.md` and `writer-style/style-rules.md` exist.
4. Run `node ./bin/blog-writer.js profile` only if the style files are missing or samples changed.
5. Run `node ./bin/blog-writer.js draft inputs/draft.md`.
6. Read the generated slug from stdout or `outputs/`.
7. Run `node ./bin/blog-writer.js cover-prompt outputs/<slug>`.

Use `blog-writer ...` only when the package has already been linked or installed on `PATH`; otherwise use `node ./bin/blog-writer.js ...`.

## Codex Writing Pass

After `draft` runs, read:

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

## Writing Rules

- Preserve concrete claims and examples from `inputs/draft.md`; do not invent unsupported facts.
- Follow the sample essays' structure and rhythm.
- Use `writer-style/style-rules.md` as binding style guidance.
- Do not force `머리말`, `본문`, `마무리`, or a table of contents unless the samples use that pattern.
- Use Markdown-native aids only when useful: tables, Mermaid, blockquotes, code blocks, bold, and inline code.
- Keep Markdown framework-agnostic: no frontmatter, MDX components, or Astro-only syntax.
- Keep image markers or account for them in `image-plan.md`.

## Review

Open `docs/checklists/blog-writer-review.md` and verify the generated package before reporting completion.
