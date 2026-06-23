import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { writeDryRunPromptPackage } from '../llm/prompt-package.js';

export async function runDraftCommand(inputPath, options = {}) {
  const cwd = options.cwd ?? process.cwd();
  if (!inputPath) {
    throw new Error('Draft input not specified. Usage: blog-writer draft inputs/draft.md');
  }

  const draftPath = join(cwd, inputPath);
  const draft = await readRequiredFile(draftPath, `Draft input not found: ${inputPath}`);
  const title = extractTitle(draft);
  const slug = options.slug ?? slugify(title || stripMarkdownExtension(basename(inputPath)));
  const styleRulesPath = join(cwd, 'writer-style', 'style-rules.md');
  const styleRules = await readOptionalFile(styleRulesPath);
  const outputRoot = join(cwd, 'outputs', slug);
  const workDir = join(outputRoot, 'work');

  await mkdir(workDir, { recursive: true });

  const { packageDir } = await writeDryRunPromptPackage('draft-brief', {
    outputRoot: join(cwd, '.blog-writer', 'dry-run'),
    contextSections: [
      {
        title: 'Draft Input',
        body: renderMarkdownContext(inputPath, draft),
      },
      {
        title: 'Style Rules',
        body: styleRules || 'No writer-style/style-rules.md file was found.',
      },
    ],
  });

  await writeFile(join(workDir, 'brief.md'), renderBrief({ inputPath, title, slug, styleRules, packageDir }), 'utf8');
  await writeFile(join(workDir, 'outline.md'), renderOutline({ title, slug, packageDir }), 'utf8');

  return {
    slug,
    outputRoot,
    briefPath: join(workDir, 'brief.md'),
    outlinePath: join(workDir, 'outline.md'),
    packageDir,
  };
}

async function readRequiredFile(path, message) {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(message);
    }
    throw error;
  }
}

async function readOptionalFile(path) {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      return '';
    }
    throw error;
  }
}

function extractTitle(markdown) {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() ?? '';
}

function stripMarkdownExtension(fileName) {
  return fileName.replace(/\.md$/i, '');
}

export function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\p{L}\p{N}-]+/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'draft';
}

function renderMarkdownContext(label, markdown) {
  return `Source: ${label}

\`\`\`md
${markdown.trim()}
\`\`\``;
}

function renderBrief({ inputPath, title, slug, styleRules, packageDir }) {
  return `# Draft Brief

This placeholder brief was generated from \`${inputPath}\`.

- Title: ${title || '(not detected)'}
- Slug: ${slug}
- Style rules: ${styleRules ? 'writer-style/style-rules.md was included in the prompt package.' : 'No style rules found.'}
- Prompt package: ${packageDir}

Replace this placeholder with the model-generated brief after reviewing the dry-run prompt package.
`;
}

function renderOutline({ title, slug, packageDir }) {
  return `# Draft Outline

Working title: ${title || slug}

## Sections

1. Introduction
2. Main body
3. Closing

Prompt package:
- ${packageDir}

Replace this placeholder with the model-generated outline after reviewing the dry-run prompt package.
`;
}
