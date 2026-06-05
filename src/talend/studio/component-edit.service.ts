import type { Snapshot } from "../../modules/snapshots/domain/snapshot.types";
import type { TalendStudioBridgeClient } from "./bridge-client";
import { FileSnapshotRepository } from "../../modules/snapshots/adapters/file-snapshot.repository";
import { getConfiguredProjectPath } from "../workspace";
import { findTalendJob } from "../job-crud";
import { readTextFile, writeTextFile } from "../files";
import {
  patchTalendComponentXml,
  updateTalendComponentParameterXml,
  moveTalendComponentXml,
} from "../editor";
import { parseJobItem } from "../job-parser";
import { parseXml, buildXml } from "../xml";

export interface EditResult {
  snapshotId: string;
  success: boolean;
  x?: number;
  y?: number;
  result?: unknown;
}

type ComponentChange =
  | { type: "rename_label"; newLabel: string }
  | { type: "update_position"; x: number; y: number }
  | { type: "patch"; patch: Record<string, string> }
  | { type: "rename_unique_name"; oldUniqueName: string; newUniqueName: string };

export class ComponentEditService {
  private snapRepo: FileSnapshotRepository;

  constructor(snapshotsDir: string = "./snapshots") {
    this.snapRepo = new FileSnapshotRepository(snapshotsDir);
  }

  async renameLabel(
    jobName: string,
    uniqueName: string,
    newLabel: string,
    folderPath?: string
  ): Promise<EditResult> {
    const projectPath = getConfiguredProjectPath();
    if (!projectPath) {
      throw new Error("TALEND_PROJECT no configurado");
    }

    const job = await findTalendJob(projectPath, jobName, folderPath);
    const xml = await readTextFile(job.itemPath, projectPath);

    const snapshot = await this.createSnapshot(`before-rename-label-${uniqueName}`, job.itemPath);

    const newXml = updateTalendComponentParameterXml(xml, {
      uniqueName,
      parameterName: "LABEL",
      value: newLabel,
    });
    await writeTextFile(job.itemPath, newXml, projectPath);

    return {
      snapshotId: snapshot.id,
      success: true,
      result: { jobName, uniqueName, newLabel },
    };
  }

  async updatePosition(
    jobName: string,
    uniqueName: string,
    x: number,
    y: number,
    folderPath?: string
  ): Promise<EditResult> {
    const projectPath = getConfiguredProjectPath();
    if (!projectPath) {
      throw new Error("TALEND_PROJECT no configurado");
    }

    const job = await findTalendJob(projectPath, jobName, folderPath);
    const xml = await readTextFile(job.itemPath, projectPath);

    const snapshot = await this.createSnapshot(`before-update-position-${uniqueName}`, job.itemPath);

    const newXml = moveTalendComponentXml(xml, { uniqueName, posX: x, posY: y });
    await writeTextFile(job.itemPath, newXml, projectPath);

    return {
      snapshotId: snapshot.id,
      success: true,
      x,
      y,
    };
  }

  async applyPatch(
    jobName: string,
    uniqueName: string,
    patch: Record<string, string>,
    folderPath?: string
  ): Promise<EditResult> {
    const projectPath = getConfiguredProjectPath();
    if (!projectPath) {
      throw new Error("TALEND_PROJECT no configurado");
    }

    const job = await findTalendJob(projectPath, jobName, folderPath);
    const xml = await readTextFile(job.itemPath, projectPath);

    const snapshot = await this.createSnapshot(`before-patch-${uniqueName}`, job.itemPath);

    const newXml = patchTalendComponentXml(xml, uniqueName, patch);
    await writeTextFile(job.itemPath, newXml, projectPath);

    return {
      snapshotId: snapshot.id,
      success: true,
      result: { jobName, uniqueName, patch },
    };
  }

  async renameUniqueName(
    jobName: string,
    oldUniqueName: string,
    newUniqueName: string,
    folderPath?: string
  ): Promise<EditResult> {
    const projectPath = getConfiguredProjectPath();
    if (!projectPath) {
      throw new Error("TALEND_PROJECT no configurado");
    }

    const job = await findTalendJob(projectPath, jobName, folderPath);
    const xml = await readTextFile(job.itemPath, projectPath);

    const snapshot = await this.createSnapshot(`before-rename-uniq-${oldUniqueName}`, job.itemPath);

    const newXml = this.renameUniqueNameXml(xml, oldUniqueName, newUniqueName);
    await writeTextFile(job.itemPath, newXml, projectPath);

    return {
      snapshotId: snapshot.id,
      success: true,
      result: { oldUniqueName, newUniqueName },
    };
  }

  async previewPatch(
    jobName: string,
    uniqueName: string,
    patch: Record<string, string>,
    folderPath?: string
  ): Promise<{
    componentBefore: Record<string, unknown> | null;
    componentAfter: Record<string, unknown> | null;
    diff: string[];
    warnings: string[];
    riskLevel: "low" | "medium" | "high";
  }> {
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

    const diffLines: string[] = [];
    if (compBefore && compAfter) {
      for (const key of Object.keys(patch)) {
        const valBefore = compBefore.parameters?.[key] ?? "";
        const valAfter = compAfter.parameters?.[key] ?? "";
        diffLines.push(`${key}: "${valBefore}" -> "${valAfter}"`);
      }
    }

    let riskLevel: "low" | "medium" | "high" = "low";
    const warnings: string[] = [];
    const dangerousParams = ["UNIQUE_NAME", "SCHEMA", "DBNAME", "HOST", "PORT"];
    for (const k of Object.keys(patch)) {
      if (dangerousParams.includes(k)) {
        riskLevel = "high";
        warnings.push(`El parámetro '${k}' es crítico y requiere confirmación adicional.`);
      }
    }

    return {
      componentBefore: compBefore ?? null,
      componentAfter: compAfter ?? null,
      diff: diffLines,
      warnings,
      riskLevel,
    };
  }

  async previewRenameUniqueName(
    jobName: string,
    oldUniqueName: string,
    newUniqueName: string,
    folderPath?: string
  ): Promise<{
    alreadyExists: boolean;
    affectedConnectionsCount: number;
    confirmationToken: string;
    warning: string;
  }> {
    const projectPath = getConfiguredProjectPath();
    if (!projectPath) {
      throw new Error("TALEND_PROJECT no configurado");
    }

    const job = await findTalendJob(projectPath, jobName, folderPath);
    const xml = await readTextFile(job.itemPath, projectPath);

    const parsed = parseJobItem(xml, job.itemPath);
    const alreadyExists = parsed.components.some((c) => c.uniqueName === newUniqueName);

    const affectedConns = parsed.connections.filter(
      (c) => c.source === oldUniqueName || c.target === oldUniqueName
    );

    return {
      alreadyExists,
      affectedConnectionsCount: affectedConns.length,
      confirmationToken: `rename_${oldUniqueName}_to_${newUniqueName}`,
      warning: "Esta operación es crítica y actualizará flujos y mapeos en cascada.",
    };
  }

  async refreshBridge(bridge: TalendStudioBridgeClient): Promise<void> {
    await bridge.refreshWorkspace();
  }

  private async createSnapshot(name: string, sourcePath: string): Promise<Snapshot> {
    try {
      return await this.snapRepo.create({ name, sourcePath });
    } catch (e) {
      console.warn("No se pudo crear snapshot:", e);
      return {
        id: "unknown",
        name,
        path: "",
        createdAt: new Date(),
        sizeBytes: 0,
        sourcePath,
      };
    }
  }

  private renameUniqueNameXml(
    xml: string,
    oldUniqueName: string,
    newUniqueName: string
  ): string {
    const parsed = parseXml(xml) as Record<string, any>;
    const root = parsed["talendfile:ProcessType"] ?? parsed.ProcessType;
    if (!root || typeof root !== "object") {
      throw new Error("XML de job Talend inválido: falta ProcessType");
    }

    const rootObj = root as Record<string, any>;
    const nodes = Array.isArray(rootObj.node)
      ? rootObj.node
      : rootObj.node
        ? [rootObj.node]
        : [];
    let nodeFound = false;
    for (const node of nodes) {
      const params = Array.isArray(node.elementParameter)
        ? node.elementParameter
        : node.elementParameter
          ? [node.elementParameter]
          : [];
      const uniqueParam = params.find((p: any) => p["@_name"] === "UNIQUE_NAME");
      if (uniqueParam && uniqueParam["@_value"] === oldUniqueName) {
        uniqueParam["@_value"] = newUniqueName;
        nodeFound = true;
      }
    }

    if (!nodeFound) {
      throw new Error(`Componente ${oldUniqueName} no encontrado en el job.`);
    }

    const connections = Array.isArray(rootObj.connection)
      ? rootObj.connection
      : rootObj.connection
        ? [rootObj.connection]
        : [];
    for (const conn of connections) {
      if (conn["@_source"] === oldUniqueName) {
        conn["@_source"] = newUniqueName;
      }
      if (conn["@_target"] === oldUniqueName) {
        conn["@_target"] = newUniqueName;
      }
    }

    for (const node of nodes) {
      const params = Array.isArray(node.elementParameter)
        ? node.elementParameter
        : node.elementParameter
          ? [node.elementParameter]
          : [];
      for (const p of params) {
        if (p["@_value"] && typeof p["@_value"] === "string") {
          p["@_value"] = p["@_value"].replace(
            new RegExp(`\\b${oldUniqueName}\\b`, "g"),
            newUniqueName
          );
        }
      }
    }

    return buildXml(parsed);
  }
}
