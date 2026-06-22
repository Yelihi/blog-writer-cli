#!/usr/bin/env node

const helpText = `Usage: blog-writer <command> [options]

File-based CLI pipeline for turning drafts into blog writing packages.

Commands:
  profile        Analyze samples and generate writer style guidance
  draft          Generate a blog writing package from an input draft
  cover-prompt   Regenerate a cover image prompt for an output package

Options:
  -h, --help     Show this help message
  -v, --version  Show the CLI version
`;

function main(argv) {
  const [command] = argv;

  if (!command || command === '--help' || command === '-h') {
    process.stdout.write(helpText);
    return 0;
  }

  if (command === '--version' || command === '-v') {
    process.stdout.write('0.1.0\n');
    return 0;
  }

  process.stderr.write(`Unknown command: ${command}\n\n${helpText}`);
  return 1;
}

process.exitCode = main(process.argv.slice(2));
