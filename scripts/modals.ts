import { handleModals } from "../src/talend/studio/modals/modal-handler";

/**
 * Lee y contesta los dialogos abiertos de Talend Studio.
 *
 *   bun run modales              -> lee, decide, pulsa y registra en logs/modales.jsonl
 *   bun run modales -- --dry-run -> solo lee y dice que haria
 *
 * Imprime JSON: titulo, mensajes, botones, decision y resultado de cada dialogo.
 */

const dryRun = process.argv.includes("--dry-run");
const handled = await handleModals({ dryRun });
console.log(JSON.stringify(handled, null, 2));
