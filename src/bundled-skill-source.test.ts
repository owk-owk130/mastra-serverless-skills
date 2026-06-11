import { describe, it, expect } from "vitest";
import {
  DirectoryNotFoundError,
  FileNotFoundError,
  NotDirectoryError,
} from "@mastra/core/workspace";
import { BundledSkillSource } from "./bundled-skill-source.js";

const CODE_REVIEW_SKILL = `---
name: code-review
description: Reviews code for quality, style, and potential issues
---

# Code Review

You are a code reviewer. When reviewing code:

1. Check for bugs and edge cases
2. Verify the code follows the style guide in references/style-guide.md
3. Suggest improvements for readability`;

const STYLE_GUIDE = `# Style Guide

Use 2-space indentation. Prefer const over let.`;

const COMMIT_MESSAGE_SKILL = `---
name: commit-message
description: Writes Conventional Commits messages for staged changes
---

# Commit Message

Generate commit messages in Conventional Commits format.`;

const sampleFiles = {
  "./skills/code-review/SKILL.md": CODE_REVIEW_SKILL,
  "./skills/code-review/references/style-guide.md": STYLE_GUIDE,
  "./skills/commit-message/SKILL.md": COMMIT_MESSAGE_SKILL,
};

describe("BundledSkillSource", () => {
  describe("path normalization", () => {
    it('treats "./foo", "foo", and "/foo" as the same path', async () => {
      const src = new BundledSkillSource({ "foo/bar.txt": "x" });
      expect(await src.exists("foo/bar.txt")).toBe(true);
      expect(await src.exists("./foo/bar.txt")).toBe(true);
      expect(await src.exists("/foo/bar.txt")).toBe(true);
    });

    it('treats "." and "./" as the bundle root (required for root-level glob discovery)', async () => {
      const src = new BundledSkillSource(sampleFiles);
      const fromDot = await src.readdir(".");
      const fromEmpty = await src.readdir("");
      expect(fromDot).toEqual(fromEmpty);
      expect(fromDot.map((e) => e.name).sort()).toEqual(["skills"]);
    });

    it("collapses duplicate slashes and inner '.' segments", async () => {
      const src = new BundledSkillSource(sampleFiles);
      expect(await src.exists("skills//code-review")).toBe(true);
      expect(await src.readFile("skills/./code-review/SKILL.md")).toBe(CODE_REVIEW_SKILL);
    });
  });

  describe("root path", () => {
    it("reports the root as an existing directory in exists and stat", async () => {
      const src = new BundledSkillSource(sampleFiles);
      expect(await src.exists(".")).toBe(true);
      expect(await src.exists("/")).toBe(true);
      expect((await src.stat(".")).type).toBe("directory");
    });

    it("reports the root as existing even for an empty bundle", async () => {
      const src = new BundledSkillSource({});
      expect(await src.exists(".")).toBe(true);
      expect((await src.stat(".")).type).toBe("directory");
    });
  });

  describe("exists", () => {
    it("returns true for known files", async () => {
      const src = new BundledSkillSource(sampleFiles);
      expect(await src.exists("skills/code-review/SKILL.md")).toBe(true);
    });

    it("returns true for implicit directories", async () => {
      const src = new BundledSkillSource(sampleFiles);
      expect(await src.exists("skills")).toBe(true);
      expect(await src.exists("skills/code-review")).toBe(true);
      expect(await src.exists("skills/code-review/references")).toBe(true);
    });

    it("returns false for unknown paths", async () => {
      const src = new BundledSkillSource(sampleFiles);
      expect(await src.exists("skills/missing")).toBe(false);
      expect(await src.exists("skills/code-review/missing.md")).toBe(false);
    });
  });

  describe("readFile", () => {
    it("returns content for string entries", async () => {
      const src = new BundledSkillSource(sampleFiles);
      expect(await src.readFile("skills/code-review/SKILL.md")).toBe(CODE_REVIEW_SKILL);
    });

    it("throws FileNotFoundError for missing files", async () => {
      const src = new BundledSkillSource(sampleFiles);
      await expect(src.readFile("skills/missing.md")).rejects.toBeInstanceOf(FileNotFoundError);
    });

    it("returns Buffer for binary Uint8Array entries", async () => {
      const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
      const src = new BundledSkillSource({ "skills/foo/assets/logo.png": bytes });
      const result = await src.readFile("skills/foo/assets/logo.png");
      expect(result).toBeInstanceOf(Uint8Array);
      expect(Array.from(result as Uint8Array)).toEqual([0x89, 0x50, 0x4e, 0x47]);
    });
  });

  describe("readdir", () => {
    it("returns direct children only (no recursion)", async () => {
      const src = new BundledSkillSource(sampleFiles);
      const entries = await src.readdir("skills");
      expect(entries.map((e) => e.name).sort()).toEqual(["code-review", "commit-message"]);
      expect(entries.every((e) => e.type === "directory")).toBe(true);
    });

    it("distinguishes files from subdirectories", async () => {
      const src = new BundledSkillSource(sampleFiles);
      const entries = await src.readdir("skills/code-review");
      const byName = Object.fromEntries(entries.map((e) => [e.name, e.type]));
      expect(byName).toEqual({
        "SKILL.md": "file",
        references: "directory",
      });
    });

    it("throws DirectoryNotFoundError when directory does not exist", async () => {
      const src = new BundledSkillSource(sampleFiles);
      await expect(src.readdir("skills/missing")).rejects.toBeInstanceOf(DirectoryNotFoundError);
    });

    it("throws NotDirectoryError when path resolves to a file", async () => {
      const src = new BundledSkillSource(sampleFiles);
      await expect(src.readdir("skills/code-review/SKILL.md")).rejects.toBeInstanceOf(
        NotDirectoryError,
      );
    });
  });

  describe("stat", () => {
    it("reports file size and type", async () => {
      const src = new BundledSkillSource(sampleFiles);
      const s = await src.stat("skills/code-review/SKILL.md");
      expect(s.type).toBe("file");
      expect(s.name).toBe("SKILL.md");
      expect(s.size).toBe(new TextEncoder().encode(CODE_REVIEW_SKILL).byteLength);
    });

    it("reports directories with size 0", async () => {
      const src = new BundledSkillSource(sampleFiles);
      const s = await src.stat("skills/code-review");
      expect(s.type).toBe("directory");
      expect(s.size).toBe(0);
    });

    it("throws FileNotFoundError for missing paths", async () => {
      const src = new BundledSkillSource(sampleFiles);
      await expect(src.stat("skills/missing")).rejects.toBeInstanceOf(FileNotFoundError);
    });

    it("reports mime types for bundled script and web extensions", async () => {
      const src = new BundledSkillSource({
        "skills/foo/scripts/run.py": "print()",
        "skills/foo/scripts/setup.sh": "echo hi",
        "skills/foo/scripts/tool.ts": "export {};",
        "skills/foo/references/page.html": "<html></html>",
        "skills/foo/references/style.css": "a {}",
      });
      expect((await src.stat("skills/foo/scripts/run.py")).mimeType).toBe("text/x-python");
      expect((await src.stat("skills/foo/scripts/setup.sh")).mimeType).toBe("text/x-shellscript");
      expect((await src.stat("skills/foo/scripts/tool.ts")).mimeType).toBe(
        "application/typescript",
      );
      expect((await src.stat("skills/foo/references/page.html")).mimeType).toBe("text/html");
      expect((await src.stat("skills/foo/references/style.css")).mimeType).toBe("text/css");
    });
  });

  describe("realpath", () => {
    it("returns the normalized path", async () => {
      const src = new BundledSkillSource(sampleFiles);
      expect(await src.realpath("./skills/code-review")).toBe("skills/code-review");
      expect(await src.realpath("skills//./code-review")).toBe("skills/code-review");
    });
  });
});
