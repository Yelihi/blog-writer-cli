import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import test from 'node:test';
import assert from 'node:assert/strict';

const execFileAsync = promisify(execFile);
const cliPath = resolve('./bin/blog-writer.js');

test('draft preserves the source post without forcing a generic structure', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'blog-writer-post-'));
  await mkdir(join(cwd, 'inputs'), { recursive: true });
  await mkdir(join(cwd, 'writer-style'), { recursive: true });
  await writeFile(
    join(cwd, 'inputs', 'draft.md'),
    '# 글쓰기 파이프라인 만들기\n\n초안을 정리하고 블로그 글로 바꾸는 흐름을 설명합니다.\n\n## 배경\n\n파일 기반으로 남겨야 재현성이 좋아집니다.\n',
    'utf8',
  );
  await writeFile(
    join(cwd, 'writer-style', 'style-rules.md'),
    '# Style Rules\n\n- 담백하게 설명한다.\n- 과장된 표현을 피한다.\n',
    'utf8',
  );

  await execFileAsync(process.execPath, [cliPath, 'draft', 'inputs/draft.md'], { cwd });

  const post = await readFile(join(cwd, 'outputs', '글쓰기-파이프라인-만들기', 'public', 'post.md'), 'utf8');
  const notes = await readFile(join(cwd, 'outputs', '글쓰기-파이프라인-만들기', 'work', 'edit-notes.md'), 'utf8');
  const prompt = await readFile(join(cwd, '.blog-writer', 'dry-run', 'draft-brief', 'prompt.md'), 'utf8');

  assert.match(post, /^# 글쓰기 파이프라인 만들기/m);
  assert.match(post, /## 배경/);
  assert.doesNotMatch(post, /## 머리말/);
  assert.doesNotMatch(post, /## 목차/);
  assert.doesNotMatch(post, /## 마무리/);
  assert.doesNotMatch(post, /^---$/m);
  assert.doesNotMatch(post, /<[^>]+>/);
  assert.match(notes, /# Edit Notes/);
  assert.match(notes, /writer-style\/style-rules\.md/);
  assert.match(notes, /Framework-specific frontmatter was not added/);
  assert.match(prompt, /담백하게 설명한다/);
});
