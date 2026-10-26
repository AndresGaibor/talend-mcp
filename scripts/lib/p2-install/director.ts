import { join } from "node:path";

import { safeReaddir, type StudioInstall } from "../studio-detect";
import { FEATURE_IU, info, ok, p2Director } from "./context";

/** Desinstalacion, instalacion y consulta de version del plugin. */

/** Desinstala la version anterior del plugin, si estaba instalada. */
export function uninstallPrevious(studio: StudioInstall, data: string): void {
  info("Buscando una version anterior instalada...");
  const status = p2Director(studio, [
    "-application", "org.eclipse.equinox.p2.director",
    "-uninstallIU", FEATURE_IU,
    "-destination", studio.studioDir,
    "-data", data,
    "-nosplash", "-console",
  ]);

  if (status === 0) {
    ok("Version anterior desinstalada.");
  } else {
    info("No habia una version anterior instalada.");
  }
}

export function installNew(studio: StudioInstall, repoDir: string, data: string): boolean {
  const normalized = repoDir.replace(/\\/g, "/");
  // En Windows la URI de un drive necesita tres barras: file:///C:/ruta
  const repoUri = normalized.startsWith("/") ? `file://${normalized}` : `file:///${normalized}`;

  const status = p2Director(studio, [
    "-application", "org.eclipse.equinox.p2.director",
    "-repository", repoUri,
    "-installIU", FEATURE_IU,
    "-destination", studio.studioDir,
    "-profileProperties", "org.eclipse.update.install.features=true",
    "-clean",
    "-data", data,
    "-nosplash", "-console",
  ]);

  return status === 0;
}

export function installedFeatureVersion(studio: StudioInstall): string | null {
  const featureJar = join(studio.studioDir, "features");
  const match = safeReaddir(featureJar).find((name) => name.startsWith("com.andres.talend.bridge.feature_"));
  if (!match) return null;
  const version = match.match(/_(\d+\.\d+\.\d+\.\d+)/)?.[1];
  return version ?? match;
}
