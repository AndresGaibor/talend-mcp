import * as z from "zod/v4";
import { bridgeOk, bridgeFail } from "./tools-base";
import { getConfiguredProjectPath } from "../workspace";

export const snapshotTools = [
  {
    name: "talend_snapshot_list",
    description: "Lista los snapshots disponibles para el proyecto.",
    inputSchema: z.object({
      projectPath: z.string().optional().describe("Ruta al proyecto Talend"),
    }),
    handler: async ({ projectPath }: { projectPath?: string }) => {
      const { listSnapshots } = await import("../sync/snapshot-manager");
      const effectivePath = projectPath ?? getConfiguredProjectPath();
      if (!effectivePath) {
        return bridgeFail({
          ok: false,
          source: "unavailable",
          confidence: "low",
          endpoint: "/snapshot/list",
          error: { code: "NO_PROJECT", message: "No se detectó TALEND_PROJECT" },
        });
      }
      const snapshots = await listSnapshots(effectivePath);
      return bridgeOk({
        ok: true,
        source: "workspace-files",
        confidence: "high",
        endpoint: "/snapshot/list",
        data: { snapshots, count: snapshots.length },
      });
    },
  },
  {
    name: "talend_snapshot_read",
    description: "Lee el contenido de un snapshot específico.",
    inputSchema: z.object({
      projectPath: z.string().optional().describe("Ruta al proyecto Talend"),
      snapshotId: z.string().describe("ID del snapshot a leer"),
    }),
    handler: async ({ projectPath, snapshotId }: { projectPath?: string; snapshotId: string }) => {
      const { readSnapshot } = await import("../sync/snapshot-manager");
      const effectivePath = projectPath ?? getConfiguredProjectPath();
      if (!effectivePath) {
        return bridgeFail({
          ok: false,
          source: "unavailable",
          confidence: "low",
          endpoint: "/snapshot/read",
          error: { code: "NO_PROJECT", message: "No se detectó TALEND_PROJECT" },
        });
      }
      const manifest = await readSnapshot(effectivePath, snapshotId);
      if (!manifest) {
        return bridgeFail({
          ok: false,
          source: "workspace-files",
          confidence: "medium",
          endpoint: "/snapshot/read",
          error: { code: "SNAPSHOT_NOT_FOUND", message: "Snapshot no encontrado: " + snapshotId },
        });
      }
      return bridgeOk({
        ok: true,
        source: "workspace-files",
        confidence: "high",
        endpoint: "/snapshot/read",
        data: { manifest },
      });
    },
  },
  {
    name: "talend_snapshot_restore",
    description: "Restaura archivos desde un snapshot.",
    inputSchema: z.object({
      projectPath: z.string().optional().describe("Ruta al proyecto Talend"),
      snapshotId: z.string().describe("ID del snapshot a restaurar"),
    }),
    handler: async ({ projectPath, snapshotId }: { projectPath?: string; snapshotId: string }) => {
      const { restoreSnapshot } = await import("../sync/snapshot-manager");
      const effectivePath = projectPath ?? getConfiguredProjectPath();
      if (!effectivePath) {
        return bridgeFail({
          ok: false,
          source: "unavailable",
          confidence: "low",
          endpoint: "/snapshot/restore",
          error: { code: "NO_PROJECT", message: "No se detectó TALEND_PROJECT" },
        });
      }
      const result = await restoreSnapshot(effectivePath, snapshotId);
      return bridgeOk({
        ok: result.ok,
        source: result.ok ? "workspace-files" : "unavailable",
        confidence: result.ok ? "high" : "low",
        endpoint: "/snapshot/restore",
        data: {
          restoredFiles: result.restoredFiles,
          error: result.error,
        },
      });
    },
  },
  {
    name: "talend_snapshot_diff",
    description: "Muestra las diferencias entre un snapshot y los archivos actuales.",
    inputSchema: z.object({
      projectPath: z.string().optional().describe("Ruta al proyecto Talend"),
      snapshotId: z.string().describe("ID del snapshot a comparar"),
    }),
    handler: async ({ projectPath, snapshotId }: { projectPath?: string; snapshotId: string }) => {
      const { diffSnapshot } = await import("../sync/snapshot-manager");
      const effectivePath = projectPath ?? getConfiguredProjectPath();
      if (!effectivePath) {
        return bridgeFail({
          ok: false,
          source: "unavailable",
          confidence: "low",
          endpoint: "/snapshot/diff",
          error: { code: "NO_PROJECT", message: "No se detectó TALEND_PROJECT" },
        });
      }
      const result = await diffSnapshot(effectivePath, snapshotId);
      return bridgeOk({
        ok: result.ok,
        source: result.ok ? "workspace-files" : "unavailable",
        confidence: result.ok ? "high" : "low",
        endpoint: "/snapshot/diff",
        data: {
          diffs: result.diffs,
          error: result.error,
        },
      });
    },
  },
];