/**
 * Resume el informe de cobertura de componentes: cuantos pasan cada nivel y por que
 * fallan los demas.
 *
 *   bun run scripts/coverage-summary.ts                       # testdata/cobertura.csv
 *   bun run scripts/coverage-summary.ts informe.csv --top 20  # otro archivo, mas causas
 *
 * El informe lo genera `scripts/coverage.ts`. Los niveles estan en
 * docs/ROADMAP-DOMINIO-TALEND.md: aqui se cubren L1 (crear), L2 (configurar) y la
 * comprobacion de que el nodo queda en el job y se puede borrar.
 */

import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const file = args.find((arg) => !arg.startsWith("--") && args[args.indexOf(arg) - 1] !== "--top") ?? "testdata/cobertura.csv";
const topIndex = args.indexOf("--top");
const top = topIndex >= 0 ? Number(args[topIndex + 1] ?? 10) : 10;

type Row = {
  component: string;
  created: boolean;
  configured: boolean;
  saved: boolean;
  listed: boolean;
  deleted: boolean;
  error: string;
};

/** Parte una fila CSV respetando comillas dobles (el error va entre comillas). */
function splitCsv(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]!;
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

const lines = readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean);
const rows: Row[] = lines.slice(1).map((line) => {
  const cells = splitCsv(line);
  return {
    component: cells[0] ?? "",
    created: cells[1] === "si",
    configured: cells[2] === "si",
    saved: cells[3] === "si",
    listed: cells[4] === "si",
    deleted: cells[5] === "si",
    error: cells[8] ?? "",
  };
});

const total = rows.length;
const count = (predicate: (row: Row) => boolean) => rows.filter(predicate).length;
const pct = (n: number) => `${n} (${total === 0 ? 0 : Math.round((n / total) * 100)}%)`;

console.log(`Informe: ${file}`);
console.log(`Componentes probados:        ${total}`);
console.log(`L1 creado:                   ${pct(count((r) => r.created))}`);
console.log(`L2 con parametros aplicados: ${pct(count((r) => r.configured))}`);
console.log(`   guardado en el .item:     ${pct(count((r) => r.created && r.saved))}`);
console.log(`   en el job tras crearlo:   ${pct(count((r) => r.listed))}`);
console.log(`   borrado limpiamente:      ${pct(count((r) => r.deleted))}`);

/** Quita lo que varia entre filas (nombres de nodo, numeros) para agrupar por causa. */
function cause(message: string): string {
  return message
    .replace(/'[^']*'/g, "'X'")
    .replace(/\b[tT][A-Z][A-Za-z0-9]*_\d+\b/g, "NODO")
    .replace(/\d+/g, "N")
    .slice(0, 160);
}

const failures = rows.filter((row) => !row.created || row.error || !row.saved);
if (failures.length === 0) {
  console.log("\nSin fallos.");
  process.exit(0);
}

const groups = new Map<string, string[]>();
for (const row of failures) {
  const key = cause(row.error || (row.created && !row.saved ? "Creado pero Studio no pudo guardar el job con este nodo" : "(sin mensaje)"));
  const list = groups.get(key) ?? [];
  list.push(row.component);
  groups.set(key, list);
}

console.log(`\nFallos: ${failures.length}, en ${groups.size} causas distintas. Las ${Math.min(top, groups.size)} mas frecuentes:`);
for (const [key, components] of [...groups.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, top)) {
  const sample = components.slice(0, 5).join(", ");
  console.log(`\n  ${components.length} x ${key}\n     p. ej.: ${sample}${components.length > 5 ? ", ..." : ""}`);
}

// Por familia (prefijo del nombre) para ver donde se concentran.
const families = new Map<string, { total: number; failed: number }>();
for (const row of rows) {
  const family = row.component.match(/^t?([A-Z][a-z0-9]*)/)?.[1] ?? row.component;
  const entry = families.get(family) ?? { total: 0, failed: 0 };
  entry.total += 1;
  if (!row.created || row.error || !row.saved) entry.failed += 1;
  families.set(family, entry);
}
const worst = [...families.entries()].filter(([, v]) => v.failed > 0).sort((a, b) => b[1].failed - a[1].failed).slice(0, 12);
if (worst.length > 0) {
  console.log("\nFamilias con mas fallos (prefijo del nombre):");
  for (const [name, value] of worst) {
    console.log(`  ${name.padEnd(18)} ${value.failed}/${value.total}`);
  }
}
