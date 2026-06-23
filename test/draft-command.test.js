import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import test from 'node:test';
import assert from 'node:assert/strict';

const execFileAsync = promisify(execFile);
const cliPath = resolve('./bin/blog-writer.js');

test('draft explains when the input file is missing', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'blog-writer-missing-draft-'));

  await assert.rejects(
    execFileAsync(process.execPath, [cliPath, 'draft', 'inputs/missing.md'], { cwd }),
    (error) => {
      assert.equal(error.code, 1);
      assert.match(error.stderr, /Draft input not found/);
      assert.match(error.stderr, /inputs\/missing\.md/);
      return true;
    },
  );
});

test('draft writes brief and outline work files using style rules when present', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'blog-writer-draft-'));
  await mkdir(join(cwd, 'inputs'), { recursive: true });
  await mkdir(join(cwd, 'writer-style'), { recursive: true });
  await writeFile(
    join(cwd, 'inputs', 'draft.md'),
    '# 블로그 원고 정리하기\n\n초안을 파일 기반 CLI로 정리하는 과정을 설명합니다.\n',
    'utf8',
  );
  await writeFile(
    join(cwd, 'writer-style', 'style-rules.md'),
    '# Style Rules\n\n- 담백하게 설명한다.\n- 과장된 표현을 피한다.\n',
    'utf8',
  );

  const { stdout } = await execFileAsync(process.execPath, [cliPath, 'draft', 'inputs/draft.md'], { cwd });

  const brief = await readFile(join(cwd, 'outputs', '블로그-원고-정리하기', 'work', 'brief.md'), 'utf8');
  const outline = await readFile(join(cwd, 'outputs', '블로그-원고-정리하기', 'work', 'outline.md'), 'utf8');
  const prompt = await readFile(join(cwd, '.blog-writer', 'dry-run', 'draft-brief', 'prompt.md'), 'utf8');

  assert.match(stdout, /Draft work files written/);
  assert.match(brief, /# Draft Brief/);
  assert.match(brief, /inputs\/draft\.md/);
  assert.match(outline, /# Draft Outline/);
  assert.match(outline, /블로그 원고 정리하기/);
  assert.match(prompt, /Task: draft-brief/);
  assert.match(prompt, /담백하게 설명한다/);
});
