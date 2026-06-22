import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getTask } from './tasks.js';

export async function writeDryRunPromptPackage(taskName, options = {}) {
  const task = getTask(taskName);
  const outputRoot = options.outputRoot ?? '.blog-writer/dry-run';
  const packageDir = join(outputRoot, task.name);
  const promptTemplate = await readFile(task.templatePath, 'utf8');
  const metadata = {
    task: task.name,
    description: task.description,
    templatePath: task.templatePath,
    outputFiles: task.outputFiles,
    providerRequired: false,
    generatedAt: new Date().toISOString(),
  };

  await mkdir(packageDir, { recursive: true });
  await writeFile(join(packageDir, 'prompt.md'), renderPrompt(task, promptTemplate), 'utf8');
  await writeFile(join(packageDir, 'metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
  await writeFile(join(packageDir, 'README.md'), renderReadme(task), 'utf8');

  return { packageDir, task };
}

function renderPrompt(task, template) {
  return `# Blog Writer Prompt Package

Task: ${task.name}

Expected output files:
${task.outputFiles.map((file) => `- ${file}`).join('\n')}

---

${template}`;
}

function renderReadme(task) {
  return `# Dry-Run Prompt Package: ${task.name}

No model provider was called while generating this package.

Use this folder to inspect the exact prompt and metadata that a future provider adapter will receive.

Expected output files:
${task.outputFiles.map((file) => `- ${file}`).join('\n')}
`;
}
