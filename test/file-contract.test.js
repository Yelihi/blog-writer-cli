import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

test('file contract documentation defines source, input, output, and image marker rules', async () => {
  const contract = await readFile('docs/file-contract.md', 'utf8');

  assert.match(contract, /samples\//);
  assert.match(contract, /writer-style\//);
  assert.match(contract, /inputs\/draft\.md/);
  assert.match(contract, /inputs\/assets\//);
  assert.match(contract, /outputs\/<slug>\/public/);
  assert.match(contract, /outputs\/<slug>\/work/);
  assert.match(contract, /<!-- image: file-name\.jpg \| alt: .* \| caption: .* -->/);
  assert.match(contract, /Slug Rules/);
});

test('sample draft template shows image markers and image notes', async () => {
  const draft = await readFile('inputs/draft.md', 'utf8');

  assert.match(draft, /<!-- image: photo-01\.jpg \| alt: .* \| caption: .* -->/);
  assert.match(draft, /## 이미지 메모/);
  assert.match(draft, /photo-02\.jpg: /);
});
