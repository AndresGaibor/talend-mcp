import type { ModalDecision, ModalKind, ModalSnapshot } from "./modal-types";

/**
 * Politica de los dialogos de Studio: que son y que boton se pulsa. Funcion pura.
 *
 * Orden de decision:
 *  1. Un campo de contrasena o un campo editable sin regla explicita: lo contesta una persona.
 *  2. Reglas conocidas (titulo o texto): el boton esta decidido de antemano.
 *  3. Clasificacion por palabras (error, aviso, informacion, pregunta) y el boton que menos cambia.
 *  4. Nunca un boton destructivo en un dialogo que no se conoce; sin boton seguro, se deja abierto.
 */

interface Rule {
  id: string;
  kind: ModalKind;
  title?: RegExp;
  text?: RegExp;
  /** Botones por orden de preferencia (sin `&`, sin distinguir mayusculas). */
  buttons: string[];
  /** La regla tambien vale con campos editables (el dialogo se conoce por entero). */
  allowEditable?: boolean;
}

const RULES: Rule[] = [
  { id: "job-ya-existe", kind: "question", title: /job\s*name\s*error|jobname error/i, text: /already in use|ya existe/i, buttons: ["Yes", "Sí", "Si", "OK"] },
  { id: "nombre-de-job-invalido", kind: "warning", title: /invalid job name/i, buttons: ["OK", "Yes"] },
  { id: "guardar-recursos", kind: "question", title: /save resource|guardar recursos/i, buttons: ["Save", "Guardar", "Yes", "OK"] },
  { id: "esquema-del-destino", kind: "question", text: /get the schema of the target component/i, buttons: ["No"] },
  // Licencias y modulos de terceros: el usuario autorizo aceptarlas para que Studio no se quede esperando.
  { id: "licencia", kind: "license", title: /licen[sc]e|licencia/i, buttons: ["Accept all", "Accept", "I accept", "Aceptar todo", "Aceptar", "Finish", "OK"] },
  { id: "licencia-en-texto", kind: "license", text: /accept the license|license terms|términos de la licencia/i, buttons: ["Accept all", "Accept", "I accept", "Aceptar todo", "Aceptar", "Finish", "OK"] },
  { id: "modulos-de-terceros", kind: "modules", title: /third[- ]part|modulos de terceros|módulos de terceros/i, buttons: ["Download and install all modules available", "Download and Install", "Install", "Cerrar", "Close"] },
  { id: "network-issue", kind: "error", title: /network issue/i, buttons: ["OK", "Close", "Cerrar", "Aceptar"] },
];

const ERROR_WORDS = /\b(error|exception|failed|failure|cannot|could not|unable|no se pudo|fallo|falló)\b/i;
const WARNING_WORDS = /\b(warning|warn|advertencia|aviso)\b/i;
const INFO_WORDS = /\b(information|info|informaci[oó]n)\b/i;
const DESTRUCTIVE = /\b(delete|remove|erase|overwrite|discard|eliminar|borrar|sobrescribir|descartar)\b/i;

const DISMISS = ["OK", "Aceptar", "Close", "Cerrar"];
const SAFE_ANSWER = ["No", "Cancel", "Cancelar"];

/** Quita el mnemonic (`&Yes`) y pasa a minusculas, para comparar nombres de botones. */
export function normalizeButton(name: string): string {
  return name.replace(/&/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

/** El primer boton preferido que existe, con el nombre exacto del dialogo. */
function pick(buttons: string[], preferred: string[]): string | undefined {
  for (const wanted of preferred) {
    const target = normalizeButton(wanted);
    const found = buttons.find((b) => normalizeButton(b) === target);
    if (found) return found;
  }
  return undefined;
}

function summary(snapshot: ModalSnapshot): string {
  const body = snapshot.texts.join(" | ");
  return body ? `"${snapshot.title}": ${body}` : `"${snapshot.title}"`;
}

export function decideModal(snapshot: ModalSnapshot): ModalDecision {
  const leave = (kind: ModalKind, rule: string, reason: string): ModalDecision => ({ kind, action: "leave", rule, reason });

  if (snapshot.passwordFields > 0) {
    return leave("unknown", "campo-de-contrasena", `Tiene un campo de contraseña: lo contesta una persona. ${summary(snapshot)}`);
  }

  const haystack = `${snapshot.title} ${snapshot.texts.join(" ")}`;
  for (const rule of RULES) {
    const byTitle = rule.title?.test(snapshot.title) ?? false;
    const byText = rule.text?.test(snapshot.texts.join(" ")) ?? false;
    if (!byTitle && !byText) continue;
    if (snapshot.editableFields > 0 && !rule.allowEditable) {
      return leave(rule.kind, rule.id, `Tiene campos editables: lo contesta una persona. ${summary(snapshot)}`);
    }
    const button = pick(snapshot.buttons, rule.buttons);
    if (button) {
      return { kind: rule.kind, action: "press", button, rule: rule.id, reason: `Regla ${rule.id}. ${summary(snapshot)}` };
    }
    return leave(rule.kind, rule.id, `Regla ${rule.id}, pero ningun boton esperado (${rule.buttons.join(", ")}). ${summary(snapshot)}`);
  }

  if (snapshot.editableFields > 0) {
    return leave("unknown", "campos-editables", `Tiene campos editables: lo contesta una persona. ${summary(snapshot)}`);
  }

  const kind: ModalKind = ERROR_WORDS.test(haystack)
    ? "error"
    : WARNING_WORDS.test(haystack)
      ? "warning"
      : INFO_WORDS.test(haystack)
        ? "info"
        : pick(snapshot.buttons, ["Yes", "Sí", "Si"]) && pick(snapshot.buttons, ["No"])
          ? "question"
          : "unknown";

  if (DESTRUCTIVE.test(haystack) || snapshot.buttons.some((b) => DESTRUCTIVE.test(b))) {
    return leave(kind, "destructivo-desconocido", `Habla de borrar o sobrescribir y no se conoce: lo decide una persona. ${summary(snapshot)}`);
  }

  const preferred = kind === "question" ? SAFE_ANSWER : DISMISS;
  const button = pick(snapshot.buttons, preferred);
  if (button) {
    return { kind, action: "press", button, rule: `${kind}-generico`, reason: `Dialogo ${kind} sin regla propia. ${summary(snapshot)}` };
  }
  return leave(kind, "sin-boton-seguro", `Ningun boton seguro entre ${snapshot.buttons.join(", ") || "(ninguno)"}. ${summary(snapshot)}`);
}
