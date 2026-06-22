import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import test from 'node:test';
import assert from 'node:assert/strict';

const execFileAsync = promisify(execFile);
const cliPath = resolve('./bin/blog-writer.js');

test('profile explains when samples are empty', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'blog-writer-empty-samples-'));
  await mkdir(join(cwd, 'samples'));

  await assert.rejects(
    execFileAsync(process.execPath, [cliPath, 'profile'], { cwd }),
    (error) => {
      assert.equal(error.code, 1);
      assert.match(error.stderr, /No sample Markdown files found/);
      assert.match(error.stderr, /Add existing posts to samples\//);
      return true;
    },
  );
});

test('profile reads sample posts and writes style outputs plus prompt package', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'blog-writer-profile-'));
  await mkdir(join(cwd, 'samples'));
  await writeFile(
    join(cwd, 'samples', 'post-001.md'),
    '# 첫 번째 글\n\n차분하게 문제를 설명하고 직접 해본 내용을 정리합니다.\n',
    'utf8',
  );
  await writeFile(
    join(cwd, 'samples', 'post-002.md'),
    '# 두 번째 글\n\n과장 없이 배경, 과정, 결론 순서로 정리합니다.\n',
    'utf8',
  );

  const { stdout } = await execFileAsync(process.execPath, [cliPath, 'profile'], { cwd });

  const profile = await readFile(join(cwd, 'writer-style', 'writer-profile.md'), 'utf8');
  const rules = await readFile(join(cwd, 'writer-style', 'style-rules.md'), 'utf8');
  const prompt = await readFile(join(cwd, '.blog-writer', 'dry-run', 'profile', 'prompt.md'), 'utf8');

  assert.match(stdout, /Writer style files written/);
  assert.match(profile, /# Writer Profile/);
  assert.match(profile, /post-001\.md/);
  assert.match(rules, /# Style Rules/);
  assert.match(rules, /draft/);
  assert.match(prompt, /Task: profile/);
  assert.match(prompt, /post-002\.md/);
});
