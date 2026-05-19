import {
  DirectoryNotFoundError,
  FileNotFoundError,
  NotDirectoryError,
  type SkillSource,
  type SkillSourceEntry,
  type SkillSourceStat,
} from "@mastra/core/workspace";

export type BundledSkillFiles = Record<string, string | Uint8Array>;

const MIME_BY_EXT: Record<string, string> = {
  md: "text/markdown",
  txt: "text/plain",
  json: "application/json",
  yaml: "application/yaml",
  yml: "application/yaml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  svg: "image/svg+xml",
  pdf: "application/pdf",
};

const guessMime = (name: string): string | undefined => {
  const ext = name.split(".").pop()?.toLowerCase();
  return ext ? MIME_BY_EXT[ext] : undefined;
};

const normalize = (p: string): string => {
  if (p === ".") return "";
  let path = p;
  if (path.startsWith("./")) path = path.slice(2);
  while (path.startsWith("/")) path = path.slice(1);
  while (path.endsWith("/") && path.length > 1) path = path.slice(0, -1);
  return path;
};

const parentDirs = (path: string): string[] => {
  const dirs: string[] = [];
  let current = path;
  while (true) {
    const idx = current.lastIndexOf("/");
    if (idx === -1) break;
    current = current.slice(0, idx);
    if (current === "") break;
    dirs.push(current);
  }
  return dirs;
};

const byteLength = (content: string | Uint8Array): number =>
  typeof content === "string" ? new TextEncoder().encode(content).byteLength : content.byteLength;

export class BundledSkillSource implements SkillSource {
  readonly #files: Map<string, string | Uint8Array>;
  readonly #dirs: Set<string>;
  readonly #buildTime: Date;

  constructor(files: BundledSkillFiles, options?: { buildTime?: Date }) {
    this.#files = new Map();
    this.#dirs = new Set();
    this.#buildTime = options?.buildTime ?? new Date(0);

    for (const [rawPath, content] of Object.entries(files)) {
      const path = normalize(rawPath);
      if (path === "") continue;
      this.#files.set(path, content);
      for (const dir of parentDirs(path)) this.#dirs.add(dir);
    }
  }

  async exists(path: string): Promise<boolean> {
    const p = normalize(path);
    return this.#files.has(p) || this.#dirs.has(p);
  }

  async stat(path: string): Promise<SkillSourceStat> {
    const p = normalize(path);
    const name = p.slice(p.lastIndexOf("/") + 1);

    const content = this.#files.get(p);
    if (content !== undefined) {
      return {
        name,
        type: "file",
        size: byteLength(content),
        createdAt: this.#buildTime,
        modifiedAt: this.#buildTime,
        mimeType: guessMime(name),
      };
    }

    if (this.#dirs.has(p)) {
      return {
        name,
        type: "directory",
        size: 0,
        createdAt: this.#buildTime,
        modifiedAt: this.#buildTime,
      };
    }

    throw new FileNotFoundError(path);
  }

  async readFile(path: string): Promise<string | Buffer> {
    const p = normalize(path);
    const content = this.#files.get(p);
    if (content === undefined) {
      throw new FileNotFoundError(path);
    }
    if (typeof content === "string") return content;
    return Buffer.from(content);
  }

  async readdir(path: string): Promise<SkillSourceEntry[]> {
    const p = normalize(path);
    if (p !== "" && !this.#dirs.has(p)) {
      throw this.#files.has(p) ? new NotDirectoryError(path) : new DirectoryNotFoundError(path);
    }
    const prefix = p === "" ? "" : `${p}/`;
    const seen = new Map<string, "file" | "directory">();

    for (const filePath of this.#files.keys()) {
      if (!filePath.startsWith(prefix)) continue;
      const rest = filePath.slice(prefix.length);
      const slashIdx = rest.indexOf("/");
      const name = slashIdx === -1 ? rest : rest.slice(0, slashIdx);
      const type = slashIdx === -1 ? "file" : "directory";
      if (!seen.has(name)) seen.set(name, type);
    }

    return [...seen].map(([name, type]) => ({ name, type }));
  }

  async realpath(path: string): Promise<string> {
    return normalize(path);
  }
}
