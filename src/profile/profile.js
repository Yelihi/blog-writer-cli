import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { writeDryRunPromptPackage } from '../llm/prompt-package.js';

export async function runProfileCommand(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const samplesDir = join(cwd, 'samples');
  const writerStyleDir = join(cwd, 'writer-style');
  const dryRunRoot = join(cwd, '.blog-writer', 'dry-run');
  const samples = await readSamples(samplesDir);

  if (samples.length === 0) {
    throw new Error('No sample Markdown files found. Add existing posts to samples/ before running `blog-writer profile`.');
  }

  await mkdir(writerStyleDir, { recursive: true });

  const { packageDir } = await writeDryRunPromptPackage('profile', {
    outputRoot: dryRunRoot,
    contextSections: [
      {
        title: 'Author Sample Posts',
        body: renderSamples(samples),
      },
    ],
  });

  await writeFile(join(writerStyleDir, 'writer-profile.md'), renderWriterProfilePlaceholder(samples, packageDir), 'utf8');
  await writeFile(join(writerStyleDir, 'style-rules.md'), renderStyleRulesPlaceholder(samples, packageDir), 'utf8');

  return {
    sampleCount: samples.length,
    packageDir,
    writerProfilePath: join(writerStyleDir, 'writer-profile.md'),
    styleRulesPath: join(writerStyleDir, 'style-rules.md'),
  };
}

async function readSamples(samplesDir) {
  let entries;
  try {
    entries = await readdir(samplesDir, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }

  const markdownFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => entry.name)
    .sort();

  return Promise.all(markdownFiles.map(async (fileName) => ({
    fileName,
    content: await readFile(join(samplesDir, fileName), 'utf8'),
  })));
}

function renderSamples(samples) {
  return samples.map((sample) => `## ${sample.fileName}

\`\`\`md
${sample.content.trim()}
\`\`\``).join('\n\n');
}

function renderWriterProfilePlaceholder(samples, packageDir) {
  return `# Writer Profile

This file is a placeholder generated from ${samples.length} sample post(s).

Sample files:
${samples.map((sample) => `- ${sample.fileName}`).join('\n')}

Prompt package:
- ${packageDir}

Replace this placeholder with the model-generated writer profile after reviewing the dry-run prompt package.
`;
}

function renderStyleRulesPlaceholder(samples, packageDir) {
  return `# Style Rules

These placeholder rules should be replaced after model review. Future draft generation should read this file before writing posts.

Current sample basis:
${samples.map((sample) => `- ${sample.fileName}`).join('\n')}

Prompt package:
- ${packageDir}
`;
}
