import { describe, it, expect } from "vitest";
import { Workspace } from "@mastra/core/workspace";
import { BundledSkillSource } from "./index.js";

const CODE_REVIEW_SKILL = `---
name: code-review
description: Reviews code for quality, style, and potential issues
---

# Code Review

You are a code reviewer.`;

const COMMIT_MESSAGE_SKILL = `---
name: commit-message
description: Writes Conventional Commits messages for staged changes
---

# Commit Message

Generate commit messages in Conventional Commits format.`;

const sampleSkills = {
  "skills/code-review/SKILL.md": CODE_REVIEW_SKILL,
  "skills/commit-message/SKILL.md": COMMIT_MESSAGE_SKILL,
};

describe("Integration with @mastra/core Workspace", () => {
  it("Mastra discovers skills through BundledSkillSource", async () => {
    const workspace = new Workspace({
      skills: ["skills"],
      skillSource: new BundledSkillSource(sampleSkills),
    });
    const list = await workspace.skills!.list();
    const names = list.map((s) => s.name).sort();
    expect(names).toEqual(["code-review", "commit-message"]);
  });

  it("supports root-level glob patterns like **/SKILL.md", async () => {
    const workspace = new Workspace({
      skills: ["**/SKILL.md"],
      skillSource: new BundledSkillSource(sampleSkills),
    });
    const list = await workspace.skills!.list();
    const names = list.map((s) => s.name).sort();
    expect(names).toEqual(["code-review", "commit-message"]);
  });
});
