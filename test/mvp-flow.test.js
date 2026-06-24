import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import test from 'node:test';
import assert from 'node:assert/strict';

const execFileAsync = promisify(execFile);
const cliPath = resolve('./bin/blog-writer.js');

test('sample project can run profile, draft, and cover-prompt end to end', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'blog-writer-mvp-flow-'));
  await mkdir(join(cwd, 'samples'), { recursive: true });
  await mkdir(join(cwd, 'inputs', 'assets'), { recursive: true });

  await writeFile(
    join(cwd, 'samples', 'sample-essay-01.md'),
    '# 도구를 고르는 기준\n\n먼저 왜 필요한지 적고, 실제로 써본 다음 장단점을 차분히 정리합니다.\n',
    'utf8',
  );
  await writeFile(
    join(cwd, 'samples', 'sample-essay-02.md'),
    '# 작은 자동화의 효용\n\n거창한 약속보다 반복 작업을 줄인 경험과 남은 한계를 함께 기록합니다.\n',
    'utf8',
  );
  await writeFile(
    join(cwd, 'inputs', 'draft.md'),
    `# 파일 기반 블로그 작성 파이프라인

원고를 먼저 파일로 정리하고, 작성자 스타일을 참고해 블로그 초안을 만드는 흐름을 설명합니다.

<!-- image: workflow-screen.png | alt: 파일 기반 블로그 작성 흐름 화면 | caption: 입력과 출력 폴더를 나누어 확인합니다. -->

## 이미지 메모

- workflow-screen.png: 본문 흐름 설명 아래
`,
    'utf8',
  );
  await writeFile(join(cwd, 'inputs', 'assets', 'workflow-screen.png'), 'placeholder image bytes', 'utf8');

  await execFileAsync(process.execPath, [cliPath, 'profile'], { cwd });
  const { stdout } = await execFileAsync(process.execPath, [cliPath, 'draft', 'inputs/draft.md'], { cwd });
  await execFileAsync(process.execPath, [cliPath, 'cover-prompt', 'outputs/파일-기반-블로그-작성-파이프라인'], { cwd });

  const publicRoot = join(cwd, 'outputs', '파일-기반-블로그-작성-파이프라인', 'public');
  const workRoot = join(cwd, 'outputs', '파일-기반-블로그-작성-파이프라인', 'work');
  const styleRules = await readFile(join(cwd, 'writer-style', 'style-rules.md'), 'utf8');
  const post = await readFile(join(publicRoot, 'post.md'), 'utf8');
  const imagePlan = await readFile(join(publicRoot, 'image-plan.md'), 'utf8');
  const coverPrompt = await readFile(join(publicRoot, 'cover-prompt.md'), 'utf8');
  const brief = await readFile(join(workRoot, 'brief.md'), 'utf8');
  const outline = await readFile(join(workRoot, 'outline.md'), 'utf8');
  const editNotes = await readFile(join(workRoot, 'edit-notes.md'), 'utf8');

  assert.match(stdout, /outputs\/파일-기반-블로그-작성-파이프라인\/public\/post\.md/);
  assert.match(styleRules, /# Style Rules/);
  assert.match(post, /# 파일 기반 블로그 작성 파이프라인/);
  assert.match(imagePlan, /workflow-screen\.png/);
  assert.match(coverPrompt, /# Cover Image Prompt/);
  assert.match(coverPrompt, /No actual image was generated/);
  assert.match(brief, /# Draft Brief/);
  assert.match(outline, /# Draft Outline/);
  assert.match(editNotes, /# Edit Notes/);
  assert.match(editNotes, /Framework-specific frontmatter was not added/);
});

test('README explains overview and real user workflow', async () => {
  const readme = await readFile('README.md', 'utf8');

  assert.match(readme, /## 개요/);
  assert.match(readme, /## 실제 사용자 사용 방법/);
  assert.match(readme, /blog-writer profile/);
  assert.match(readme, /blog-writer draft inputs\/draft\.md/);
  assert.match(readme, /blog-writer cover-prompt outputs\/<slug>/);
  assert.match(readme, /outputs\/<slug>\/public/);
  assert.match(readme, /outputs\/<slug>\/work/);
  assert.match(readme, /MVP 제한사항/);
  assert.match(readme, /실제 커버 이미지는 생성하지 않습니다/);
  assert.match(readme, /MDX/);
});
