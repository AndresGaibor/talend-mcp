export interface FileEntry {
  name: string;
  isFile(): boolean;
  isDirectory(): boolean;
}

export interface IFileSystem {
  readdir(path: string, options?: { withFileTypes?: boolean }): Promise<FileEntry[]>;
  readFile(path: string, encoding: BufferEncoding): Promise<string>;
  exists(path: string): Promise<boolean>;
}
