import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
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
  await mkdir(dirname(fullPath), { recursive: true });
  await writeFile(fullPath, content);
};

describe("bundleSkills", () => {
  it("collects text files into a `<basename(dir)>/...` keyed map", async () => {
    await writeFixture("skills/code-review/SKILL.md", "---\nname: code-review\n---\n");
    await writeFixture("skills/code-review/references/style.md", "# Style");
    await writeFixture("skills/commit-message/SKILL.md", "# Commit");

    const result = await bundleSkills(join(tempDir, "skills"));

    expect(Object.keys(result).sort()).toEqual([
      "skills/code-review/SKILL.md",
      "skills/code-review/references/style.md",
      "skills/commit-message/SKILL.md",
    ]);
    expect(result["skills/code-review/SKILL.md"]).toBe("---\nname: code-review\n---\n");
  });

  it("produces stable keys regardless of whether dir is relative or absolute", async () => {
    await writeFixture("skills/foo/SKILL.md", "# foo");

    const absolute = await bundleSkills(join(tempDir, "skills"));
    expect(Object.keys(absolute)).toEqual(["skills/foo/SKILL.md"]);
  });

  it("uses only the relative path when keyPrefix is empty", async () => {
    await writeFixture("skills/foo/SKILL.md", "# foo");

    const result = await bundleSkills(join(tempDir, "skills"), { keyPrefix: "" });
    expect(Object.keys(result)).toEqual(["foo/SKILL.md"]);
  });

  it("allows overriding keyPrefix", async () => {
    await writeFixture("skills/foo/SKILL.md", "# foo");

    const result = await bundleSkills(join(tempDir, "skills"), { keyPrefix: "custom" });
    expect(Object.keys(result)).toEqual(["custom/foo/SKILL.md"]);
  });

  it("skips non-text files by default", async () => {
    await writeFixture("skills/foo/SKILL.md", "# foo");
    await writeFixture("skills/foo/assets/logo.png", new Uint8Array([0x89, 0x50, 0x4e, 0x47]));

    const result = await bundleSkills(join(tempDir, "skills"));
    const keys = Object.keys(result);

    expect(keys).toContain("skills/foo/SKILL.md");
    expect(keys).not.toContain("skills/foo/assets/logo.png");
  });

  it("includes binary files as Uint8Array when includeBinary is true", async () => {
    await writeFixture("skills/foo/assets/logo.png", new Uint8Array([0x89, 0x50, 0x4e, 0x47]));

    const result = await bundleSkills(join(tempDir, "skills"), { includeBinary: true });
    const logo = result["skills/foo/assets/logo.png"];

    expect(logo).toBeInstanceOf(Uint8Array);
    expect(Array.from(logo as Uint8Array)).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  it("respects custom textExts", async () => {
    await writeFixture("skills/foo/SKILL.md", "# foo");
    await writeFixture("skills/foo/script.sh", "#!/bin/sh\necho hi");

    const result = await bundleSkills(join(tempDir, "skills"), { textExts: [".sh"] });
    const keys = Object.keys(result);

    expect(keys).toContain("skills/foo/script.sh");
    expect(keys).not.toContain("skills/foo/SKILL.md");
  });

  it("does not treat directory names with dots as extensions", async () => {
    await writeFixture("skills/v1.2/run", "no-extension content");
    await writeFixture("skills/v1.2/SKILL.md", "# v1.2");

    const result = await bundleSkills(join(tempDir, "skills"));

    expect(Object.keys(result)).toContain("skills/v1.2/SKILL.md");
    expect(Object.keys(result)).not.toContain("skills/v1.2/run");
  });

  it("produces deterministic key order (sorted by directory entry name)", async () => {
    await writeFixture("skills/z/SKILL.md", "z");
    await writeFixture("skills/a/SKILL.md", "a");
    await writeFixture("skills/m/SKILL.md", "m");

    const result = await bundleSkills(join(tempDir, "skills"));
    expect(Object.keys(result)).toEqual([
      "skills/a/SKILL.md",
      "skills/m/SKILL.md",
      "skills/z/SKILL.md",
    ]);
  });

  it("returns an empty object for an empty directory", async () => {
    await mkdir(join(tempDir, "skills"), { recursive: true });
    const result = await bundleSkills(join(tempDir, "skills"));
    expect(result).toEqual({});
  });
});
