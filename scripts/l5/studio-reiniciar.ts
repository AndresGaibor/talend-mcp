import { createBridgeClient } from "../../src/modules/studio-bridge/adapters/http-studio-bridge.client";

/**
 * Reinicio de Talend Studio sin intervencion manual.
 *
 *   bun run scripts/l5/studio-reiniciar.ts
 *
 * Studio retiene en memoria cada editor de job que se abre (medido: ~13 MB por caso, que ni la
 * recoleccion ni el cierre del editor liberan), asi que una corrida larga llena el heap. No se
 * ha encontrado forma de soltarlo sin reiniciar. Este script lo hace sin forzar nada:
 *
 * 1. Cierra la ventana principal (`CloseMainWindow`) y espera a que Studio salga.
 * 2. Lo vuelve a abrir con el mismo ejecutable.
 * 3. Espera a que el bridge responda.
 * 4. Reinstala el plugin del bridge: un Studio recien arrancado carga el plugin instalado, no las
 *    publicaciones en caliente anteriores.
 *
 * El arnes (`execution-check`) solo lo usa con `--reiniciar-studio`.
 */

const ESPERA_CIERRE_MS = 120_000;
const ESPERA_ARRANQUE_MS = 300_000;

async function powershell(comando: string): Promise<{ salida: string; codigo: number }> {
  const proceso = Bun.spawn(["powershell", "-NoProfile", "-NonInteractive", "-Command", comando], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [salida, codigo] = await Promise.all([new Response(proceso.stdout).text(), proceso.exited]);
  return { salida: salida.trim(), codigo };
}

async function esperar(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/** El pid de Studio, segun el bridge, o undefined si no responde. */
async function pidDeStudio(intentos = 3): Promise<number | undefined> {
  // Studio ocupado (compilando, con un dialogo) tarda en contestar: no se da por caido a la primera.
  for (let intento = 0; intento < intentos; intento++) {
    const bridge = await createBridgeClient({ config: { timeoutMs: 15_000 } });
    const latido = await bridge.ping().catch(() => undefined);
    const pid = (latido?.data as { pid?: number } | undefined)?.pid;
    if (latido?.ok && pid !== undefined) return pid;
  }
  return undefined;
}

export async function reiniciarStudio(): Promise<void> {
  const pid = await pidDeStudio();
  if (pid === undefined) throw new Error("Studio no responde: no hay nada que reiniciar");

  const ejecutable = (
    await powershell(`(Get-CimInstance Win32_Process -Filter "ProcessId=${pid}").ExecutablePath`)
  ).salida;
  if (!ejecutable) throw new Error(`No se pudo leer el ejecutable de Studio (pid ${pid})`);

  const cierre = await powershell(
    `$p = Get-Process -Id ${pid}; [void]$p.CloseMainWindow(); if ($p.WaitForExit(${ESPERA_CIERRE_MS})) { exit 0 } else { exit 2 }`,
  );
  if (cierre.codigo !== 0) {
    throw new Error("Studio no se cerro a tiempo (puede haber un dialogo pendiente). No se fuerza el cierre.");
  }

  const carpeta = ejecutable.replace(/[\\/][^\\/]+$/, "");
  await powershell(`Start-Process -FilePath '${ejecutable}' -WorkingDirectory '${carpeta}'`);

  const limite = Date.now() + ESPERA_ARRANQUE_MS;
  while ((await pidDeStudio()) === undefined) {
    if (Date.now() > limite) throw new Error("Studio no arranco a tiempo");
    await esperar(5_000);
  }

  const instalacion = Bun.spawn(["bun", "run", "bridge:install"], { stdout: "ignore", stderr: "ignore" });
  if ((await instalacion.exited) !== 0) throw new Error("No se pudo reinstalar el plugin del bridge");
  await esperar(5_000);
}

if (import.meta.main) {
  const inicio = Date.now();
  await reiniciarStudio();
  console.log(`Studio reiniciado en ${((Date.now() - inicio) / 1000).toFixed(0)} s`);
}
