import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import test from 'node:test';
import assert from 'node:assert/strict';

const execFileAsync = promisify(execFile);

test('blog-writer --help prints the CLI usage and available commands', async () => {
  const { stdout } = await execFileAsync(process.execPath, ['./bin/blog-writer.js', '--help']);

  assert.match(stdout, /Usage: blog-writer <command>/);
  assert.match(stdout, /profile\s+Analyze samples/);
  assert.match(stdout, /draft\s+Generate a blog writing package/);
  assert.match(stdout, /cover-prompt\s+Regenerate a cover image prompt/);
});
