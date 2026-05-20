import { readdir, readFile } from "node:fs/promises";
import { join, sep } from "node:path";
import type { BundledSkillFiles } from "./bundled-skill-source.js";

const DEFAULT_TEXT_EXTS = [".md", ".txt", ".json", ".yaml", ".yml", ".svg"];

export interface BundleSkillsOptions {
  /**
   * File extensions to read as UTF-8 text. Case-insensitive.
   * @default [".md", ".txt", ".json", ".yaml", ".yml", ".svg"]
   */
  textExts?: string[];
  /**
   * If true, files with non-text extensions are read as `Uint8Array`.
   * If false (default), they are skipped with a warning.
   * @default false
   */
  includeBinary?: boolean;
}

/**
 * Walk a directory and return a path → contents map suitable for `BundledSkillSource`.
 *
 * Intended for build-time use: read the user's skill files from disk during
 * the build step, write the result as JSON / TS, then import it from the
 * serverless runtime.
 *
 * @example
 * ```ts
 * // scripts/build-skills.mjs
 * import { bundleSkills } from "mastra-serverless-skills/build";
 * import { writeFile } from "node:fs/promises";
 *
 * const files = await bundleSkills("./skills");
 * await writeFile("./src/skills-bundle.json", JSON.stringify(files));
 * ```
 */
export async function bundleSkills(
  dir: string,
  options: BundleSkillsOptions = {},
): Promise<BundledSkillFiles> {
  const textExts = new Set((options.textExts ?? DEFAULT_TEXT_EXTS).map((e) => e.toLowerCase()));
  const includeBinary = options.includeBinary ?? false;
  const out: BundledSkillFiles = {};

  for await (const filePath of walk(dir)) {
    const lastDot = filePath.lastIndexOf(".");
    const ext = lastDot >= 0 ? filePath.slice(lastDot).toLowerCase() : "";
    const key = filePath.split(sep).join("/");

    if (textExts.has(ext)) {
      out[key] = await readFile(filePath, "utf-8");
    } else if (includeBinary) {
      out[key] = new Uint8Array(await readFile(filePath));
    } else {
      console.warn(`[bundleSkills] skipping non-text file: ${filePath}`);
    }
  }

  return out;
}

async function* walk(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else if (entry.isFile()) yield p;
  }
}
