# LLM Boundary

Blog Writer separates prompt package generation from model provider execution.

## Dry-Run First

`blog-writer dry-run <task>` writes a prompt package without calling any model provider.

```bash
blog-writer dry-run profile
blog-writer dry-run draft-brief --output .blog-writer/dry-run
blog-writer dry-run cover-prompt
```

Each package contains:

- `prompt.md`: The prompt that a provider adapter would send to a model
- `metadata.json`: Task name, template path, expected output files, and provider requirements
- `README.md`: Human-readable explanation of the package

## Provider Boundary

`blog-writer run-model <task>` is reserved for future provider adapters.

Until a provider is implemented, it exits with a clear message and suggests the dry-run command. This keeps tests and local development independent from OpenAI, Claude, or any other external service.

## Task Names

- `profile`: Analyze `samples/` and create writer style guidance
- `draft-brief`: Analyze `inputs/draft.md` and create work files
- `cover-prompt`: Create a cover image prompt from an output package
