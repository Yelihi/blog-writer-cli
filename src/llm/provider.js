export function resolveProvider(env = process.env) {
  return env.BLOG_WRITER_LLM_PROVIDER || null;
}

export function providerMissingMessage(taskName) {
  return `No LLM provider configured for task: ${taskName}

Set BLOG_WRITER_LLM_PROVIDER after a provider adapter is implemented.
Use \`blog-writer dry-run ${taskName}\` to generate prompt files without calling a model.
`;
}
