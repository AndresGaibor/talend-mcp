import type { Snapshot } from "../../modules/snapshots/domain/snapshot.types";
import { FileSnapshotRepository } from "../../modules/snapshots/adapters/file-snapshot.repository";
import { getConfiguredProjectPath } from "../workspace";
import { findTalendJob } from "../job-crud";
import { readTextFile, writeTextFile } from "../files";
import { patchTalendComponentXml } from "../editor";
import { parseJobItem } from "../job-parser";

export interface PatchPreview {
  componentId: string;
  current: Record<string, unknown> | null;
  proposed: Record<string, unknown> | null;
  diff: string[];
}

export interface ApplyResult {
  requiresConfirmation?: boolean;
  diff?: string[];
  snapshotId?: string;
  success: boolean;
  error?: string;
}

export class PatchPreviewService {
  private snapRepo: FileSnapshotRepository;

  constructor(snapshotsDir: string = "./snapshots") {
    this.snapRepo = new FileSnapshotRepository(snapshotsDir);
  }

  async previewPatch(
    jobName: string,
    uniqueName: string,
    patch: Record<string, string>,
    folderPath?: string
  ): Promise<PatchPreview> {
    const projectPath = getConfiguredProjectPath();
    if (!projectPath) {
      throw new Error("TALEND_PROJECT no configurado");
    }

    const job = await findTalendJob(projectPath, jobName, folderPath);
    const xml = await readTextFile(job.itemPath, projectPath);

    const parsedBefore = parseJobItem(xml, job.itemPath);
    const compBefore = parsedBefore.components.find((c) => c.uniqueName === uniqueName);

    const newXml = patchTalendComponentXml(xml, uniqueName, patch);
    const parsedAfter = parseJobItem(newXml, job.itemPath);
    const compAfter = parsedAfter.components.find((c) => c.uniqueName === uniqueName);

    const diff = this.computeDiff(compBefore ?? null, compAfter ?? null, patch);

    return {
      componentId: uniqueName,
      current: compBefore ?? null,
      proposed: compAfter ?? null,
      diff,
    };
  }

  async applyPatch(
    jobName: string,
    uniqueName: string,
    patch: Record<string, string>,
    confirmationToken?: string,
    folderPath?: string
  ): Promise<ApplyResult> {
    const projectPath = getConfiguredProjectPath();
    if (!projectPath) {
      return { success: false, error: "TALEND_PROJECT no configurado" };
    }

    if (!confirmationToken) {
      const preview = await this.previewPatch(jobName, uniqueName, patch, folderPath);
      return { requiresConfirmation: true, diff: preview.diff, success: false };
    }

    const expectedToken = `patch_${uniqueName}_${Object.keys(patch).sort().join("_")}`;
    if (confirmationToken !== expectedToken) {
      return { success: false, error: "Token de confirmación inválido" };
    }

    const job = await findTalendJob(projectPath, jobName, folderPath);
    const xml = await readTextFile(job.itemPath, projectPath);

    const snapshot = await this.createSnapshot(`before-patch-${uniqueName}`, job.itemPath);

    const newXml = patchTalendComponentXml(xml, uniqueName, patch);
    await writeTextFile(job.itemPath, newXml, projectPath);

    const validationResult = await this.validateAfterChange(job.itemPath, uniqueName);
    if (!validationResult.valid) {
      return { success: false, error: validationResult.message };
    }

    return { snapshotId: snapshot.id, success: true };
  }

  private computeDiff(
    current: Record<string, unknown> | null,
    proposed: Record<string, unknown> | null,
    patch: Record<string, string>
  ): string[] {
    const diffLines: string[] = [];
    if (current && proposed) {
      for (const key of Object.keys(patch)) {
        const valBefore = (current.parameters as Record<string, string> | undefined | null)?.[key] ?? "";
        const valAfter = (proposed.parameters as Record<string, string> | undefined | null)?.[key] ?? "";
        if (valBefore !== valAfter) {
          diffLines.push(`${key}: "${valBefore}" -> "${valAfter}"`);
        }
      }
    }
    return diffLines;
  }

  private async createSnapshot(name: string, sourcePath: string): Promise<Snapshot> {
    try {
      return await this.snapRepo.create({ name, sourcePath });
    } catch (e) {
      console.warn("No se pudo crear snapshot:", e);
      return {
        id: `snap_${Date.now()}`,
        name,
        path: "",
        createdAt: new Date(),
        sizeBytes: 0,
        sourcePath,
      };
    }
  }

  private async validateAfterChange(
    itemPath: string,
    uniqueName: string
  ): Promise<{ valid: boolean; message?: string }> {
    try {
      const xml = await readTextFile(itemPath);
      const parsed = parseJobItem(xml, itemPath);
      const component = parsed.components.find((c) => c.uniqueName === uniqueName);

      if (!component) {
        return { valid: false, message: `Componente ${uniqueName} no encontrado después del cambio` };
      }

      const dangerousParams = ["UNIQUE_NAME", "SCHEMA"];
      for (const k of Object.keys(component.parameters ?? {})) {
        if (dangerousParams.includes(k) && !component.parameters?.[k]) {
          return { valid: false, message: `Parámetro crítico '${k}' quedó vacío` };
        }
      }

      return { valid: true };
    } catch (e) {
      return { valid: false, message: `Error en validación: ${e instanceof Error ? e.message : String(e)}` };
    }
  }
}