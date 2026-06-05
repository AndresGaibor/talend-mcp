import { join } from "node:path";
import type { ISnapshotRepository, ISnapshotMetadataStore } from "../ports/snapshot-repository.port";
import type { IFileSystemPort } from "../ports/file-system.port";
import type {
  Snapshot,
  SnapshotMetadata,
  CreateSnapshotOptions,
  ListSnapshotsOptions,
} from "../domain/snapshot.types";

function generateId(): string {
  return `snap_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

class InMemoryMetadataStore implements ISnapshotMetadataStore {
  private readonly store = new Map<string, SnapshotMetadata>();

  async save(metadata: SnapshotMetadata): Promise<void> {
    this.store.set(metadata.id, metadata);
  }

  async findById(id: string): Promise<SnapshotMetadata | null> {
    return this.store.get(id) ?? null;
  }

  async list(sourcePath?: string, limit = 50, offset = 0): Promise<SnapshotMetadata[]> {
    let results = Array.from(this.store.values());
    if (sourcePath) {
      results = results.filter((m) => m.sourcePath === sourcePath);
    }
    return results.slice(offset, offset + limit);
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }

  async update(id: string, updates: Partial<SnapshotMetadata>): Promise<void> {
    const existing = this.store.get(id);
    if (existing) {
      this.store.set(id, { ...existing, ...updates });
    }
  }
}

export class FileSnapshotRepository implements ISnapshotRepository {
  private readonly snapshotsDir: string;
  private readonly metadataStore: ISnapshotMetadataStore;
  private readonly fs: IFileSystemPort;

  constructor(
    snapshotsDir: string = "./snapshots",
    fs?: IFileSystemPort,
    metadataStore?: ISnapshotMetadataStore
  ) {
    this.snapshotsDir = snapshotsDir;
    this.fs = fs ?? this.createBunFileSystem();
    this.metadataStore = metadataStore ?? new InMemoryMetadataStore();
  }

  private createBunFileSystem(): IFileSystemPort {
    return {
      async copy(source: string, destination: string): Promise<void> {
        const sourceFile = Bun.file(source);
        if (!await sourceFile.exists()) {
          throw new Error(`Source file does not exist: ${source}`);
        }
        await Bun.write(destination, await sourceFile.arrayBuffer());
      },
      async readDir(_path: string): Promise<string[]> {
        return [];
      },
      async exists(path: string): Promise<boolean> {
        return await Bun.file(path).exists();
      },
      async mkdir(_path: string): Promise<void> {},
      async remove(_path: string): Promise<void> {},
      async getFileSize(path: string): Promise<number> {
        const file = Bun.file(path);
        if (!await file.exists()) {
          return 0;
        }
        return (await file.arrayBuffer()).byteLength;
      },
      async readFile(path: string): Promise<string> {
        const file = Bun.file(path);
        if (!await file.exists()) {
          throw new Error(`File does not exist: ${path}`);
        }
        return await file.text();
      },
      async writeFile(path: string, content: string): Promise<void> {
        await Bun.write(path, content);
      },
      async listFilesRecursive(_path: string, _extensions?: string[]): Promise<string[]> {
        return [];
      },
    };
  }

  async list(options?: ListSnapshotsOptions): Promise<Snapshot[]> {
    const metadatas = await this.metadataStore.list(options?.sourcePath, options?.limit, options?.offset);
    return metadatas.map((m) => this.metadataToSnapshot(m));
  }

  async findById(id: string): Promise<Snapshot | null> {
    const metadata = await this.metadataStore.findById(id);
    return metadata ? this.metadataToSnapshot(metadata) : null;
  }

  async create(options: CreateSnapshotOptions): Promise<Snapshot> {
    const id = generateId();
    const snapshotPath = join(this.snapshotsDir, id);
    const createdAt = new Date();

    const metadata: SnapshotMetadata = {
      id,
      name: options.name,
      createdAt: createdAt.toISOString(),
      sizeBytes: 0,
      description: options.description ?? "",
      tags: options.tags ?? [],
      sourcePath: options.sourcePath,
    };

    await this.metadataStore.save(metadata);

    return {
      id,
      name: options.name,
      path: snapshotPath,
      createdAt,
      sizeBytes: 0,
      description: options.description,
      tags: options.tags,
      sourcePath: options.sourcePath,
    };
  }

  async delete(id: string): Promise<void> {
    await this.metadataStore.delete(id);
  }

  async restore(id: string, targetPath?: string, overwrite?: boolean): Promise<void> {
    const snapshot = await this.findById(id);
    if (!snapshot) {
      throw new Error(`Snapshot not found: ${id}`);
    }
  }

  async getDiff(snapshotIdA: string, snapshotIdB: string): Promise<string> {
    return `Diff between ${snapshotIdA} and ${snapshotIdB}`;
  }

  async exists(id: string): Promise<boolean> {
    const metadata = await this.metadataStore.findById(id);
    return metadata !== null;
  }

  private metadataToSnapshot(metadata: SnapshotMetadata): Snapshot {
    return {
      id: metadata.id,
      name: metadata.name,
      path: join(this.snapshotsDir, metadata.id),
      createdAt: new Date(metadata.createdAt),
      sizeBytes: metadata.sizeBytes,
      description: metadata.description,
      tags: metadata.tags,
      sourcePath: metadata.sourcePath,
    };
  }
}
