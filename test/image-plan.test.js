import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import test from 'node:test';
import assert from 'node:assert/strict';

const execFileAsync = promisify(execFile);
const cliPath = resolve('./bin/blog-writer.js');

test('draft writes image-plan.md from inline image markers and image notes', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'blog-writer-image-plan-'));
  await mkdir(join(cwd, 'inputs', 'assets'), { recursive: true });
  await writeFile(join(cwd, 'inputs', 'assets', 'photo-01.jpg'), 'fake image bytes', 'utf8');
  await writeFile(
    join(cwd, 'inputs', 'draft.md'),
    `# 이미지가 있는 글

도입 문단입니다.

<!-- image: photo-01.jpg | alt: 작업 전 화면 | caption: 초기 상태 -->

## 과정

이미지 메모도 함께 씁니다.

## 이미지 메모

- photo-01.jpg: 도입부 아래
- missing.jpg: 문제 해결 과정 섹션
`,
    'utf8',
  );

  await execFileAsync(process.execPath, [cliPath, 'draft', 'inputs/draft.md'], { cwd });

  const plan = await readFile(join(cwd, 'outputs', '이미지가-있는-글', 'public', 'image-plan.md'), 'utf8');

  assert.match(plan, /# Image Plan/);
  assert.match(plan, /Inline Markers/);
  assert.match(plan, /photo-01\.jpg/);
  assert.match(plan, /작업 전 화면/);
  assert.match(plan, /초기 상태/);
  assert.match(plan, /Image Notes/);
  assert.match(plan, /도입부 아래/);
  assert.match(plan, /missing\.jpg/);
  assert.match(plan, /Missing assets/);
  assert.match(plan, /Automatic image placement is disabled/);
});
