import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { getErrorById, type KnownError } from "./error-knowledge-base";

export type FixPreview = {
  errorId: string;
  filePath: string;
  originalContent: string;
  proposedContent: string;
  changes: FixChange[];
  canApply: boolean;
  risk: "low" | "medium" | "high";
};

export type FixChange = {
  type: "replace" | "remove" | "add";
  xpath: string;
  description: string;
  before?: string;
  after?: string;
};

export type FixApplyResult = {
  ok: boolean;
  errorId: string;
  filePath: string;
  backupPath: string | null;
  applied: boolean;
  error?: string;
};

export async function previewFix(
  errorId: string,
  filePath: string,
  errorMessage: string
): Promise<FixPreview | null> {
  const err = getErrorById(errorId);
  if (!err || !err.canAutoFix) {
    return null;
  }

  if (!existsSync(filePath)) {
    return null;
  }

  const content = readFileSync(filePath, "utf8");
  const changes: FixChange[] = [];

  let proposedContent = content;

  if (errorId === "duplicate_unique_name") {
    proposedContent = fixDuplicateUniqueName(content, errorMessage, changes);
  } else if (errorId === "dangling_connection") {
    proposedContent = fixDanglingConnection(content, errorMessage, changes);
  } else {
    return null;
  }

  return {
    errorId,
    filePath,
    originalContent: content,
    proposedContent,
    changes,
    canApply: changes.length > 0,
    risk: changes.length > 3 ? "high" : changes.length > 1 ? "medium" : "low",
  };
}

function fixDuplicateUniqueName(
  xml: string,
  errorMessage: string,
  changes: FixChange[]
): string {
  const uniqueNameRegex = /uniqueName="([^"]+)"/g;
  const seen = new Map<string, number>();
  let match;
  let result = xml;

  const matches = [...xml.matchAll(uniqueNameRegex)];
  for (const m of matches) {
    const name = m[1] ?? "";
    if (!name) continue;
    const count = (seen.get(name) ?? 0) + 1;
    seen.set(name, count);
    if (count > 1) {
      const newName = name + "_" + count;
      result = result.replace(
        `uniqueName="${name}"`,
        `uniqueName="${newName}"`
      );
      changes.push({
        type: "replace",
        xpath: `//*[@uniqueName="${name}"]`,
        description: `Renombrar uniqueName duplicado: ${name} → ${newName}`,
        before: `uniqueName="${name}"`,
        after: `uniqueName="${newName}"`,
      });
    }
  }

  return result;
}

function fixDanglingConnection(
  xml: string,
  errorMessage: string,
  changes: FixChange[]
): string {
  const connectionRegex = /<node[^>]* connectorName="([^"]*)"[^>]*source="([^"]*)"[^>]*target="([^"]*)"[^>]*\/>/g;
  const componentSet = new Set<string>();

  const nodeRegex = /<node[^>]*uniqueName="([^"]+)"[^>]*\/>/g;
  let nodeMatch;
  while ((nodeMatch = nodeRegex.exec(xml)) !== null) {
    const name = nodeMatch[1];
    if (name) componentSet.add(name);
  }

  let result = xml;
  const danglingRegex = /<connection[^>]*(source|target)="([^"]+)"[^>]*\/(>|\s*>)/g;
  let dMatch;
  const toRemove: string[] = [];

  while ((dMatch = danglingRegex.exec(xml)) !== null) {
    const connFull = dMatch[0];
    const sourceOrTarget = dMatch[1];
    const value = dMatch[2];

    const fullConnRegex = new RegExp(
      `<connection[^>]*${sourceOrTarget}="${value}"[^>]*\\/?>`,
      "g"
    );
    const connMatch = fullConnRegex.exec(xml);
    if (connMatch) {
      toRemove.push(connMatch[0]);
      changes.push({
        type: "remove",
        xpath: `//connection[@${sourceOrTarget}="${value}"]`,
        description: `Eliminar conexión colgante con ${sourceOrTarget}="${value}"`,
        before: connMatch[0],
      });
      result = result.split(connMatch[0]).join("");
    }
  }

  return result;
}

export async function applyFix(
  errorId: string,
  filePath: string,
  errorMessage: string
): Promise<FixApplyResult> {
  const preview = await previewFix(errorId, filePath, errorMessage);
  if (!preview || !preview.canApply) {
    return {
      ok: false,
      errorId,
      filePath,
      backupPath: null,
      applied: false,
      error: "No se puede aplicar fix: preview no disponible o no hay cambios",
    };
  }

  const backupPath = filePath + ".backup_before_fix";
  try {
    writeFileSync(backupPath, preview.originalContent, "utf8");
    writeFileSync(filePath, preview.proposedContent, "utf8");
    return {
      ok: true,
      errorId,
      filePath,
      backupPath,
      applied: true,
    };
  } catch (e) {
    return {
      ok: false,
      errorId,
      filePath,
      backupPath: null,
      applied: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function restoreFromBackup(filePath: string, backupPath: string): Promise<boolean> {
  if (!existsSync(backupPath)) {
    return false;
  }
  try {
    const content = readFileSync(backupPath, "utf8");
    writeFileSync(filePath, content, "utf8");
    return true;
  } catch {
    return false;
  }
}