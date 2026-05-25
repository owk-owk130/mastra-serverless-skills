# mastra-serverless-skills

A [Mastra](https://mastra.ai) `Workspace` extension that ships Agent Skills to edge / serverless runtimes — Cloudflare Workers, AWS Lambda, Vercel Edge, and anywhere else without `node:fs`.

It plugs into Mastra's official `skillSource` hook with an in-memory `BundledSkillSource`. Discovery, glob support, BM25 search, and the `skill` / `skill_search` / `skill_read` tools all keep working unchanged.

## Install

```sh
pnpm add mastra-serverless-skills
# or: npm install / yarn add / bun add
```

## Usage

Two ways to build the `path → content` map that `BundledSkillSource` consumes. Both are first-class — pick whichever fits.

| Pattern                     | Good for                                   | Setup                                              |
| --------------------------- | ------------------------------------------ | -------------------------------------------------- |
| **A. CLI**                  | Many skills, multiple references per skill | `mastra-serverless-skills bundle` in an npm script |
| **B. Hand-written imports** | A handful of skills, no build step         | `import` each file, build the map inline           |

### Pattern A: CLI

Pre-step in `package.json` so wrangler / esbuild always sees the latest bundle:

```json
{
  "scripts": {
    "predev": "mastra-serverless-skills bundle src/mastra/skills src/mastra/skills-bundle.ts",
    "prebuild": "mastra-serverless-skills bundle src/mastra/skills src/mastra/skills-bundle.ts"
  }
}
```

Add the generated file to `.gitignore` — it's regenerated on every build.

```ts
import { Workspace } from "@mastra/core/workspace";
import { BundledSkillSource } from "mastra-serverless-skills";
import { skillsBundle } from "./mastra/skills-bundle";

new Workspace({
  skills: ["skills"],
  skillSource: new BundledSkillSource(skillsBundle),
});
```

### Pattern B: Hand-written imports

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

For Cloudflare Workers, `wrangler.toml` needs a text rule so `.md` imports resolve to strings:

```toml
[[rules]]
type = "Text"
globs = ["**/skills/**/*.md"]
fallthrough = false
```

## CLI

```
mastra-serverless-skills bundle <in> <out>
```

Walks `<in>` for **skill folders** (directories containing `SKILL.md`) and writes a TypeScript module to `<out>` exporting `const skillsBundle`.

- Output keys: `<basename(in)>/<relative path>`, so `bundle src/mastra/skills ...` lines up with `skills: ["skills"]` (basename `skills`).
- Hidden dirs (`.git`, `.claude`, `.next`, …) and `node_modules` are skipped — Claude Code skills under `.claude/skills/` are **not** included.
- Text-only (`.md` / `.txt` / `.json` / `.yaml` / `.yml` / `.svg` / `.html` / `.css`). Non-text files are skipped with a warning; for binary assets construct the map yourself.

## API

```ts
import { BundledSkillSource } from "mastra-serverless-skills";

new BundledSkillSource(files: Record<string, string | Uint8Array>, options?: { buildTime?: Date });
```

- **files** — path → content map. Keys normalize so `./skills/foo`, `skills/foo`, `/skills/foo` all resolve to the same entry.
- **options.buildTime** — used as `stat()`'s `createdAt` / `modifiedAt`. Defaults to epoch.

## License

MIT
