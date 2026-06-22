#!/usr/bin/env node

import { writeDryRunPromptPackage } from '../src/llm/prompt-package.js';
import { providerMissingMessage, resolveProvider } from '../src/llm/provider.js';

const helpText = `Usage: blog-writer <command> [options]

File-based CLI pipeline for turning drafts into blog writing packages.

Commands:
  profile        Analyze samples and generate writer style guidance
  draft          Generate a blog writing package from an input draft
  cover-prompt   Regenerate a cover image prompt for an output package
  dry-run        Generate an LLM prompt package without calling a provider
  run-model      Run an LLM task through a configured provider

Options:
  -h, --help     Show this help message
  -v, --version  Show the CLI version
`;

async function main(argv) {
  const [command, ...args] = argv;

  if (!command || command === '--help' || command === '-h') {
    process.stdout.write(helpText);
    return 0;
  }

  if (command === '--version' || command === '-v') {
    process.stdout.write('0.1.0\n');
    return 0;
  }

  if (command === 'dry-run') {
    return handleDryRun(args);
  }

  if (command === 'run-model') {
    return handleRunModel(args);
  }

  process.stderr.write(`Unknown command: ${command}\n\n${helpText}`);
  return 1;
}

async function handleDryRun(args) {
  const taskName = args[0];
  if (!taskName || taskName === '--help' || taskName === '-h') {
    process.stdout.write(`Usage: blog-writer dry-run <task> [--output <directory>]

Tasks:
  profile
  draft-brief
  cover-prompt
`);
    return taskName ? 0 : 1;
  }

  const outputRoot = readOption(args.slice(1), '--output') ?? '.blog-writer/dry-run';
  const { packageDir } = await writeDryRunPromptPackage(taskName, { outputRoot });

  process.stdout.write(`Dry-run prompt package written: ${packageDir}\n`);
  return 0;
}

function handleRunModel(args) {
  const taskName = args[0];
  if (!taskName || taskName === '--help' || taskName === '-h') {
    process.stdout.write(`Usage: blog-writer run-model <task>

Runs a task through a configured LLM provider.
`);
    return taskName ? 0 : 1;
  }

  const provider = resolveProvider();
  if (!provider) {
    process.stderr.write(providerMissingMessage(taskName));
    return 1;
  }

  process.stderr.write(`Provider '${provider}' is not implemented yet.\n`);
  return 1;
}

function readOption(args, optionName) {
  const index = args.indexOf(optionName);
  if (index === -1) {
    return null;
  }
  return args[index + 1] ?? null;
}

try {
  process.exitCode = await main(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
