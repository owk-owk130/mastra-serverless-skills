import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bundleSkills } from "./build.js";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "bundleSkills-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

const writeFixture = async (relativePath: string, content: string | Uint8Array): Promise<void> => {
  const fullPath = join(tempDir, relativePath);
  const parent = fullPath.slice(0, fullPath.lastIndexOf("/"));
  await mkdir(parent, { recursive: true });
  await writeFile(fullPath, content);
};

describe("bundleSkills", () => {
  it("collects text files from a directory tree into a path → content map", async () => {
    await writeFixture("skills/code-review/SKILL.md", "---\nname: code-review\n---\n");
    await writeFixture("skills/code-review/references/style.md", "# Style");
    await writeFixture("skills/commit-message/SKILL.md", "# Commit");

    const result = await bundleSkills(join(tempDir, "skills"));
    const keys = Object.keys(result).sort();

    expect(keys).toEqual([
      join(tempDir, "skills/code-review/SKILL.md").split(/[\\/]/).join("/"),
      join(tempDir, "skills/code-review/references/style.md").split(/[\\/]/).join("/"),
      join(tempDir, "skills/commit-message/SKILL.md").split(/[\\/]/).join("/"),
    ]);
    expect(result[keys[0]!]).toBe("---\nname: code-review\n---\n");
  });

  it("skips non-text files by default", async () => {
    await writeFixture("skills/foo/SKILL.md", "# foo");
    await writeFixture("skills/foo/assets/logo.png", new Uint8Array([0x89, 0x50, 0x4e, 0x47]));

    const result = await bundleSkills(join(tempDir, "skills"));
    const keys = Object.keys(result);

    expect(keys.some((k) => k.endsWith("SKILL.md"))).toBe(true);
    expect(keys.some((k) => k.endsWith("logo.png"))).toBe(false);
  });

  it("includes binary files as Uint8Array when includeBinary is true", async () => {
    await writeFixture("skills/foo/assets/logo.png", new Uint8Array([0x89, 0x50, 0x4e, 0x47]));

    const result = await bundleSkills(join(tempDir, "skills"), { includeBinary: true });
    const logoEntry = Object.entries(result).find(([k]) => k.endsWith("logo.png"));

    expect(logoEntry).toBeDefined();
    expect(logoEntry![1]).toBeInstanceOf(Uint8Array);
    expect(Array.from(logoEntry![1] as Uint8Array)).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  it("respects custom textExts", async () => {
    await writeFixture("skills/foo/SKILL.md", "# foo");
    await writeFixture("skills/foo/script.sh", "#!/bin/sh\necho hi");

    const result = await bundleSkills(join(tempDir, "skills"), { textExts: [".sh"] });
    const keys = Object.keys(result);

    expect(keys.some((k) => k.endsWith("script.sh"))).toBe(true);
    expect(keys.some((k) => k.endsWith("SKILL.md"))).toBe(false);
  });

  it("returns an empty object for an empty directory", async () => {
    await mkdir(join(tempDir, "skills"), { recursive: true });
    const result = await bundleSkills(join(tempDir, "skills"));
    expect(result).toEqual({});
  });
});
