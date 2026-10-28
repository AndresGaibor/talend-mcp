import { restartStudio } from "../../src/talend/studio/studio-restart";

/**
 * Reinicio de Talend Studio sin intervencion manual.
 *
 *   bun run scripts/l5/studio-reiniciar.ts
 *
 * Es la misma logica que la tool `talend_studio_restart` (src/talend/studio/studio-restart.ts): cierra los dialogos
 * abiertos, pide el cierre de la ventana principal, fuerza el cierre si Studio no sale, lo vuelve a abrir, espera
 * al bridge y reinstala el plugin (el arnes publica el plugin en caliente, y un Studio recien arrancado carga el
 * instalado). El arnes (`execution-check`) solo lo usa con `--reiniciar-studio`.
 */
export async function reiniciarStudio(): Promise<void> {
  await restartStudio({ reinstallBridge: true });
}

if (import.meta.main) {
  const inicio = Date.now();
  await reiniciarStudio();
  console.log(`Studio reiniciado en ${((Date.now() - inicio) / 1000).toFixed(0)} s`);
}
