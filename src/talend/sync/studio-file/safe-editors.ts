import { writeFileSync } from "node:fs";

import type { SyncResult, SyncStep } from "./types";
import { beforeFileEdit, afterFileEdit } from "./lifecycle";
import { mergeSyncResults } from "./merge";

// Ejecuta el ciclo comun de edicion segura: validar, snapshot, escribir y revalidar.
async function runSafeSyncOperation(
  projectPath: string,
  itemPath: string,
  propertiesPath: string,
  bridgeClient: any,
  writeStepName: string,
  missingXmlError: string,
  operationFn: () => { ok: boolean; xml?: string }
): Promise<SyncResult> {
  const steps: SyncStep[] = [];
  const startTime = Date.now();

  steps.push({ name: "validate_inputs", ok: true, durationMs: Date.now() - startTime });

  const beforeResult = await beforeFileEdit(projectPath, itemPath, propertiesPath, bridgeClient);
  if (!beforeResult.ok && beforeResult.blocked) {
    return {
      ok: false,
      source: "unavailable",
      confidence: "low",
      steps: [{ name: "before_file_edit_blocked", ok: false, error: beforeResult.reason ?? "Blocked" }],
      editedFiles: [],
      validatedWithStudio: false,
      snapshotPath: beforeResult.snapshotPath,
    };
  }

  steps.push({ name: "snapshot_created", ok: beforeResult.snapshotCreated });

  const editStart = Date.now();
  const operationResult = operationFn();
  steps.push({ name: writeStepName, ok: operationResult.ok, durationMs: Date.now() - editStart });

  if (!operationResult.ok) {
    return {
      ok: false,
      source: "workspace-files",
      confidence: "medium",
      steps,
      editedFiles: [],
      validatedWithStudio: false,
      snapshotPath: beforeResult.snapshotPath,
    };
  }

  const writeStart = Date.now();
  if (!operationResult.xml) {
    steps.push({
      name: "write_item_file",
      ok: false,
      error: missingXmlError,
      durationMs: Date.now() - writeStart,
    });
    return {
      ok: false,
      source: "workspace-files",
      confidence: "low",
      steps,
      editedFiles: [],
      validatedWithStudio: false,
      snapshotPath: beforeResult.snapshotPath,
    };
  }
  writeFileSync(itemPath, operationResult.xml, "utf8");
  steps.push({ name: "write_item_file", ok: true, durationMs: Date.now() - writeStart });

  const afterResult = await afterFileEdit(projectPath, [itemPath], bridgeClient);

  return mergeSyncResults(steps, beforeResult.snapshotPath, writeStepName, afterResult);
}

export async function safeEditComponentParameter(
  projectPath: string,
  itemPath: string,
  propertiesPath: string,
  bridgeClient: any,
  editFn: () => { ok: boolean; editedXml?: string }
): Promise<SyncResult> {
  return runSafeSyncOperation(
    projectPath,
    itemPath,
    propertiesPath,
    bridgeClient,
    "apply_xml_edit",
    "editResult.editedXml no fue devuelto",
    () => {
      const editResult = editFn();
      return { ok: editResult.ok, xml: editResult.editedXml };
    }
  );
}

export async function safePatchComponent(
  projectPath: string,
  itemPath: string,
  propertiesPath: string,
  bridgeClient: any,
  patchFn: () => { ok: boolean; patchedXml?: string }
): Promise<SyncResult> {
  return runSafeSyncOperation(
    projectPath,
    itemPath,
    propertiesPath,
    bridgeClient,
    "apply_xml_patch",
    "patchResult.patchedXml no fue devuelto",
    () => {
      const patchResult = patchFn();
      return { ok: patchResult.ok, xml: patchResult.patchedXml };
    }
  );
}

export async function safeAddConnection(
  projectPath: string,
  itemPath: string,
  propertiesPath: string,
  bridgeClient: any,
  connectionFn: () => { ok: boolean; modifiedXml?: string }
): Promise<SyncResult> {
  return runSafeSyncOperation(
    projectPath,
    itemPath,
    propertiesPath,
    bridgeClient,
    "apply_xml_connection",
    "connResult.modifiedXml no fue devuelto",
    () => {
      const connResult = connectionFn();
      return { ok: connResult.ok, xml: connResult.modifiedXml };
    }
  );
}
