#!/usr/bin/env node
import { bundle } from "./cli.js";

const HELP = `Usage: mastra-serverless-skills bundle <in> <out>

Walks <in> for skill folders (folders containing SKILL.md) and writes a
TypeScript module to <out> exporting:
  - skillsBundle: the path → content map BundledSkillSource consumes
  - skillsPaths:  the matching value for the Mastra Workspace \`skills\` config

Arguments:
  <in>   directory containing skill folders (e.g. ./skills or src/mastra/skills)
  <out>  output .ts file path (e.g. src/skills-bundle.ts)

Notes:
  - A skill folder is any directory that contains SKILL.md — either <in> itself
    or any (nested) subdirectory of it. Its references/, scripts/, and assets/
    subdirs are bundled alongside SKILL.md.
  - Hidden directories (.git, .claude, .next, etc.) and node_modules are skipped,
    so Claude Code skills under .claude/skills/ won't leak into the bundle.
  - Output keys are <basename(in)>/<relative path>; the exported skillsPaths
    is [<basename(in)>], so passing it as the \`skills\` config always matches.

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
  const rest = args.slice(1);
  if (rest.includes("--help") || rest.includes("-h")) {
    process.stdout.write(HELP);
    return;
  }
  const [inDir, outFile] = rest;
  if (!inDir || !outFile || rest.length > 2) {
    process.stderr.write(`Expected exactly 2 arguments: <in> <out>.\n\n${HELP}`);
    process.exit(1);
  }
  await bundle(inDir, outFile);
}

main().catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
