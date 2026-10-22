/**
 * Cobertura del catalogo por familia: que compila, que falla y que no se ha intentado.
 *
 * Lee los informes que deja `scripts/coverage.ts` (`testdata/cobertura-*.csv`) y los
 * cruza con el catalogo de componentes instalados (los `*_java.xml` de los plugins de
 * Studio). Sirve para decidir la siguiente tanda de medicion: las familias con mas
 * huecos van primero.
 *
 * Un componente cuenta como que compila si en **cualquier** corrida salio `compila=si`;
 * un componente que solo aparece en informes sin columna `compila` (los de L1/L2) no
 * cuenta como medido a L4.
 *
 * ```
 * bun run scripts/cobertura-familias.ts              # todas las familias con huecos
 * bun run scripts/cobertura-familias.ts --todas      # todas, sin filtrar
 * bun run scripts/cobertura-familias.ts --familia DB # solo las que contengan ese texto
 * bun run scripts/cobertura-familias.ts --pendientes # la lista de componentes sin L4, para --components
 * ```
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { resolveTalendPluginsDir } from "../src/talend/components/talend-paths";

const args = process.argv.slice(2);
const todas = args.includes("--todas");
const soloPendientes = args.includes("--pendientes");
const indiceFamilia = args.indexOf("--familia");
const filtroFamilia = indiceFamilia >= 0 ? (args[indiceFamilia + 1] ?? "").toLowerCase() : undefined;
const carpeta = "testdata";

type Estado = "si" | "no" | "sin";

/** Lee un CSV con comillas y campos con saltos de linea. */
function leerCsv(texto: string): string[][] {
  const filas: string[][] = [];
  let campo = "";
  let fila: string[] = [];
  let entreComillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]!;
    if (entreComillas) {
      if (c === '"' && texto[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') {
        entreComillas = false;
      } else {
        campo += c;
      }
    } else if (c === '"') {
      entreComillas = true;
    } else if (c === ",") {
      fila.push(campo);
      campo = "";
    } else if (c === "\n") {
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = "";
    } else if (c !== "\r") {
      campo += c;
    }
  }
  if (campo.length > 0 || fila.length > 0) {
    fila.push(campo);
    filas.push(fila);
  }
  return filas;
}

/** Estado de L4 de cada componente, segun todos los informes. */
function leerMedidos(): Map<string, Estado> {
  const medidos = new Map<string, Estado>();
  for (const fichero of readdirSync(carpeta)) {
    if (!fichero.startsWith("cobertura") || !fichero.endsWith(".csv")) continue;
    const filas = leerCsv(readFileSync(join(carpeta, fichero), "utf8"));
    const cabecera = filas[0] ?? [];
    const columna = cabecera.indexOf("compila");
    if (columna < 0) continue; // informe de L1/L2: no dice nada de la compilacion
    for (const fila of filas.slice(1)) {
      const nombre = fila[0];
      if (!nombre) continue;
      const valor = fila[columna];
      const nuevo: Estado = valor === "si" ? "si" : valor === "no" ? "no" : "sin";
      const previo = medidos.get(nombre);
      if (previo === "si") continue; // ya compilo en otra corrida
      if (previo === "no" && nuevo === "sin") continue; // no perder un fallo conocido
      medidos.set(nombre, nuevo);
    }
  }
  return medidos;
}

/** Familia de cada componente instalado, leida de su XML de definicion. */
function leerCatalogo(): Map<string, string> {
  const plugins = resolveTalendPluginsDir();
  if (!plugins) {
    console.error("No se encontro el directorio de plugins de Talend Studio (TALEND_STUDIO_PLUGINS_DIR).");
    process.exit(1);
  }

  const catalogo = new Map<string, string>();
  for (const plugin of readdirSync(plugins)) {
    if (!plugin.startsWith("org.talend.designer.components.")) continue;
    const componentes = join(plugins, plugin, "components");
    let entradas: string[];
    try {
      entradas = readdirSync(componentes);
    } catch {
      continue;
    }
    for (const entrada of entradas) {
      if (catalogo.has(entrada)) continue; // el mismo componente en dos plugins: vale el primero
      let texto: string;
      try {
        texto = readFileSync(join(componentes, entrada, `${entrada}_java.xml`), "utf8");
      } catch {
        continue;
      }
      const familia = /<FAMILY>([^<]*)<\/FAMILY>/.exec(texto)?.[1]?.trim() ?? "(sin familia)";
      catalogo.set(entrada, familia);
    }
  }
  return catalogo;
}

type Cuenta = { total: number; compilan: number; fallan: number; nunca: number };

const medidos = leerMedidos();
const catalogo = leerCatalogo();

const porFamilia = new Map<string, Cuenta>();
const pendientes: string[] = [];
for (const [componente, familia] of [...catalogo].sort((a, b) => a[0].localeCompare(b[0]))) {
  const cuenta = porFamilia.get(familia) ?? { total: 0, compilan: 0, fallan: 0, nunca: 0 };
  cuenta.total++;
  const estado = medidos.get(componente) ?? "sin";
  if (estado === "si") {
    cuenta.compilan++;
  } else if (estado === "no") {
    cuenta.fallan++;
  } else {
    cuenta.nunca++;
    pendientes.push(componente);
  }
  porFamilia.set(familia, cuenta);
}

if (soloPendientes) {
  // La lista tal cual la espera `coverage.ts --components`.
  console.log(pendientes.join(","));
  process.exit(0);
}

const filas = [...porFamilia]
  .filter(([familia, cuenta]) => (filtroFamilia ? familia.toLowerCase().includes(filtroFamilia) : true))
  .filter(([, cuenta]) => todas || cuenta.fallan + cuenta.nunca > 0)
  .sort((a, b) => b[1].nunca + b[1].fallan - (a[1].nunca + a[1].fallan));

console.log("familia".padEnd(46) + "compilan  fallan  nunca  total");
for (const [familia, cuenta] of filas) {
  console.log(
    familia.padEnd(46) +
      String(cuenta.compilan).padStart(7) +
      String(cuenta.fallan).padStart(8) +
      String(cuenta.nunca).padStart(7) +
      String(cuenta.total).padStart(7),
  );
}

const total = [...porFamilia.values()].reduce(
  (acumulado, cuenta) => ({
    total: acumulado.total + cuenta.total,
    compilan: acumulado.compilan + cuenta.compilan,
    fallan: acumulado.fallan + cuenta.fallan,
    nunca: acumulado.nunca + cuenta.nunca,
  }),
  { total: 0, compilan: 0, fallan: 0, nunca: 0 },
);

const porcentaje = total.total > 0 ? Math.round((total.compilan * 100) / total.total) : 0;
console.log("");
console.log(`Catalogo:  ${total.total} componentes en ${porFamilia.size} familias`);
console.log(`Compilan:  ${total.compilan} (${porcentaje} %)`);
console.log(`Fallan:    ${total.fallan}`);
console.log(`Sin medir: ${total.nunca}`);
console.log("");
console.log("La lista de los que faltan, para `coverage.ts --components`:");
console.log("  bun run scripts/cobertura-familias.ts --pendientes");
