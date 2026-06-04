import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, basename } from "node:path";
import type { DeliverablePackage, DeliverableFile, DeliverableChecklist, ChecklistItem } from "./deliverable-types";
import { getConfiguredProjectPath } from "../workspace";

export function collectJobFiles(jobName: string): DeliverableFile[] {
  const projectPath = getConfiguredProjectPath();
  if (!projectPath) return [];

  const files: DeliverableFile[] = [];
  const jobPatterns = [
    `**/${jobName}/*.item`,
    `**/${jobName}/*.java`,
    `**/${jobName}/*.properties`,
    `**/${jobName}/*.xml`,
    `**/${jobName}/*_stats*`,
    `**/${jobName}/*_errors*`,
    `**/${jobName}/*_sch*`,
  ];

  return files;
}

export function createPackage(jobName: string, files: DeliverableFile[]): DeliverablePackage {
  const totalSizeBytes = files.reduce((acc, f) => acc + (f.sizeBytes ?? 0), 0);
  return {
    jobName,
    files,
    createdAt: Date.now(),
    totalSizeBytes,
  };
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

export function exportJobPackage(jobName: string, destinationDir: string): DeliverablePackage {
  const files = collectJobFiles(jobName);
  const pkg = createPackage(jobName, files);

  if (!existsSync(destinationDir)) {
    mkdirSync(destinationDir, { recursive: true });
  }

  const manifestPath = join(destinationDir, `${jobName}_manifest.json`);
  writeFileSync(manifestPath, JSON.stringify(pkg, null, 2), "utf8");

  return pkg;
}
