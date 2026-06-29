import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import test from 'node:test';
import assert from 'node:assert/strict';

const execFileAsync = promisify(execFile);
const cliPath = resolve('./bin/blog-writer.js');

test('draft writes cover-prompt.md without generating an image', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'blog-writer-cover-draft-'));
  await mkdir(join(cwd, 'inputs'), { recursive: true });
  await writeFile(
    join(cwd, 'inputs', 'draft.md'),
    '# 커버 이미지 만들기\n\n블로그 글에 맞는 커버 프롬프트를 준비합니다.\n',
    'utf8',
  );

  await execFileAsync(process.execPath, [cliPath, 'draft', 'inputs/draft.md'], { cwd });

  const prompt = await readFile(join(cwd, 'outputs', '커버-이미지-만들기', 'public', 'cover-prompt.md'), 'utf8');

  assert.match(prompt, /# Cover Image Prompt/);
  assert.match(prompt, /커버 이미지 만들기/);
  assert.match(prompt, /Composition/);
  assert.match(prompt, /Color and mood/);
  assert.match(prompt, /Text in image/);
  assert.match(prompt, /Korean title text/);
  assert.match(prompt, /YouTube thumbnail-style cover/);
  assert.doesNotMatch(prompt, /Do not include readable text/);
  assert.match(prompt, /Avoid/);
  assert.match(prompt, /This file does not generate an image/);
});

test('cover-prompt command regenerates cover-prompt.md from an output package', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'blog-writer-cover-command-'));
  const packageRoot = join(cwd, 'outputs', 'sample-post');
  await mkdir(join(packageRoot, 'public'), { recursive: true });
  await mkdir(join(packageRoot, 'work'), { recursive: true });
  await writeFile(join(packageRoot, 'public', 'post.md'), '# 샘플 글\n\n본문입니다.\n', 'utf8');
  await writeFile(join(packageRoot, 'work', 'brief.md'), '# Draft Brief\n\nAudience: 개인 블로그 독자\n', 'utf8');

  const { stdout } = await execFileAsync(process.execPath, [cliPath, 'cover-prompt', 'outputs/sample-post'], { cwd });
  const prompt = await readFile(join(packageRoot, 'public', 'cover-prompt.md'), 'utf8');

  assert.match(stdout, /Cover prompt written/);
  assert.match(prompt, /샘플 글/);
  assert.match(prompt, /개인 블로그 독자/);
  assert.match(prompt, /No actual image was generated/);
});
