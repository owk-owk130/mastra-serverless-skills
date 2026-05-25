#!/usr/bin/env node
import { bundle } from "./cli.js";

const HELP = `Usage: mastra-serverless-skills bundle <in> <out>

Walks <in> for skill folders (folders containing SKILL.md) and writes a
TypeScript module to <out> exporting the bundle in the shape
BundledSkillSource consumes.

Arguments:
  <in>   directory containing skill folders (e.g. ./skills or src/mastra/skills)
  <out>  output .ts file path (e.g. src/skills-bundle.ts)

Notes:
  - A skill folder is a subdirectory of <in> that contains SKILL.md.
    Its references/, scripts/, and assets/ subdirs are included.
  - Hidden directories (.git, .claude, .next, etc.) and node_modules are skipped,
    so Claude Code skills under .claude/skills/ won't leak into the bundle.
  - Output keys are <basename(in)>/<relative path>, matching the typical
    Mastra config \`skills: [<basename(in)>]\`.

Example:
  mastra-serverless-skills bundle src/mastra/skills src/mastra/skills-bundle.ts
`;

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    process.stdout.write(HELP);
    return;
  }
  if (args[0] !== "bundle") {
    process.stderr.write(`Unknown command: ${args[0]}\n\n${HELP}`);
    process.exit(1);
  }
  const [, inDir, outFile] = args;
  if (!inDir || !outFile) {
    process.stderr.write(`Missing arguments.\n\n${HELP}`);
    process.exit(1);
  }
  await bundle(inDir, outFile);
}

main().catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
