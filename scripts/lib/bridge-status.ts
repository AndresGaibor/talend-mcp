import { existsSync, statSync } from "node:fs";
import { join } from "node:path";

import { createUi, formatDuration } from "../../src/shared/cli/ui";
import { bridgeBuildStatus } from "../fast-bridge-build";
import {
  bridgeHome,
  bridgePort,
  hotJarPath,
  isStudioRunning,
  runningBridgePing,
  type BridgePing,
} from "./bridge-hot-reload";
import { installedFeatureVersion } from "./p2-install";
import { detectStudio, runJavaVersion, type StudioInstall } from "./studio-detect";

/**
 * Estado del bridge para diagnosticar la instalacion: que Studio se usa, si el
 * bridge responde y con que version, si el build local esta al dia y si el jar
 * publicado para carga en caliente existe.
 *
 * `collectBridgeStatus` mira el sistema; `renderBridgeStatus` solo da texto, asi
 * que se puede probar sin Studio.
 */

export type BridgeStatus = {
  studio: {
    dir: string;
    jdk: string;
    javaVersion: string | null;
    installedVersion: string | null;
  } | null;
  studioRunning: boolean;
  bridge: { port: number; ping: BridgePing | null };
  localBuild: { built: boolean; upToDate: boolean; version?: string };
  hotJar: { path: string; modifiedAt: Date | null };
  config: { path: string; exists: boolean; tokenExists: boolean };
};

export async function collectBridgeStatus(projectRoot: string): Promise<BridgeStatus> {
  const studio: StudioInstall | null = detectStudio();
  const ping = await runningBridgePing();
  const studioRunning = ping !== null || (studio !== null && (await isStudioRunning(studio)));

  const build = bridgeBuildStatus(projectRoot);
  const hotJar = hotJarPath();
  const configPath = join(bridgeHome(), "config.json");

  return {
    studio: studio
      ? {
          dir: studio.studioDir,
          jdk: studio.jdk,
          javaVersion: runJavaVersion(studio.jdk),
          installedVersion: installedFeatureVersion(studio),
        }
      : null,
    studioRunning,
    bridge: { port: bridgePort(), ping },
    localBuild: { built: build.version !== undefined, upToDate: build.upToDate, version: build.version },
    hotJar: { path: hotJar, modifiedAt: existsSync(hotJar) ? statSync(hotJar).mtime : null },
    config: {
      path: configPath,
      exists: existsSync(configPath),
      tokenExists: existsSync(join(bridgeHome(), "token")),
    },
  };
}

/** Lineas de texto del estado, listas para imprimir. */
export function renderBridgeStatus(status: BridgeStatus): string[] {
  const lines: string[] = [];
  const row = (label: string, value: string) => lines.push(`  ${label.padEnd(20)}${value}`);
  const { ping } = status.bridge;

  row("Talend Studio", status.studio
    ? `${status.studio.dir} (JDK ${status.studio.javaVersion ?? "desconocido"})`
    : "no detectado: define TALEND_STUDIO_HOME");
  row("Estado de Studio", status.studioRunning ? "abierto" : "cerrado");
  row("Bridge en vivo", ping ? describeLive(ping) : `no responde en http://127.0.0.1:${status.bridge.port}`);
  row("Build local", describeBuild(status));
  row("Plugin instalado", status.studio
    ? (status.studio.installedVersion ?? "no instalado (con Studio cerrado: --install-bridge)")
    : "-");
  row("Carga en caliente", status.hotJar.modifiedAt
    ? `publicada ${formatDate(status.hotJar.modifiedAt)}`
    : "sin publicar");
  row("Configuracion", status.config.exists ? status.config.path : `${status.config.path} (no existe: se crea al arrancar)`);
  row("Token", status.config.tokenExists ? "presente" : "falta (lo crea el plugin al arrancar)");

  if (ping && status.localBuild.upToDate && status.localBuild.version !== ping.version) {
    lines.push("");
    lines.push("  Aviso: el bridge en vivo no tiene el ultimo build. Ejecuta --install-bridge para publicarlo.");
  }
  return lines;
}

/** Solo se nombran los campos que el ping trae: un plugin antiguo no manda pid ni tiempo activo. */
function describeLive(ping: BridgePing): string {
  const parts = [
    ping.version,
    ping.mode,
    ping.pid !== undefined ? `pid ${ping.pid}` : undefined,
    ping.uptimeMs !== undefined ? `activo ${formatDuration(ping.uptimeMs)}` : undefined,
  ];
  return parts.filter((part): part is string => part !== undefined).join(" · ");
}

function describeBuild(status: BridgeStatus): string {
  const { localBuild } = status;
  if (!localBuild.built) return "no compilado (ejecuta --install-bridge)";
  if (localBuild.upToDate) return `${localBuild.version} (al dia)`;
  return `${localBuild.version} con cambios sin compilar (ejecuta --install-bridge o --watch-bridge)`;
}

function formatDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Imprime el estado del bridge. Sale con error si no hay Talend Studio. */
export async function runBridgeStatus(projectRoot: string): Promise<void> {
  const ui = createUi();
  const status = await collectBridgeStatus(projectRoot);

  ui.step("Estado del bridge de Talend Studio");
  for (const line of renderBridgeStatus(status)) ui.line(line);

  if (!status.studio) process.exitCode = 1;
}
