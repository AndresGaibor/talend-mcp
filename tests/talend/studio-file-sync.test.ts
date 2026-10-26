import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { getSyncStatus } from "../../src/talend/sync/studio-file-sync";
import { mergeSyncResults } from "../../src/talend/sync/studio-file/merge";
import type { SyncResult, SyncStep } from "../../src/talend/sync/studio-file/types";

// Proyecto inexistente: listSnapshots no crea nada y devuelve lista vacia.
function missingProjectPath(): string {
  return join(tmpdir(), "talend-sync-status-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8));
}

// Resultado posterior a la edicion con pasos controlados.
function afterResult(steps: SyncStep[]): SyncResult {
  return {
    ok: true,
    source: "workspace-files",
    confidence: "medium",
    steps,
    editedFiles: ["job_0.1.item"],
    validatedWithStudio: false,
    snapshotPath: null,
  };
}

describe("estado de sincronizacion", () => {
  test("sin bridge ni snapshots reporta workspace-files y confianza media", async () => {
    const status = await getSyncStatus(missingProjectPath(), null);

    expect(status).toEqual({
      ok: true,
      source: "workspace-files",
      confidence: "medium",
      jobOpen: false,
      editorDirty: false,
      editorTitle: null,
      itemPath: null,
      propertiesPath: null,
      hasSnapshot: false,
      snapshotPath: null,
      bridgeAvailable: false,
    });
  });

  test("con bridge disponible detecta el job abierto y su estado dirty", async () => {
    const status = await getSyncStatus(missingProjectPath(), {
      workbenchState: async () => ({
        ok: true,
        data: {
          windows: [{ activeEditor: { title: "Job MiJob_0.1", dirty: true } }],
        },
      }),
    });

    expect(status.bridgeAvailable).toBe(true);
    expect(status.source).toBe("mcp+studio-bridge");
    expect(status.confidence).toBe("high");
    expect(status.jobOpen).toBe(true);
    expect(status.editorDirty).toBe(true);
    expect(status.editorTitle).toBe("Job MiJob_0.1");
  });

  test("un editor que no es job de Talend no se marca como job abierto", async () => {
    const status = await getSyncStatus(missingProjectPath(), {
      workbenchState: async () => ({
        ok: true,
        data: { windows: [{ activeEditor: { title: "README.md", dirty: false } }] },
      }),
    });

    expect(status.jobOpen).toBe(false);
    expect(status.editorDirty).toBe(false);
    expect(status.bridgeAvailable).toBe(true);
  });
});

describe("merge de pasos de sincronizacion", () => {
  test("conserva el snapshot previo y concatena los pasos", () => {
    const before: SyncStep[] = [
      { name: "validate_inputs", ok: true },
      { name: "snapshot_created", ok: true },
      { name: "apply_xml_edit", ok: true },
      { name: "write_item_file", ok: true },
    ];

    const merged = mergeSyncResults(before, "/tmp/snap.json", "apply_xml_edit", afterResult([
      { name: "workspace_refreshed", ok: true },
    ]));

    expect(merged.ok).toBe(true);
    expect(merged.snapshotPath).toBe("/tmp/snap.json");
    expect(merged.steps).toHaveLength(5);
    expect(merged.editedFiles).toEqual(["job_0.1.item"]);
  });

  test("un paso critico fallido marca el resultado como no ok", () => {
    const merged = mergeSyncResults(
      [
        { name: "validate_inputs", ok: true },
        { name: "snapshot_created", ok: false },
        { name: "apply_xml_patch", ok: true },
        { name: "write_item_file", ok: true },
      ],
      "/tmp/snap.json",
      "apply_xml_patch",
      afterResult([])
    );

    expect(merged.ok).toBe(false);
  });

  test("un paso no critico fallido no cambia el ok", () => {
    const merged = mergeSyncResults(
      [
        { name: "validate_inputs", ok: true },
        { name: "snapshot_created", ok: true },
        { name: "apply_xml_connection", ok: true },
        { name: "write_item_file", ok: true },
      ],
      null,
      "apply_xml_connection",
      afterResult([{ name: "workspace_refreshed", ok: false, error: "Bridge no disponible" }])
    );

    expect(merged.ok).toBe(true);
    expect(merged.snapshotPath).toBeNull();
  });
});
