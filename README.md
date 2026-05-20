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

## Minimal usage

```ts
import { Mastra } from "@mastra/core";
import { Agent } from "@mastra/core/agent";
import { Workspace, createSkillTools } from "@mastra/core/workspace";
import { BundledSkillSource } from "mastra-serverless-skills";

import codeReviewSkill from "./skills/code-review/SKILL.md";
import styleGuide from "./skills/code-review/references/style-guide.md";

const workspace = new Workspace({
  skills: ["skills"],
  skillSource: new BundledSkillSource({
    "skills/code-review/SKILL.md": codeReviewSkill,
    "skills/code-review/references/style-guide.md": styleGuide,
  }),
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

Run `mastra dev` to try it in the Playground at `http://localhost:4111` (needs an LLM provider API key, e.g. `ANTHROPIC_API_KEY`).

## Bundling many skill files

When a skill has multiple references / scripts / assets, writing an `import` per file gets tedious. The `bundleSkills` helper reads a directory at build time and returns a ready-to-pass file map.

```js
// scripts/build-skills.mjs
import { bundleSkills } from "mastra-serverless-skills/build";
import { writeFile } from "node:fs/promises";

const files = await bundleSkills("./skills");
await writeFile("./src/skills-bundle.json", JSON.stringify(files));
```

Wire it as a pre-step in `package.json` so wrangler/esbuild always sees the latest bundle:

```json
{
  "scripts": {
    "predev": "node scripts/build-skills.mjs",
    "prebuild": "node scripts/build-skills.mjs",
    "predeploy": "node scripts/build-skills.mjs"
  }
}
```

Then the worker just imports the JSON — no per-file `import` statements, no wrangler text rule needed:

```ts
import { BundledSkillSource } from "mastra-serverless-skills";
import bundle from "./skills-bundle.json" with { type: "json" };

new BundledSkillSource(bundle);
```

`bundleSkills` reads `.md` / `.txt` / `.json` / `.yaml` / `.yml` / `.svg` as text by default. Pass `includeBinary: true` to also read other files as `Uint8Array`, or `textExts: [...]` to override the text extension list.

## Deploying to Cloudflare Workers

If you use the manual import pattern above (without `bundleSkills`), `wrangler.toml` needs `nodejs_compat` and a text rule so `.md` imports resolve to strings at build time:

```toml
compatibility_flags = ["nodejs_compat"]

[[rules]]
type = "Text"
globs = ["**/skills/**/*.md"]
fallthrough = false
```

When using `bundleSkills` + JSON import, only `nodejs_compat` is required (the JSON loader is built in).

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
}): Promise<Record<string, string | Uint8Array>>;
```

Walks `dir` recursively, returns the same shape `BundledSkillSource` consumes.

Skill files must follow the [Anthropic Agent Skills spec](https://github.com/anthropics/skills): `SKILL.md` at the skill root with YAML frontmatter (`name`, `description` required), optional `references/`, `scripts/`, `assets/` subdirs.

## Platform notes

- **Cloudflare Workers** — Verified. ~1.7 MB bundle (gzip ~306 KB). Needs `nodejs_compat`.
- **AWS Lambda / Vercel Edge** — Same pattern, untested here. Bundle `.md` as text (esbuild: `loader: { '.md': 'text' }`), and use a runtime that polyfills the Node modules `@mastra/core/workspace` imports.

## License

MIT
