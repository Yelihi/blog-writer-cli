# Blog Writer

Blog Writer is a file-based CLI pipeline for turning rough or semi-structured drafts into reusable blog writing packages.

The MVP keeps the workflow framework-agnostic. It produces general-purpose Markdown and supporting planning files rather than Astro- or MDX-specific output.

## MVP Workflow

```bash
blog-writer profile
blog-writer draft inputs/draft.md
blog-writer cover-prompt outputs/<slug>
```

## Project Structure

```text
samples/       Existing posts written by the default author
writer-style/  Generated writer profile and style rules
inputs/        New drafts and user-provided assets
outputs/       Generated blog writing packages
```

Human-facing output belongs in `outputs/<slug>/public/`. Internal pipeline artifacts belong in `outputs/<slug>/work/`.

## Development

```bash
npm test
node ./bin/blog-writer.js --help
```

The initial scaffold intentionally uses Node.js with no runtime dependencies. Provider integrations and richer workflow commands can be added in later issues.
