/**
 * Muestra la definicion instalada de uno o varios componentes de Talend.
 *
 *   bun run scripts/inspect-component.ts --plugins-dir <studio>/plugins tJoin tLogCatcher
 *   bun run scripts/inspect-component.ts --plugins-dir <studio>/plugins --file begin tJoin
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

type ArchivoComponente = "xml" | "begin" | "main" | "end";

const USO = `Uso:
  bun run scripts/inspect-component.ts --plugins-dir <ruta/plugins> [--file xml|begin|main|end|all] <componente...>

Ejemplo:
  bun run scripts/inspect-component.ts --plugins-dir "<Studio>/plugins" --file begin tLogCatcher tJoin`;

function argumentos(argv: string[]): { pluginsDir: string; archivos: ArchivoComponente[]; componentes: string[] } {
  let pluginsDir: string | undefined;
  let archivos: ArchivoComponente[] = ["xml", "begin", "main", "end"];
  const componentes: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const argumento = argv[i]!;
    if (argumento === "--plugins-dir") {
      pluginsDir = argv[++i];
    } else if (argumento === "--file") {
      const valor = argv[++i];
      if (valor === "all") {
        archivos = ["xml", "begin", "main", "end"];
      } else if (valor === "xml" || valor === "begin" || valor === "main" || valor === "end") {
        archivos = [valor];
      } else {
        throw new Error(`Tipo de archivo no valido: ${String(valor)}\n\n${USO}`);
      }
    } else if (argumento === "--help" || argumento === "-h") {
      console.log(USO);
      process.exit(0);
    } else if (argumento.startsWith("-")) {
      throw new Error(`Opcion desconocida: ${argumento}\n\n${USO}`);
    } else {
      componentes.push(argumento);
    }
  }

  if (!pluginsDir || componentes.length === 0) {
    throw new Error(USO);
  }
  return { pluginsDir: resolve(pluginsDir), archivos, componentes };
}

function directoriosDeComponentes(pluginsDir: string, nombre: string): string[] {
  if (!existsSync(pluginsDir) || !statSync(pluginsDir).isDirectory()) {
    throw new Error(`No existe el directorio de plugins: ${pluginsDir}`);
  }

  const candidatos: string[] = [];
  for (const plugin of readdirSync(pluginsDir)) {
    const components = join(pluginsDir, plugin, "components");
    const component = join(components, nombre);
    if (existsSync(join(component, `${nombre}_java.xml`))) {
      candidatos.push(component);
    }
  }
  return candidatos;
}

function nombreArchivo(nombre: string, tipo: ArchivoComponente): string {
  if (tipo === "xml") return `${nombre}_java.xml`;
  return `${nombre}_${tipo}.javajet`;
}

function imprimirArchivo(ruta: string): void {
  const lineas = readFileSync(ruta, "utf8").split(/\r?\n/);
  console.log(`\n--- ${ruta} (${lineas.length} lineas) ---`);
  lineas.forEach((linea, indice) => {
    console.log(`${String(indice + 1).padStart(4, " ")}  ${linea}`);
  });
}

try {
  const { pluginsDir, archivos, componentes } = argumentos(process.argv.slice(2));
  let errores = 0;

  for (const nombre of componentes) {
    const directorios = directoriosDeComponentes(pluginsDir, nombre);
    if (directorios.length === 0) {
      console.error(`No se encontro ${nombre} en ${pluginsDir}`);
      errores++;
      continue;
    }
    if (directorios.length > 1) {
      console.warn(`Se encontraron ${directorios.length} definiciones de ${nombre}; se muestran todas.`);
    }

    for (const directorio of directorios) {
      for (const tipo of archivos) {
        const ruta = join(directorio, nombreArchivo(nombre, tipo));
        if (existsSync(ruta)) imprimirArchivo(ruta);
      }
    }
  }

  if (errores > 0) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
