import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import test from 'node:test';
import assert from 'node:assert/strict';

const execFileAsync = promisify(execFile);

test('dry-run writes a prompt package without requiring a provider', async () => {
  const outputRoot = await mkdtemp(join(tmpdir(), 'blog-writer-dry-run-'));

  const { stdout } = await execFileAsync(process.execPath, [
    './bin/blog-writer.js',
    'dry-run',
    'profile',
    '--output',
    outputRoot,
  ]);

  const packageDir = join(outputRoot, 'profile');
  const prompt = await readFile(join(packageDir, 'prompt.md'), 'utf8');
  const metadata = JSON.parse(await readFile(join(packageDir, 'metadata.json'), 'utf8'));
  const readme = await readFile(join(packageDir, 'README.md'), 'utf8');

  await stat(join(packageDir, 'prompt.md'));
  assert.match(stdout, /Dry-run prompt package written/);
  assert.match(prompt, /Task: profile/);
  assert.match(prompt, /writer-profile\.md/);
  assert.equal(metadata.task, 'profile');
  assert.equal(metadata.providerRequired, false);
  assert.match(readme, /No model provider was called/);
});

test('run-model explains that no provider is configured', async () => {
  await assert.rejects(
    execFileAsync(process.execPath, ['./bin/blog-writer.js', 'run-model', 'profile']),
    (error) => {
      assert.equal(error.code, 1);
      assert.match(error.stderr, /No LLM provider configured/);
      assert.match(error.stderr, /Use `blog-writer dry-run profile`/);
      return true;
    },
  );
});
