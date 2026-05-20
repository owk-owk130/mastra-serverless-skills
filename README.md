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

## Quick start

Skills live as folders on disk during development. Generate a bundle once at build time, then import it from the worker.

### 1. Add a build step

```js
// scripts/build-skills.mjs
import { bundleSkills } from "mastra-serverless-skills/build";
import { writeFile } from "node:fs/promises";

const files = await bundleSkills("./skills");
await writeFile("./src/skills-bundle.json", JSON.stringify(files));
```

Wire it as a pre-step so wrangler / esbuild always sees the latest bundle:

```json
{
  "scripts": {
    "predev": "node scripts/build-skills.mjs",
    "prebuild": "node scripts/build-skills.mjs",
    "predeploy": "node scripts/build-skills.mjs"
  }
}
```

### 2. Use it from the worker

```ts
import { Mastra } from "@mastra/core";
import { Agent } from "@mastra/core/agent";
import { Workspace, createSkillTools } from "@mastra/core/workspace";
import { BundledSkillSource } from "mastra-serverless-skills";
import bundle from "./skills-bundle.json" with { type: "json" };

const workspace = new Workspace({
  skills: ["skills"],
  skillSource: new BundledSkillSource(bundle),
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

`wrangler.toml` only needs `nodejs_compat`; the JSON loader is built in.

```toml
compatibility_flags = ["nodejs_compat"]
```

Run `mastra dev` to try it locally in the Playground at `http://localhost:4111` (needs an LLM provider API key, e.g. `ANTHROPIC_API_KEY`).

## Alternative: per-file imports

If you have a small skill set and don't want a build step, you can `import` each file directly:

```ts
import codeReviewSkill from "./skills/code-review/SKILL.md";
import styleGuide from "./skills/code-review/references/style-guide.md";

new BundledSkillSource({
  "skills/code-review/SKILL.md": codeReviewSkill,
  "skills/code-review/references/style-guide.md": styleGuide,
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

esbuild users pass `loader: { '.md': 'text' }`. Vite users can use `import.meta.glob('./skills/**/*', { eager: true, query: '?raw', import: 'default' })`.

## API

### `BundledSkillSource` (runtime)

```ts
import { BundledSkillSource } from "mastra-serverless-skills";

new BundledSkillSource(files: Record<string, string | Uint8Array>, options?: { buildTime?: Date });
```

- **files** — map from path → content. Keys are normalized: `./skills/foo`, `skills/foo`, `/skills/foo` all resolve to the same entry. Use `string` for text, `Uint8Array` for binary assets.
- **options.buildTime** — used as `stat()`'s `createdAt` / `modifiedAt`. Defaults to epoch.

### `bundleSkills` (build-time, Node-only)

```ts
import { bundleSkills } from "mastra-serverless-skills/build";

bundleSkills(dir: string, options?: {
  textExts?: string[];      // default: [".md", ".txt", ".json", ".yaml", ".yml", ".svg"]
  includeBinary?: boolean;  // default: false (skip + warn)
  keyPrefix?: string;       // default: basename(dir); pass "" to drop the prefix
}): Promise<Record<string, string | Uint8Array>>;
```

Walks `dir` recursively, returns the same shape `BundledSkillSource` consumes. Keys default to `<basename(dir)>/<relative path>` so absolute and relative `dir` arguments produce identical, portable output; override with `keyPrefix`.

> **Note**: `JSON.stringify` cannot represent a `Uint8Array` losslessly. If you set `includeBinary: true`, write the bundle as a `.ts` / `.js` module that reconstructs binary at module load (e.g., `Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))` or `Buffer.from(b64, "base64")`) instead of plain JSON.

### Skill file layout

Skill files must follow the [Anthropic Agent Skills spec](https://github.com/anthropics/skills): `SKILL.md` at the skill root with YAML frontmatter (`name`, `description` required), optional `references/`, `scripts/`, `assets/` subdirs.

## Platform notes

- **Cloudflare Workers** — Verified. ~1.7 MB bundle (gzip ~306 KB). Needs `nodejs_compat`.
- **AWS Lambda / Vercel Edge** — Same pattern, untested here. Bundle `.md` as text (esbuild: `loader: { '.md': 'text' }`), and use a runtime that polyfills the Node modules `@mastra/core/workspace` imports.

## License

MIT
