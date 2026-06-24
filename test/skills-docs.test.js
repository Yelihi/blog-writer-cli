import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

test('Codex skill document delegates blog writing work to the CLI', async () => {
  const skill = await readFile('skills/codex-blog-writer/SKILL.md', 'utf8');

  assert.match(skill, /name: codex-blog-writer/);
  assert.match(skill, /blog-writer profile/);
  assert.match(skill, /blog-writer draft inputs\/draft\.md/);
  assert.match(skill, /blog-writer cover-prompt outputs\/<slug>/);
  assert.match(skill, /writer-style\/style-rules\.md/);
  assert.match(skill, /Do not reimplement/);
  assert.match(skill, /docs\/checklists\/blog-writer-review\.md/);
});

test('Claude Code skill document gives the same thin CLI workflow', async () => {
  const skill = await readFile('skills/claude-code-blog-writer/SKILL.md', 'utf8');

  assert.match(skill, /name: claude-code-blog-writer/);
  assert.match(skill, /blog-writer profile/);
  assert.match(skill, /blog-writer draft inputs\/draft\.md/);
  assert.match(skill, /blog-writer cover-prompt outputs\/<slug>/);
  assert.match(skill, /writer-style\/writer-profile\.md/);
  assert.match(skill, /Do not duplicate/);
  assert.match(skill, /docs\/checklists\/blog-writer-review\.md/);
});

test('review checklist covers inputs, style files, public outputs, and internal work files', async () => {
  const checklist = await readFile('docs/checklists/blog-writer-review.md', 'utf8');

  assert.match(checklist, /inputs\/draft\.md/);
  assert.match(checklist, /inputs\/assets\//);
  assert.match(checklist, /writer-style\/writer-profile\.md/);
  assert.match(checklist, /writer-style\/style-rules\.md/);
  assert.match(checklist, /outputs\/<slug>\/public\/post\.md/);
  assert.match(checklist, /outputs\/<slug>\/public\/image-plan\.md/);
  assert.match(checklist, /outputs\/<slug>\/public\/cover-prompt\.md/);
  assert.match(checklist, /outputs\/<slug>\/work\/brief\.md/);
  assert.match(checklist, /outputs\/<slug>\/work\/outline\.md/);
  assert.match(checklist, /outputs\/<slug>\/work\/edit-notes\.md/);
});
