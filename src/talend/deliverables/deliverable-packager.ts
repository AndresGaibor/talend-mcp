import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync, readdirSync } from "node:fs";
import { join, basename, extname } from "node:path";
import type { DeliverablePackage, DeliverableFile, DeliverableChecklist, ChecklistItem } from "./deliverable-types";
import { getConfiguredProjectPath } from "../workspace";

function walkDirectory(dir: string): string[] {
  const results: string[] = [];
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return results;
  }
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    try {
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        results.push(...walkDirectory(fullPath));
      } else {
        results.push(fullPath);
      }
    } catch {
      continue;
    }
  }
  return results;
}

function inferFileType(path: string): DeliverableFile["type"] {
  const lower = path.toLowerCase();
  if (lower.includes("/process/")) return "job";
  if (lower.includes("/contexts/") || lower.includes("_context")) return "context";
  if (lower.includes("_schema") || lower.includes("/schemas/")) return "schema";
  if (lower.includes("_script") || lower.includes("/scripts/")) return "script";
  if (lower.includes("readme") || lower.includes("read_me")) return "readme";
  return "other";
}

export function collectJobFiles(jobName: string): DeliverableFile[] {
  const projectPath = getConfiguredProjectPath();
  if (!projectPath) return [];

  const processDir = join(projectPath, "process");
  const codeDir = join(projectPath, "code");
  const metadataDir = join(projectPath, "metadata");

  const searchDirs = [processDir, codeDir, metadataDir].filter((d) => existsSync(d));

  const allFiles: string[] = [];
  for (const dir of searchDirs) {
    allFiles.push(...walkDirectory(dir));
  }

  const nameLower = jobName.toLowerCase();
  const matching = allFiles.filter((f) => {
    const fname = basename(f, extname(f)).toLowerCase();
    const fpath = f.toLowerCase();
    return (
      fname.includes(nameLower) ||
      fpath.includes(`/${nameLower}/`) ||
      fpath.includes(`\\${nameLower}\\`) ||
      fpath.includes(`${nameLower}_`)
    );
  });

  return matching.map((path) => {
    let sizeBytes: number | undefined;
    try {
      sizeBytes = statSync(path).size;
    } catch {
      sizeBytes = undefined;
    }
    return {
      path,
      type: inferFileType(path),
      sizeBytes,
      description: basename(path),
    };
  });
}

export async function createPackage(jobName: string, files: DeliverableFile[], destinationDir?: string): Promise<DeliverablePackage> {
  const totalSizeBytes = files.reduce((acc, f) => acc + (f.sizeBytes ?? 0), 0);

  const pkg: DeliverablePackage = {
    jobName,
    files,
    createdAt: Date.now(),
    totalSizeBytes,
  };

  if (destinationDir && files.length > 0) {
    const cleanName = jobName.replace(/[^a-zA-Z0-9_-]/g, "_");
    const zipPath = join(destinationDir, `${cleanName}_package.zip`);

    const tempDir = join(destinationDir, `.zip_temp_${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });

    const projectPath = getConfiguredProjectPath();

    for (const file of files) {
      try {
        const data = await Bun.file(file.path).bytes();

        let relativePath: string;
        if (projectPath && file.path.startsWith(projectPath)) {
          relativePath = file.path.slice(projectPath.length).replace(/^[\/\\]/, "");
        } else {
          relativePath = basename(file.path);
        }

        const destPath = join(tempDir, relativePath);
        const dirOfDest = destPath.substring(0, destPath.lastIndexOf("/"));
        if (dirOfDest) mkdirSync(dirOfDest, { recursive: true });
        await Bun.write(destPath, data);
      } catch {
        continue;
      }
    }

    const proc = Bun.spawnSync(["zip", "-r", zipPath, "."], { cwd: tempDir });
    void proc;

    try {
      const stat = statSync(zipPath);
      pkg.zipPath = zipPath;
      pkg.totalSizeBytes = stat.size;
    } catch {
    }
  }

  return pkg;
}

export function buildChecklist(jobName: string, spec: {
  hasContexts: boolean;
  hasSchema: boolean;
  hasDocumentation: boolean;
  outputTable?: string;
  auditColumns?: boolean;
  batchSize?: number;
}): DeliverableChecklist {
  const items: ChecklistItem[] = [
    {
      id: "job-item",
      description: "Archivo .item del job existe",
      checked: false,
      required: true,
    },
    {
      id: "context-file",
      description: "Archivo de contextos incluido",
      checked: spec.hasContexts,
      required: true,
    },
    {
      id: "schema-documentation",
      description: "Documentación de schema incluida",
      checked: spec.hasSchema,
      required: false,
    },
    {
      id: "readme",
      description: "README con instrucciones",
      checked: spec.hasDocumentation,
      required: false,
    },
    {
      id: "output-table",
      description: spec.outputTable ? `Tabla ${spec.outputTable} especificada` : "Output table name defined",
      checked: !!spec.outputTable,
      required: true,
    },
    {
      id: "audit-columns",
      description: "Columnas de audit (_load_ts, _load_run) configuradas",
      checked: !!spec.auditColumns,
      required: spec.auditColumns ?? false,
    },
    {
      id: "batch-size",
      description: `Batch size ${spec.batchSize ?? "N/A"} configurado`,
      checked: !!spec.batchSize,
      required: true,
    },
  ];

  const missingRequired = items.filter((i) => i.required && !i.checked).map((i) => i.id);

  return {
    jobName,
    items,
    allChecked: missingRequired.length === 0,
    missingRequired,
  };
}

export async function exportJobPackage(jobName: string, destinationDir: string): Promise<DeliverablePackage> {
  const files = collectJobFiles(jobName);
  const pkg = await createPackage(jobName, files, destinationDir);

  if (!existsSync(destinationDir)) {
    mkdirSync(destinationDir, { recursive: true });
  }

  const manifestPath = join(destinationDir, `${jobName}_manifest.json`);
  writeFileSync(manifestPath, JSON.stringify(pkg, null, 2), "utf8");

  return pkg;
}
