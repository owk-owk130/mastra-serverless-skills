# CLAUDE.md

## What this package is

A Mastra `Workspace` extension that implements `SkillSource` from a bundled in-memory map, so Agent Skills work on edge / serverless runtimes (Cloudflare Workers, AWS Lambda, Vercel Edge).

The whole responsibility is the storage layer (`SkillSource` interface) plus a small CLI that generates a TS bundle from a skills directory. Skill discovery, glob, BM25 search, and tools come from `@mastra/core/workspace`.

## Commands

- `pnpm test` — vitest unit + integration
- `pnpm typecheck` — `tsc --noEmit`
- `pnpm lint` — `oxlint`
- `pnpm format` / `pnpm format:check` — `oxfmt`
- `pnpm build` — compile `src/` to `dist/` (excludes tests via `tsconfig.build.json`)
- `pnpm prepack` — clean + build, runs automatically before `pnpm pack` / publish

## Repo conventions

- **Tests are colocated** with sources (`src/foo.ts` + `src/foo.test.ts` + `src/foo.integration.test.ts`). No `test/` directory.
- **English-only**. README, comments, identifiers, commit messages.
- **No examples folder**. Working snippets live in README. No `examples/`.
- **No work-log markdown** (INVESTIGATION.md, NOTES.md, etc.). README + code are the only docs.
- **No TODO / Remaining-work sections** in docs. Use issues or conversation.

## Public surface

- Library entry (`mastra-serverless-skills`) → `BundledSkillSource`, `BundledSkillFiles` type.
- Bin entry (`mastra-serverless-skills` CLI) → `bundle <in> <out>` subcommand. Reads a skill directory and writes a TS module the runtime imports, exporting `skillsBundle` (path → content map) and `skillsPaths` (the matching `skills` config value).

The CLI lives in `src/bin.ts` (arg plumbing) + `src/cli.ts` (bundle logic). Both are Node-only — never import them from runtime code.

## Mastra integration

- All other skill machinery is Mastra's: import `Workspace`, `createSkillTools`, error classes (`FileNotFoundError`, `DirectoryNotFoundError`, `NotDirectoryError`) from `@mastra/core/workspace`.
- Don't reimplement what Mastra provides.
