# mastra-serverless-skills

A [Mastra](https://mastra.ai) `Workspace` extension that makes Agent Skills work on edge / serverless runtimes — Cloudflare Workers, AWS Lambda, Vercel Edge, and other environments without `node:fs`.

It plugs into the official `skillSource` hook with an in-memory `BundledSkillSource`, so Mastra's skill discovery, glob support, BM25 search, and the `skill` / `skill_search` / `skill_read` tools work unchanged.

## Install

```sh
pnpm add mastra-serverless-skills
# or
npm install mastra-serverless-skills
# or
yarn add mastra-serverless-skills
# or
bun add mastra-serverless-skills
```

## Usage

Two ways to bundle skills, pick whichever fits your project:

| Pattern                             | Good for                                                            | Setup                                              |
| ----------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------- |
| **A. CLI** (below)                  | Many skills, multiple references per skill, prefer one moving piece | `mastra-serverless-skills bundle` in an npm script |
| **B. Hand-written imports** (below) | A handful of skills, want no build step / no generated files        | `import` each file, build a small map yourself     |

Both end up calling `new BundledSkillSource(map)`; pattern only affects how you produce the map.

### Pattern A: CLI

Add the CLI as a pre-step so wrangler / esbuild always sees the latest bundle:

```json
{
  "scripts": {
    "predev": "mastra-serverless-skills bundle src/mastra/skills src/mastra/skills-bundle.ts",
    "prebuild": "mastra-serverless-skills bundle src/mastra/skills src/mastra/skills-bundle.ts",
    "predeploy": "mastra-serverless-skills bundle src/mastra/skills src/mastra/skills-bundle.ts"
  }
}
```

The first argument is the directory that contains your skill folders; the second is the generated file. Add the generated file to `.gitignore` — it's regenerated on every build.

```ts
import { Mastra } from "@mastra/core";
import { Agent } from "@mastra/core/agent";
import { Workspace, createSkillTools } from "@mastra/core/workspace";
import { BundledSkillSource } from "mastra-serverless-skills";
import { skillsBundle } from "./mastra/skills-bundle";

const workspace = new Workspace({
  skills: ["skills"],
  skillSource: new BundledSkillSource(skillsBundle),
  bm25: true,
});

export const mastra = new Mastra({
  agents: {
    skillsAgent: new Agent({
      name: "skills-agent",
      model: "anthropic/claude-haiku-4-5",
      instructions: "Use skills when relevant.",
      tools: createSkillTools(workspace.skills!),
    }),
  },
});
```

`wrangler.toml` only needs `nodejs_compat`:

```toml
compatibility_flags = ["nodejs_compat"]
```

### Pattern B: Hand-written imports

`import` each skill file directly and build the map inline:

```ts
import { Workspace } from "@mastra/core/workspace";
import { BundledSkillSource } from "mastra-serverless-skills";

import codeReviewSkill from "./skills/code-review/SKILL.md";
import styleGuide from "./skills/code-review/references/style-guide.md";

new Workspace({
  skills: ["skills"],
  skillSource: new BundledSkillSource({
    "skills/code-review/SKILL.md": codeReviewSkill,
    "skills/code-review/references/style-guide.md": styleGuide,
  }),
});
```

For this to work in Cloudflare Workers, `wrangler.toml` needs a text rule so `.md` imports resolve to strings:

```toml
compatibility_flags = ["nodejs_compat"]

[[rules]]
type = "Text"
globs = ["**/skills/**/*.md"]
fallthrough = false
```

esbuild users pass `loader: { '.md': 'text' }`. Vite users can collapse the imports with `import.meta.glob('./skills/**/*', { eager: true, query: '?raw', import: 'default' })`.

Run `mastra dev` to try either pattern locally in the Playground at `http://localhost:4111` (needs an LLM provider API key, e.g. `ANTHROPIC_API_KEY`).

## CLI

```
mastra-serverless-skills bundle <in> <out>
```

- **`<in>`** — directory containing skill folders. Common layouts:
  - `./skills` (Anthropic Agent Skills spec convention)
  - `./src/mastra/skills` (typical Mastra starter)
  - `./content/skills` etc.
- **`<out>`** — output `.ts` file path. The file exports `const skillsBundle: Record<string, string>` containing every skill folder's `SKILL.md` + `references/` + `scripts/` + `assets/` (text files only).

Behaviour:

- A **skill folder** is a directory containing `SKILL.md` directly. The walker stops recursing once one is found (skills don't nest).
- Output keys are `<basename(in)>/<relative path>`, so a typical Mastra config like `skills: ["skills"]` lines up with `bundle src/mastra/skills ...` (basename `skills`).
- Hidden directories (`.git`, `.claude`, `.next`, etc.) and `node_modules` are skipped — Claude Code skills under `.claude/skills/` are **not** picked up.
- Non-text files (anything outside `.md` / `.txt` / `.json` / `.yaml` / `.yml` / `.svg` / `.html` / `.css`) are skipped with a warning. For binary assets, construct the map yourself and pass directly to `BundledSkillSource`.

## API

### `BundledSkillSource`

```ts
import { BundledSkillSource } from "mastra-serverless-skills";

new BundledSkillSource(files: Record<string, string | Uint8Array>, options?: { buildTime?: Date });
```

- **files** — map from path → content. Keys are normalized: `./skills/foo`, `skills/foo`, `/skills/foo` all resolve to the same entry. Use `string` for text, `Uint8Array` for binary assets.
- **options.buildTime** — used as `stat()`'s `createdAt` / `modifiedAt`. Defaults to epoch.

### Skill file layout

Skill files must follow the [Anthropic Agent Skills spec](https://github.com/anthropics/skills): `SKILL.md` at the skill root with YAML frontmatter (`name`, `description` required), optional `references/`, `scripts/`, `assets/` subdirs.

## Platform notes

- **Cloudflare Workers** — Verified. ~1.7 MB bundle (gzip ~306 KB). Needs `nodejs_compat`.
- **AWS Lambda / Vercel Edge** — Same pattern, untested here. Use a runtime that polyfills the Node modules `@mastra/core/workspace` imports.

## License

MIT
