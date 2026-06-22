export const TASKS = {
  profile: {
    name: 'profile',
    templatePath: 'prompts/profile.md',
    outputFiles: ['writer-style/writer-profile.md', 'writer-style/style-rules.md'],
    description: 'Analyze samples and generate writer style guidance.',
  },
  'draft-brief': {
    name: 'draft-brief',
    templatePath: 'prompts/draft-brief.md',
    outputFiles: ['outputs/<slug>/work/brief.md', 'outputs/<slug>/work/outline.md'],
    description: 'Analyze an input draft and prepare the drafting brief.',
  },
  'cover-prompt': {
    name: 'cover-prompt',
    templatePath: 'prompts/cover-prompt.md',
    outputFiles: ['outputs/<slug>/public/cover-prompt.md'],
    description: 'Prepare a reusable cover image prompt.',
  },
};

export function getTask(taskName) {
  const task = TASKS[taskName];
  if (!task) {
    const knownTasks = Object.keys(TASKS).join(', ');
    throw new Error(`Unknown LLM task: ${taskName}. Available tasks: ${knownTasks}`);
  }
  return task;
}
