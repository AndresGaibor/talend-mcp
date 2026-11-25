import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { decideModal } from "./modal-policy";
import { findStudioPid, pressModalButton, readModals, type PressResult } from "./modal-uia";
import type { ModalDecision, ModalSnapshot } from "./modal-types";

/**
 * Manejador autonomo de dialogos de Studio: lee, decide, actua y deja constancia.
 *
 * Cada dialogo visto queda en `logs/modales.jsonl` con su titulo, sus mensajes, la decision y lo que
 * paso al pulsar, para poder leer despues que dijo Studio aunque el dialogo ya no exista.
 */

export const AUDIT_FILE = join(import.meta.dir, "..", "..", "..", "..", "logs", "modales.jsonl");

export interface HandledModal {
  title: string;
  texts: string[];
  buttons: string[];
  decision: ModalDecision;
  /** Resultado de pulsar; ausente si no se actuo (`leave` o `dryRun`). */
  press?: PressResult;
}

export interface HandleOptions {
  /** Solo lee y decide; no pulsa nada. */
  dryRun?: boolean;
  /**
   * Solo pulsa dialogos con una regla propia del proyecto. Los que solo encajan en la clasificacion generica
   * se dejan abiertos: pueden ser ventanas que abrio una persona. Lo usan las rutas automaticas.
   */
  onlyKnown?: boolean;
  /** Sustitutos para pruebas. */
  read?: () => Promise<ModalSnapshot[]>;
  press?: (handle: number, button: string) => Promise<PressResult>;
  audit?: (record: Record<string, unknown>) => void;
  now?: () => Date;
}

function writeAudit(record: Record<string, unknown>): void {
  mkdirSync(dirname(AUDIT_FILE), { recursive: true });
  appendFileSync(AUDIT_FILE, `${JSON.stringify(record)}\n`);
}

export async function handleModals(options: HandleOptions = {}): Promise<HandledModal[]> {
  const read =
    options.read ??
    (async () => {
      const pid = await findStudioPid();
      return pid === undefined ? [] : readModals(pid);
    });
  const press = options.press ?? pressModalButton;
  const audit = options.audit ?? writeAudit;
  const now = options.now ?? (() => new Date());

  const handled: HandledModal[] = [];
  for (const snapshot of await read()) {
    const decision = decideModal(snapshot, { soloConocidas: options.onlyKnown === true });
    const item: HandledModal = { title: snapshot.title, texts: snapshot.texts, buttons: snapshot.buttons, decision };
    if (decision.action === "press" && decision.button && !options.dryRun) {
      item.press = await press(snapshot.handle, decision.button).catch(
        (error): PressResult => ({ ok: false, pressed: null, via: null, error: String(error) }),
      );
    }
    audit({ at: now().toISOString(), dryRun: options.dryRun === true, ...item });
    handled.push(item);
  }
  return handled;
}
