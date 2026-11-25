import type { InventoryItem, ProjectInventory } from "./project-inventory";

// Umbrales para considerar valida una convencion de nombres.
export const MIN_COUNT = 3;
export const MIN_SHARE = 0.5;

const MAX_CANDIDATES = 10;

export type NamingConvention = { category: string; prefix: string; count: number; total: number };

// Minusculas y sin tildes, para comparar nombres y propositos.
function plain(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

// Una convencion por categoria: el prefijo (texto antes del primer "_") mas frecuente.
export function detectConventions(inventory: ProjectInventory): NamingConvention[] {
  const result: NamingConvention[] = [];
  for (const category of ["jobs", "joblets", "contexts"] as const) {
    const items = inventory[category];
    const counts = new Map<string, number>();
    for (const item of items) {
      const cut = item.name.indexOf("_");
      if (cut <= 0) continue; // sin "_" no hay prefijo
      const prefix = item.name.slice(0, cut);
      counts.set(prefix, (counts.get(prefix) ?? 0) + 1);
    }
    let best: NamingConvention | undefined;
    for (const [prefix, count] of counts) {
      if (count < MIN_COUNT || count / items.length < MIN_SHARE) continue;
      // Empate: gana el prefijo alfabeticamente menor.
      if (!best || count > best.count || (count === best.count && prefix < best.prefix)) {
        best = { category, prefix, count, total: items.length };
      }
    }
    if (best) result.push(best);
  }
  return result;
}

export function findGaps(inventory: ProjectInventory): string[] {
  const gaps: string[] = [];
  if (inventory.contexts.length === 0) {
    gaps.push("No hay contextos de proyecto: pregunta que variables y entornos usar.");
  }
  if (!inventory.metadata.connections?.length && !inventory.metadata.JDBC?.length) {
    gaps.push("No hay conexiones de base de datos en el repositorio: pregunta a que base de datos conectar.");
  }
  if (inventory.jobs.length === 0) {
    gaps.push("El proyecto no tiene jobs: no hay convenciones que deducir; pregunta como nombrarlos.");
  }
  if (inventory.joblets.length === 0) {
    gaps.push("No hay joblets: la logica comun va en un job hijo con tRunJob.");
  }
  return gaps;
}

// Palabras funcionales del castellano: no dicen nada del dominio del proposito.
const FUNCTION_WORDS = new Set([
  "para", "con", "los", "las", "una", "uno", "del", "que", "por", "desde", "hacia", "sobre", "entre", "este", "esta", "como",
]);

export function findReuseCandidates(
  inventory: ProjectInventory,
  purpose: string,
): Array<{ category: string; name: string; folder: string }> {
  const words = (plain(purpose).match(/[a-z]{3,}/g) ?? []).filter((word) => !FUNCTION_WORDS.has(word));
  // shortcut: prefijo de token (raiz de 4 letras; 3 letras enteras), sin stemming ni sinonimos; subir a stemming si hay falsos positivos
  const probes = words.map((word) => (word.length === 3 ? word : word.slice(0, 4)));
  if (probes.length === 0) return [];

  const groups: Array<[string, InventoryItem[]]> = [
    ["jobs", inventory.jobs],
    ["joblets", inventory.joblets],
    ["contexts", inventory.contexts],
  ];
  for (const key of Object.keys(inventory.metadata).sort()) {
    groups.push([`metadata/${key}`, inventory.metadata[key] ?? []]);
  }

  const found: Array<{ category: string; name: string; folder: string }> = [];
  for (const [category, items] of groups) {
    for (const item of items) {
      // Tokens: nombre en minusculas y sin tildes, partido por cualquier caracter no alfanumerico.
      const tokens = plain(item.name).split(/[^a-z0-9]+/).filter(Boolean);
      if (!probes.some((probe) => tokens.some((token) => token.startsWith(probe)))) continue;
      found.push({ category, name: item.name, folder: item.folder });
      if (found.length === MAX_CANDIDATES) return found;
    }
  }
  return found;
}
