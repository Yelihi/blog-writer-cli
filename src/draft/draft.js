import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { writeCoverPromptForPackage } from '../cover/cover-prompt.js';
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
  const publicDir = join(outputRoot, 'public');
  const workDir = join(outputRoot, 'work');

  await mkdir(publicDir, { recursive: true });
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

  const imagePlan = await buildImagePlan({ cwd, draft });

  await writeFile(join(workDir, 'brief.md'), renderBrief({ inputPath, title, slug, styleRules, packageDir }), 'utf8');
  await writeFile(join(workDir, 'outline.md'), renderOutline({ title, slug, packageDir }), 'utf8');
  await writeFile(join(publicDir, 'post.md'), renderPost({ draft, title, slug, styleRules }), 'utf8');
  await writeFile(join(publicDir, 'image-plan.md'), renderImagePlan(imagePlan), 'utf8');
  await writeFile(join(workDir, 'edit-notes.md'), renderEditNotes({ inputPath, slug, styleRules, packageDir }), 'utf8');
  const { coverPromptPath } = await writeCoverPromptForPackage({ packageRoot: outputRoot });

  return {
    slug,
    outputRoot,
    briefPath: join(workDir, 'brief.md'),
    outlinePath: join(workDir, 'outline.md'),
    postPath: join(publicDir, 'post.md'),
    imagePlanPath: join(publicDir, 'image-plan.md'),
    coverPromptPath,
    editNotesPath: join(workDir, 'edit-notes.md'),
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

async function readAssetNames(cwd) {
  try {
    const entries = await readdir(join(cwd, 'inputs', 'assets'), { withFileTypes: true });
    return entries.filter((entry) => entry.isFile()).map((entry) => entry.name).sort();
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
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

Prompt package:
- ${packageDir}

Replace this placeholder with a Codex-generated outline after reviewing the dry-run prompt package.
`;
}

function renderPost({ draft, title, slug }) {
  const postTitle = title || slug;
  const body = removeFirstTitle(draft).trim();

  return `# ${postTitle}

${body}
`;
}

function renderEditNotes({ inputPath, slug, styleRules, packageDir }) {
  return `# Edit Notes

- Source draft: ${inputPath}
- Output slug: ${slug}
- Style source: ${styleRules ? 'writer-style/style-rules.md was included.' : 'No style rules file was found.'}
- Prompt package: ${packageDir}
- Framework-specific frontmatter was not added.
- MDX-only syntax was not added.
- Body image planning was generated from user-provided markers and notes only.
- Cover image generation remains out of scope for this step.
`;
}

async function buildImagePlan({ cwd, draft }) {
  const assetNames = await readAssetNames(cwd);
  const knownAssets = new Set(assetNames);
  const inlineMarkers = parseInlineImageMarkers(draft);
  const imageNotes = parseImageNotes(draft);
  const referencedFiles = new Set([
    ...inlineMarkers.map((marker) => marker.fileName),
    ...imageNotes.map((note) => note.fileName),
  ]);
  const missingAssets = [...referencedFiles].filter((fileName) => !knownAssets.has(fileName)).sort();

  return {
    assetNames,
    inlineMarkers,
    imageNotes,
    missingAssets,
  };
}

function parseInlineImageMarkers(markdown) {
  return [...markdown.matchAll(/<!--\s*image:\s*([^|]+?)\s*\|\s*alt:\s*([^|]+?)\s*\|\s*caption:\s*([^]+?)\s*-->/g)]
    .map((match) => ({
      fileName: match[1].trim(),
      alt: match[2].trim(),
      caption: match[3].trim(),
    }));
}

function parseImageNotes(markdown) {
  const lines = markdown.split('\n');
  const headingIndex = lines.findIndex((line) => /^##\s+이미지 메모\s*$/.test(line));
  if (headingIndex === -1) {
    return [];
  }

  const sectionLines = [];
  for (const line of lines.slice(headingIndex + 1)) {
    if (/^##\s+/.test(line)) {
      break;
    }
    sectionLines.push(line);
  }

  return sectionLines
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2).split(/:\s*(.+)/))
    .filter(([fileName, note]) => fileName && note)
    .map(([fileName, note]) => ({
      fileName: fileName.trim(),
      note: note.trim(),
    }));
}

function renderImagePlan({ assetNames, inlineMarkers, imageNotes, missingAssets }) {
  return `# Image Plan

Automatic image placement is disabled in the MVP. This plan only reflects user-provided inline markers and image notes.

## Available Assets

${assetNames.length ? assetNames.map((asset) => `- ${asset}`).join('\n') : '- No files found in inputs/assets/.'}

## Inline Markers

${inlineMarkers.length ? inlineMarkers.map((marker) => `- ${marker.fileName}
  - alt: ${marker.alt}
  - caption: ${marker.caption}`).join('\n') : '- No inline image markers found.'}

## Image Notes

${imageNotes.length ? imageNotes.map((note) => `- ${note.fileName}: ${note.note}`).join('\n') : '- No image notes found.'}

## Missing assets

${missingAssets.length ? missingAssets.map((asset) => `- ${asset}`).join('\n') : '- None.'}
`;
}

function removeFirstTitle(markdown) {
  return markdown.replace(/^#\s+.+\n?/, '');
}
