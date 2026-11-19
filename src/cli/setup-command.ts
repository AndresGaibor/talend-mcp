import { homedir } from "node:os";
import { join } from "node:path";
import {
  CLIENT_IDS, configureClient, isInstalled, launcherFor, type ClientId, type Outcome, type SetupDeps,
} from "./client-setup";

const MARK: Record<Outcome["status"], string> = { applied: "✓", "dry-run": "·", skipped: "-", error: "✖" };

/** `talend-mcp setup` y `remove`. Devuelve el codigo de salida. */
export function runSetupCommand(opts: { remove: boolean; client?: string; project?: string; filter?: string; dryRun: boolean }): number {
  const home = homedir();
  const deps: SetupDeps = {
    dirs: { home, appData: process.env.APPDATA, copilotHome: process.env.COPILOT_HOME, platform: process.platform },
    which: (cmd) => Bun.which(cmd),
    run: (cmd) => {
      const r = Bun.spawnSync(cmd, { stdout: "pipe", stderr: "pipe" });
      return { ok: r.exitCode === 0, output: `${r.stdout}${r.stderr}` };
    },
  };

  let ids: ClientId[];
  if (opts.client) {
    ids = opts.client.split(",").map((s) => s.trim()).filter(Boolean) as ClientId[];
    const unknown = ids.filter((id) => !CLIENT_IDS.includes(id));
    if (unknown.length) {
      console.error(`Cliente desconocido: ${unknown.join(", ")}. Validos: ${CLIENT_IDS.join(", ")}`);
      return 2;
    }
  } else {
    ids = CLIENT_IDS.filter((id) => isInstalled(id, deps.dirs, deps.which));
    if (!ids.length) {
      console.error(`No se detecto ningun cliente MCP. Indica uno con --client (${CLIENT_IDS.join(", ")}).`);
      return 1;
    }
  }

  const launcher = opts.remove ? null : launcherFor({
    execPath: process.execPath,
    repoRoot: join(import.meta.dir, "..", ".."),
    home,
    project: opts.project,
    filter: opts.filter,
  });
  if (launcher) console.log(`Servidor: ${launcher.command} ${launcher.args.join(" ")}`);

  const outcomes = ids.map((id) => configureClient(id, launcher, deps, opts.dryRun));
  for (const o of outcomes) console.log(`${MARK[o.status]} ${o.client}: ${o.detail}`);
  if (opts.dryRun) console.log("Simulacion: no se escribio nada.");
  else if (!opts.remove && outcomes.some((o) => o.status === "applied")) console.log("Reinicia el cliente para que cargue el servidor.");
  return outcomes.some((o) => o.status === "error") ? 1 : 0;
}
