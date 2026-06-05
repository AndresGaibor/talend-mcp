export interface IFileSystemPort {
  copy(source: string, destination: string): Promise<void>;
  readDir(path: string): Promise<string[]>;
  exists(path: string): Promise<boolean>;
  mkdir(path: string): Promise<void>;
  remove(path: string): Promise<void>;
  getFileSize(path: string): Promise<number>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  listFilesRecursive(path: string, extensions?: string[]): Promise<string[]>;
}
