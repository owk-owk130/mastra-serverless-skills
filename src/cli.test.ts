import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, rm, readFile, rename } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { bundle } from "./cli.js";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "skills-cli-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

const writeFixture = async (relPath: string, content: string | Uint8Array): Promise<void> => {
  const full = join(tempDir, relPath);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, content);
};

type GeneratedModule = {
  skillsBundle: Record<string, string>;
  skillsPaths: string[];
};

const importGenerated = async (filePath: string): Promise<GeneratedModule> => {
  // Load the generated module via `import()` so we exercise the real TS source
  // shape instead of regex-parsing it (which is fragile against any `};` inside
  // bundled file contents). Rename to `.mjs` so Node treats it as ESM regardless
  // of the file's original extension.
  const mjsPath = filePath.endsWith(".mjs") ? filePath : `${filePath}.mjs`;
  if (mjsPath !== filePath) await rename(filePath, mjsPath);
  return (await import(`${pathToFileURL(mjsPath).href}?t=${Date.now()}`)) as GeneratedModule;
};

const importGeneratedBundle = async (filePath: string): Promise<Record<string, string>> =>
  (await importGenerated(filePath)).skillsBundle;

describe("bundle CLI logic", () => {
  it("bundles each skill folder's SKILL.md and references/", async () => {
    await writeFixture("skills/code-review/SKILL.md", "# code-review");
    await writeFixture("skills/code-review/references/style.md", "# style");
    await writeFixture("skills/commit-message/SKILL.md", "# commit");

    const out = join(tempDir, "out.ts");
    await bundle(join(tempDir, "skills"), out);
    const bundleObj = await importGeneratedBundle(out);

    expect(Object.keys(bundleObj).sort()).toEqual([
      "skills/code-review/SKILL.md",
      "skills/code-review/references/style.md",
      "skills/commit-message/SKILL.md",
    ]);
    expect(bundleObj["skills/code-review/SKILL.md"]).toBe("# code-review");
  });

  it("skips folders without SKILL.md (non-skill folders)", async () => {
    await writeFixture("skills/code-review/SKILL.md", "# skill");
    await writeFixture("skills/_shared/utils.md", "# not a skill");
    await writeFixture("skills/README.md", "# top-level docs");

    const out = join(tempDir, "out.ts");
    await bundle(join(tempDir, "skills"), out);
    const bundleObj = await importGeneratedBundle(out);

    expect(Object.keys(bundleObj)).toEqual(["skills/code-review/SKILL.md"]);
  });

  it("skips hidden directories and node_modules", async () => {
    await writeFixture("root/skills/foo/SKILL.md", "# foo");
    await writeFixture("root/.claude/skills/bar/SKILL.md", "# claude skill, ignore me");
    await writeFixture("root/node_modules/@pkg/skills/baz/SKILL.md", "# vendored, ignore me");

    const out = join(tempDir, "out.ts");
    await bundle(join(tempDir, "root"), out);
    const bundleObj = await importGeneratedBundle(out);

    expect(Object.keys(bundleObj)).toEqual(["root/skills/foo/SKILL.md"]);
  });

  it("warns and skips non-text files in references/scripts/assets", async () => {
    await writeFixture("skills/foo/SKILL.md", "# foo");
    await writeFixture("skills/foo/assets/logo.png", new Uint8Array([0x89, 0x50, 0x4e, 0x47]));

    const out = join(tempDir, "out.ts");
    await bundle(join(tempDir, "skills"), out);
    const bundleObj = await importGeneratedBundle(out);

    expect(Object.keys(bundleObj)).toEqual(["skills/foo/SKILL.md"]);
  });

  it("bundles common script extensions under scripts/", async () => {
    await writeFixture("skills/foo/SKILL.md", "# foo");
    await writeFixture("skills/foo/scripts/run.py", "print('hi')");
    await writeFixture("skills/foo/scripts/setup.sh", "#!/bin/sh\necho hi");
    await writeFixture("skills/foo/scripts/tool.ts", "export const x = 1;");

    const out = join(tempDir, "out.ts");
    await bundle(join(tempDir, "skills"), out);
    const bundleObj = await importGeneratedBundle(out);

    expect(Object.keys(bundleObj).sort()).toEqual([
      "skills/foo/SKILL.md",
      "skills/foo/scripts/run.py",
      "skills/foo/scripts/setup.sh",
      "skills/foo/scripts/tool.ts",
    ]);
    expect(bundleObj["skills/foo/scripts/run.py"]).toBe("print('hi')");
  });

  it("walks recursively to find nested skill folders", async () => {
    await writeFixture("skills/coding/code-review/SKILL.md", "# code-review");
    await writeFixture("skills/ops/incident-response/SKILL.md", "# incident");

    const out = join(tempDir, "out.ts");
    await bundle(join(tempDir, "skills"), out);
    const bundleObj = await importGeneratedBundle(out);

    expect(Object.keys(bundleObj).sort()).toEqual([
      "skills/coding/code-review/SKILL.md",
      "skills/ops/incident-response/SKILL.md",
    ]);
  });

  it("exports skillsPaths matching the key prefix (input directory basename)", async () => {
    await writeFixture("skills/foo/SKILL.md", "# foo");

    const out = join(tempDir, "out.ts");
    await bundle(join(tempDir, "skills"), out);
    const mod = await importGenerated(out);

    expect(mod.skillsPaths).toEqual(["skills"]);
    expect(Object.keys(mod.skillsBundle)).toEqual(["skills/foo/SKILL.md"]);
  });

  it("resolves the input path so '.'-style segments don't leak into keys", async () => {
    await writeFixture("skills/foo/SKILL.md", "# foo");

    const out = join(tempDir, "out.ts");
    // String concat on purpose: join() would normalize the trailing "/." away.
    await bundle(`${join(tempDir, "skills")}/.`, out);
    const mod = await importGenerated(out);

    expect(mod.skillsPaths).toEqual(["skills"]);
    expect(Object.keys(mod.skillsBundle)).toEqual(["skills/foo/SKILL.md"]);
  });

  it("throws when no skill folders are found", async () => {
    await mkdir(join(tempDir, "skills"), { recursive: true });
    await expect(bundle(join(tempDir, "skills"), join(tempDir, "out.ts"))).rejects.toThrow(
      /No skill folders/,
    );
  });

  it("emits valid TypeScript that defines `skillsBundle` and `skillsPaths`", async () => {
    const original = 'line\n\nwith "quotes" and ${interp} and \\backslash';
    await writeFixture("skills/foo/SKILL.md", original);

    const out = join(tempDir, "out.ts");
    await bundle(join(tempDir, "skills"), out);
    const src = await readFile(out, "utf-8");

    expect(src).toMatch(/^\/\/ Auto-generated by/);
    expect(src).toContain("export const skillsPaths = ");
    expect(src).toContain("export const skillsBundle = {");
    // Importing the module confirms the emitted source actually parses
    const parsed = await importGeneratedBundle(out);
    expect(parsed["skills/foo/SKILL.md"]).toBe(original);
  });
});
