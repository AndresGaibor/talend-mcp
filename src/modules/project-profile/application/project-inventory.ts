import { existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

export type InventoryItem = { name: string; version: string; folder: string };
export type ProjectInventory = {
  jobs: InventoryItem[];
  joblets: InventoryItem[];
  contexts: InventoryItem[];
  routines: InventoryItem[];
  metadata: Record<string, InventoryItem[]>; // clave = subcarpeta de metadata/ (connections, fileDelimited, ...)
};

// Lee los .item de una categoria de forma recursiva; una carpeta ausente da lista vacia.
function readCategory(dir: string): InventoryItem[] {
  if (!existsSync(dir)) return [];
  const items: InventoryItem[] = [];
  for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".item")) continue;
    const base = entry.name.slice(0, -".item".length);
    // La version es lo que va tras el ultimo "_"; el nombre puede contener guiones bajos.
    // Un .item sin "_" sale con version "" y el base completo como nombre.
    const cut = base.lastIndexOf("_");
    const folder = relative(dir, entry.parentPath).replace(/\\/g, "/");
    items.push({
      name: cut < 0 ? base : base.slice(0, cut),
      version: cut < 0 ? "" : base.slice(cut + 1),
      folder,
    });
  }
  // readdir no garantiza orden: se ordena por carpeta y nombre con comparacion de cadenas.
  const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  return items.sort((a, b) => cmp(a.folder, b.folder) || cmp(a.name, b.name));
}

export function readProjectInventory(projectPath: string): ProjectInventory {
  const metadata: Record<string, InventoryItem[]> = {};
  const metadataDir = join(projectPath, "metadata");
  if (existsSync(metadataDir)) {
    for (const entry of readdirSync(metadataDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const items = readCategory(join(metadataDir, entry.name));
      if (items.length > 0) metadata[entry.name] = items;
    }
  }
  return {
    jobs: readCategory(join(projectPath, "process")),
    joblets: readCategory(join(projectPath, "joblets")),
    contexts: readCategory(join(projectPath, "context")),
    routines: readCategory(join(projectPath, "code", "routines")),
    metadata,
  };
}
