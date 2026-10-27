import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

import { safeReaddir, type StudioInstall } from "../studio-detect";
import { c, info, warn } from "./context";
import { isUpdateSite, referencedPath, unescapePrefsValue } from "./paths";

/**
 * Limpieza de restos de instalaciones anteriores.
 *
 * Sin esto, un jar suelto duplica el bundle y las entradas de cache con rutas
 * invalidas hacen fallar cada instalacion posterior.
 */

/**
 * Elimina jars del plugin que quedaran copiados a mano en plugins/ o dropins/.
 * Sin esto, un jar suelto duplica el bundle y rompe la activacion.
 */
export function cleanLeftoverJars(studio: StudioInstall): number {
  let removed = 0;
  const folders = [
    join(studio.studioDir, "plugins"),
    join(studio.studioDir, "dropins"),
    join(studio.studioDir, "dropins", "plugins"),
  ];

  for (const folder of folders) {
    for (const entry of safeReaddir(folder)) {
      if (!entry.startsWith("com.andres.talend.bridge")) continue;
      const full = join(folder, entry);
      try {
        rmSync(full, { recursive: true, force: true });
        removed += 1;
        info(`Jar previo eliminado: ${c(join(basename(folder), entry), "dim")}`);
      } catch {}
    }
  }

  return removed;
}

/**
 * Limpia del cache de p2 los repositorios que apuntan a rutas que ya no
 * sirven como repositorio para el director.
 *
 * p2 guarda en el area de datos de la instalacion los repositorios que ha
 * descargado. Si esa entrada apunta a un update site (un directorio con
 * content.jar y artifacts.jar), p2 intenta releerlo como ubicacion de
 * extension y falla en cada instalacion, llenando la salida de errores que no
 * afectan el resultado. Como los companeros ya tienen el plugin instalado, ese
 * cache queda en el mismo estado en sus maquinas, por eso hay que limpiarlo
 * desde aqui.
 */
export function cleanStaleP2Repositories(studio: StudioInstall): number {
  const osgiDir = join(studio.studioDir, "configuration", "org.eclipse.osgi");
  let removed = 0;

  for (const instance of safeReaddir(osgiDir)) {
    const dataDir = join(osgiDir, instance, "data");
    for (const entry of safeReaddir(dataDir)) {
      const cacheDir = join(dataDir, entry);
      const artifacts = join(cacheDir, "artifacts.xml");
      if (!existsSync(artifacts)) continue;

      try {
        const content = readFileSync(artifacts, "utf8");
        const raw = content.match(/<repository[^>]*\sname='([^']*)'/)?.[1];
        if (!raw) continue;

        const referenced = referencedPath(raw);
        if (!referenced) continue;

        const isStale = isUpdateSite(referenced) || !existsSync(referenced);
        if (!isStale) continue;

        rmSync(cacheDir, { recursive: true, force: true });
        removed += 1;
        info(`Cache p2 obsoleto eliminado: ${c(referenced, "dim")}`);
      } catch {}
    }
  }

  return removed;
}

/**
 * Limpia del perfil de p2 los repositorios que quedaron registrados con una
 * URI invalida.
 *
 * Cuando una instalacion falla a mitad de camino, p2 deja el repositorio
 * registrado como "extension location" con una URI malformada (file://C:/...).
 * En cada instalacion posterior p2 intenta releer esa entrada y falla, aunque
 * la operacion termine bien. Como los companeros ya tienen el plugin instalado
 * con la version anterior, hay que reparar el perfil desde el CLI.
 */
export function cleanMalformedP2Repositories(studio: StudioInstall): number {
  const prefsDir = join(
    studio.studioDir, "p2", "org.eclipse.equinox.p2.engine", "profileRegistry",
    "profile.profile", ".data", ".settings",
  );

  const files = [
    "org.eclipse.equinox.p2.artifact.repository.prefs",
    "org.eclipse.equinox.p2.metadata.repository.prefs",
  ];

  let removed = 0;

  for (const fileName of files) {
    const file = join(prefsDir, fileName);
    if (!existsSync(file)) continue;

    try {
      const lines = readFileSync(file, "utf8").split(/\r?\n/);
      const groups = new Map<string, string[]>();
      const order: string[] = [];

      for (const line of lines) {
        const match = line.match(/^(repositories\/[^/]+)\/(.*)$/);
        if (!match) continue;
        const key = match[1]!;
        if (!groups.has(key)) {
          groups.set(key, []);
          order.push(key);
        }
        groups.get(key)!.push(line);
      }

      const drop = new Set<string>();

      for (const key of order) {
        const group = groups.get(key)!;
        const uri = unescapePrefsValue(group.map((l) => l.match(/\/uri=(.*)$/)).find(Boolean)?.[1] ?? "");
        const type = unescapePrefsValue(group.map((l) => l.match(/\/type=(.*)$/)).find(Boolean)?.[1] ?? "");

        const malformed = /^file:\/\/[a-zA-Z]:/.test(uri);
        const extensionLocation = type.includes("extensionlocation");
        const localPath = referencedPath(uri);
        const missing = localPath !== null && !existsSync(localPath);

        if (malformed || extensionLocation || missing) drop.add(key);
      }

      if (drop.size === 0) continue;

      const kept = lines.filter((line) => {
        const match = line.match(/^(repositories\/[^/]+)\//);
        return !match || !drop.has(match[1]!);
      });

      writeFileSync(file, kept.join("\n"), "utf8");
      removed += drop.size;
      info(`Entradas de repositorio p2 invalidas eliminadas de ${c(fileName, "dim")}: ${drop.size}`);
    } catch (error) {
      warn(`No se pudo limpiar ${fileName}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return removed;
}
