import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const CATALOG_DIR = ".talend-mcp";
const CATALOG_FILE = "command-catalog.json";

export type CommandEntry = {
  id: string;
  name: string;
  category: string;
  risk: "safe" | "medium" | "danger";
  allowed: boolean;
  tested: boolean;
  description?: string;
};

export type CommandCatalog = {
  version: number;
  generatedAt: number;
  commands: CommandEntry[];
};

function ensureCatalogDir(): string {
  const dir = join(process.cwd(), CATALOG_DIR);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

const KNOWN_COMMANDS: CommandEntry[] = [
  { id: "org.eclipse.ui.file.save", name: "Save", category: "File", risk: "safe", allowed: true, tested: true },
  { id: "org.eclipse.ui.file.saveAll", name: "Save All", category: "File", risk: "safe", allowed: true, tested: true },
  { id: "org.eclipse.ui.file.close", name: "Close", category: "File", risk: "safe", allowed: true, tested: true },
  { id: "org.eclipse.ui.file.closeAll", name: "Close All", category: "File", risk: "safe", allowed: true, tested: true },
  { id: "org.eclipse.ui.window.showView", name: "Show View", category: "View", risk: "safe", allowed: true, tested: true },
  { id: "org.eclipse.ui.window.activateEditor", name: "Activate Editor", category: "Editor", risk: "safe", allowed: true, tested: true },
  { id: "org.eclipse.ltk.ui.refactor.createRefactoringScript", name: "Create Refactoring Script", category: "Refactor", risk: "medium", allowed: false, tested: false },
  { id: "org.eclipse.jdt.ui.edit.text.java.organize.imports", name: "Organize Imports", category: "Java", risk: "safe", allowed: true, tested: false },
  { id: "org.eclipse.ui.edit.rename", name: "Rename", category: "Edit", risk: "medium", allowed: true, tested: false },
  { id: "org.eclipse.ui.edit.delete", name: "Delete", category: "Edit", risk: "medium", allowed: false, tested: false },
  { id: "org.eclipse.ui.file.refresh", name: "Refresh", category: "File", risk: "safe", allowed: true, tested: true },
  { id: "org.eclipse.debug.ui.actions.RunLastAction", name: "Run Last", category: "Launch", risk: "medium", allowed: true, tested: false },
  { id: "org.eclipse.debug.ui.actions.DebugLastAction", name: "Debug Last", category: "Launch", risk: "medium", allowed: true, tested: false },
  { id: "org.talend.common.runTalendElement", name: "Run Talend Element", category: "Talend", risk: "medium", allowed: true, tested: false },
  { id: "org.talend.command.importRepositoryOverwrite", name: "Import Repository (Overwrite)", category: "Talend", risk: "danger", allowed: false, tested: false },
  { id: "org.eclipse.ui.project.clean", name: "Clean Project", category: "Project", risk: "medium", allowed: true, tested: false },
  { id: "org.eclipse.ui.file.export", name: "Export", category: "File", risk: "medium", allowed: false, tested: false },
  { id: "org.eclipse.ui.file.import", name: "Import", category: "File", risk: "medium", allowed: false, tested: false },
  { id: "org.eclipse.egit.ui.team.Push", name: "Push to Remote", category: "Git", risk: "danger", allowed: false, tested: false },
];

function loadCatalog(): CommandCatalog {
  const catalogPath = join(ensureCatalogDir(), CATALOG_FILE);
  if (!existsSync(catalogPath)) {
    return { version: 1, generatedAt: Date.now(), commands: [...KNOWN_COMMANDS] };
  }
  try {
    const content = readFileSync(catalogPath, "utf8");
    return JSON.parse(content) as CommandCatalog;
  } catch {
    return { version: 1, generatedAt: Date.now(), commands: [...KNOWN_COMMANDS] };
  }
}

function saveCatalog(catalog: CommandCatalog): void {
  const catalogPath = join(ensureCatalogDir(), CATALOG_FILE);
  writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), "utf8");
}

export function getCommandCatalog(): CommandCatalog {
  return loadCatalog();
}

export function searchCommands(query: string): CommandEntry[] {
  const catalog = loadCatalog();
  if (!query.trim()) return catalog.commands.slice(0, 50);
  const lower = query.toLowerCase();
  return catalog.commands.filter(
    (c) =>
      c.id.toLowerCase().includes(lower) ||
      c.name.toLowerCase().includes(lower) ||
      c.category.toLowerCase().includes(lower)
  );
}

export function getCommand(id: string): CommandEntry | null {
  const catalog = loadCatalog();
  return catalog.commands.find((c) => c.id === id) ?? null;
}

export function allowCommand(id: string): boolean {
  const catalog = loadCatalog();
  const cmd = catalog.commands.find((c) => c.id === id);
  if (!cmd) return false;
  cmd.allowed = true;
  saveCatalog(catalog);
  return true;
}

export function blockCommand(id: string): boolean {
  const catalog = loadCatalog();
  const cmd = catalog.commands.find((c) => c.id === id);
  if (!cmd) return false;
  cmd.allowed = false;
  saveCatalog(catalog);
  return true;
}

export function classifyCommand(id: string, name: string, category: string): CommandEntry {
  const catalog = loadCatalog();
  let cmd = catalog.commands.find((c) => c.id === id);
  if (cmd) return cmd;
  const risk = classifyRisk(category, name);
  cmd = { id, name, category, risk, allowed: risk === "safe", tested: false };
  catalog.commands.push(cmd);
  saveCatalog(catalog);
  return cmd;
}

function classifyRisk(category: string, name: string): "safe" | "medium" | "danger" {
  const c = category.toLowerCase();
  const n = name.toLowerCase();
  if (c.includes("file") && (n.includes("save") || n.includes("close") || n.includes("refresh"))) return "safe";
  if (c.includes("view") || c.includes("editor")) return "safe";
  if (c.includes("launch") || c.includes("run") || c.includes("debug")) return "medium";
  if (c.includes("delete") || c.includes("overwrite") || c.includes("import") || c.includes("push") || c.includes("repository switch")) return "danger";
  return "medium";
}

export function isCommandAllowed(id: string): boolean {
  const cmd = getCommand(id);
  return cmd?.allowed ?? false;
}

export function getAllowedCommands(): CommandEntry[] {
  const catalog = loadCatalog();
  return catalog.commands.filter((c) => c.allowed);
}

export function getDangerCommands(): CommandEntry[] {
  const catalog = loadCatalog();
  return catalog.commands.filter((c) => c.risk === "danger");
}

export function scanAndUpdateCatalog(nativeCommands: Array<{ id: string; name?: string }>): number {
  const catalog = loadCatalog();
  let updated = 0;
  for (const nc of nativeCommands) {
    const existing = catalog.commands.find((c) => c.id === nc.id);
    if (!existing) {
      const risk = classifyRisk("Unknown", nc.name ?? nc.id);
      catalog.commands.push({
        id: nc.id,
        name: nc.name ?? nc.id,
        category: "Unknown",
        risk,
        allowed: risk === "safe",
        tested: false,
      });
      updated++;
    }
  }
  if (updated > 0) saveCatalog(catalog);
  return updated;
}