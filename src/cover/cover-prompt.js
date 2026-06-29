import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function runCoverPromptCommand(outputPackagePath, options = {}) {
  if (!outputPackagePath) {
    throw new Error('Output package not specified. Usage: blog-writer cover-prompt outputs/<slug>');
  }

  const cwd = options.cwd ?? process.cwd();
  return writeCoverPromptForPackage({
    packageRoot: join(cwd, outputPackagePath),
  });
}

export async function writeCoverPromptForPackage({ packageRoot }) {
  const publicDir = join(packageRoot, 'public');
  const workDir = join(packageRoot, 'work');
  const postPath = join(publicDir, 'post.md');
  const briefPath = join(workDir, 'brief.md');
  const imagePlanPath = join(publicDir, 'image-plan.md');
  const post = await readRequiredFile(postPath, `Post file not found: ${postPath}`);
  const brief = await readOptionalFile(briefPath);
  const imagePlan = await readOptionalFile(imagePlanPath);
  const title = extractTitle(post) || 'Untitled blog post';
  const audience = extractField(brief, 'Audience') || extractField(brief, '대상 독자') || 'General blog readers';
  const coverPromptPath = join(publicDir, 'cover-prompt.md');

  await mkdir(publicDir, { recursive: true });
  await writeFile(coverPromptPath, renderCoverPrompt({ title, audience, post, brief, imagePlan }), 'utf8');

  return {
    coverPromptPath,
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

function extractField(markdown, fieldName) {
  const escapedFieldName = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = markdown.match(new RegExp(`(?:^|\\n)\\s*-?\\s*${escapedFieldName}\\s*:\\s*(.+)`, 'i'));
  return match?.[1]?.trim() ?? '';
}

function summarizePost(markdown) {
  return markdown
    .replace(/^#\s+.+$/m, '')
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .find((part) => part && !part.startsWith('##') && !part.startsWith('<!--')) ?? '';
}

function summarizeImagePlan(imagePlan) {
  if (!imagePlan.trim()) {
    return 'No body image plan was available. Keep the cover independent from inline article images.';
  }

  const availableAssets = imagePlan.match(/## Available Assets\n\n([^#]+)/)?.[1]?.trim();
  const assetLines = availableAssets
    ?.split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('- .'));

  return assetLines?.length && !assetLines.some((line) => line.includes('No files found'))
    ? `Available body assets were listed, but the cover should be designed as a separate hero image. Asset notes:\n${assetLines.join('\n')}`
    : 'No usable body assets were listed. Create an original cover direction from the article topic.';
}

function renderCoverPrompt({ title, audience, post, brief, imagePlan }) {
  const summary = summarizePost(post);
  const visualDirection = deriveVisualDirection({ title, summary, brief });

  return `# Cover Image Prompt

This file does not generate an image. No actual image was generated.

Use this prompt with an external image generation tool, then review the result manually before publishing.

## Source

- Title: ${title}
- Audience: ${audience}
- Article summary: ${summary || 'Use the final post content as the primary source of truth.'}

## Prompt

Create a polished blog cover image for an article titled "${title}".

The image should feel editorial, clear, and suitable for readers described as: ${audience}.

Visual direction: ${visualDirection}

## Composition

- Use a horizontal blog cover composition with a strong focal point and generous negative space for layout cropping.
- Make the main subject instantly readable at thumbnail size.
- Follow a clean thumbnail-like layout inspired by the reference: spacious background, centered or lower-third title placement, and restrained supporting visual elements.
- Avoid placing important details near the edges.

## Color and mood

- Choose a balanced, modern palette that supports the article topic without becoming visually loud.
- Prefer natural contrast, thoughtful lighting, and a calm professional mood.
- Keep the image refined enough for a personal technical blog.

## Text in image

- Include the article title as clean Korean title text, placed around the center or lower third.
- Keep the Korean font modern, neat, and not too large; avoid oversized title treatment unless using a YouTube thumbnail-style cover.
- A YouTube thumbnail-style cover is acceptable when it remains clean, balanced, and suitable for a technical blog.
- Do not include extra readable text, logos, UI labels, watermarks, or fake typography beyond the title.

## Avoid

- Stock-photo cliches, generic office scenes, and decorative gradients with no subject.
- Distorted hands, faces, devices, or unreadable screen text.
- Overly literal symbols when a more editorial metaphor would be clearer.
- Any copyrighted characters, brand marks, or third-party logos.

## Asset notes

${summarizeImagePlan(imagePlan)}
`;
}

function deriveVisualDirection({ title, summary, brief }) {
  const source = `${title}\n${summary}\n${brief}`.toLowerCase();

  if (source.includes('ai') || source.includes('llm') || source.includes('prompt')) {
    return 'an elegant workspace where structured notes, subtle interface panels, and a focused light source suggest careful AI-assisted writing.';
  }

  if (source.includes('design') || source.includes('디자인')) {
    return 'a refined design desk scene with composition grids, layered visual references, and a clear editorial focal point.';
  }

  if (source.includes('개발') || source.includes('code') || source.includes('developer')) {
    return 'a clean technical editorial scene with abstract code structure, documentation notes, and a calm maker-focused atmosphere.';
  }

  return 'an editorial metaphor built from the article topic, using concrete objects and lighting rather than abstract decoration.';
}
