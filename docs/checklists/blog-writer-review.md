# Blog Writer Review Checklist

Use this checklist after running the Blog Writer CLI. It separates files people should review from internal work files that explain how the package was produced.

## Before Generation

- `samples/` contains the default author's current reference posts when style needs to be regenerated.
- `writer-style/writer-profile.md` exists and reflects the default author's tone, structure, and recurring preferences.
- `writer-style/style-rules.md` exists before running draft generation.
- `inputs/draft.md` contains the new draft and a clear title when possible.
- `inputs/assets/` contains only user-provided image files intended for the current draft.
- Image placement is explicit in `inputs/draft.md` when automatic AI placement would be ambiguous or token-heavy.

## Commands

```bash
blog-writer profile
blog-writer draft inputs/draft.md
blog-writer cover-prompt outputs/<slug>
```

Run `blog-writer profile` again when samples change. Otherwise confirm the existing style files are current before skipping it.

## Human-Facing Outputs

Review these files first:

- `outputs/<slug>/public/post.md`
  - Has a clear title, introduction, table of contents, body sections, and closing.
  - Preserves the author's style without adding unsupported claims.
  - Uses general Markdown only, not MDX-specific syntax.
- `outputs/<slug>/public/image-plan.md`
  - Lists expected assets from `inputs/assets/`.
  - Reflects inline image markers and image notes from the draft.
  - Clearly reports missing assets.
- `outputs/<slug>/public/cover-prompt.md`
  - Includes topic, audience, composition, color and mood, text-in-image guidance, and avoid rules.
  - States that no actual image was generated.
  - Can be copied into an external image generation tool.

## Internal Work Files

Use these files for debugging and regeneration decisions:

- `outputs/<slug>/work/brief.md`
  - Summarizes the source draft and prompt package used.
- `outputs/<slug>/work/outline.md`
  - Explains the planned title and section structure.
- `outputs/<slug>/work/edit-notes.md`
  - Records style source, framework boundaries, and generation notes.

## Final Checks

- Public files are usable without reading `work/`.
- Internal files do not need to be published.
- The cover image prompt does not claim an image was generated.
- Any manual edits to `post.md` keep the author's style rules in mind.
- If the result will be converted to MDX or Astro frontmatter, do that in a separate downstream project.
