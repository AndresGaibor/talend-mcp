import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import type { IFileSystem, FileEntry } from "../ports/file-system.port";

export class NodeFileSystemAdapter implements IFileSystem {
  async readdir(path: string, options?: { withFileTypes?: boolean }): Promise<FileEntry[]> {
    const entries = await readdir(path, { withFileTypes: true });
    if (!options?.withFileTypes) {
      return entries.map((e) => ({ name: e.name, isFile: () => e.isFile(), isDirectory: () => e.isDirectory() }));
    }
    return entries;
  }

  async readFile(path: string, encoding: BufferEncoding): Promise<string> {
    const content = await Bun.file(path).text();
    return content;
  }

  async exists(path: string): Promise<boolean> {
    return existsSync(path);
  }
}
