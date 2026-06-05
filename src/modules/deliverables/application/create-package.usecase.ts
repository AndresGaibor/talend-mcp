import type { DeliverablePackage, CreatePackageOptions } from "../domain/deliverable.types";

function generateChecksum(files: DeliverablePackage["files"]): string {
  const content = files.map((f) => `${f.path}:${f.sizeBytes}`).join("|");
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

export class CreatePackageUseCase {
  async execute(options: CreatePackageOptions): Promise<DeliverablePackage> {
    const totalSizeBytes = options.files.reduce((sum, file) => sum + file.sizeBytes, 0);

    return {
      id: `pkg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      name: options.name,
      version: options.version,
      files: options.files,
      totalSizeBytes,
      createdAt: new Date(),
      checksum: generateChecksum(options.files),
    };
  }
}