# CLAUDE.md

## What this package is

A Mastra `Workspace` extension that implements `SkillSource` from a bundled in-memory map, so Agent Skills work on edge / serverless runtimes (Cloudflare Workers, AWS Lambda, Vercel Edge).

The whole responsibility is the storage layer (`SkillSource` interface). Skill discovery, glob, BM25 search, and tools come from `@mastra/core/workspace`.

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

## Mastra integration

- The package surface is just `BundledSkillSource` (and the `BundledSkillFiles` type alias).
- All other skill machinery is Mastra's: import `Workspace`, `createSkillTools`, error classes (`FileNotFoundError`, `DirectoryNotFoundError`, `NotDirectoryError`) from `@mastra/core/workspace`.
- Don't reimplement what Mastra provides.
