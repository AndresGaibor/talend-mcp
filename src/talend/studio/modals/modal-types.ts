/** Lo que se lee de un dialogo abierto de Studio (por accesibilidad de Windows o por el bridge). */
export interface ModalSnapshot {
  /** Identificador de la ventana (HWND) para actuar sobre ella. */
  handle: number;
  title: string;
  /** Mensajes: etiquetas y campos de solo lectura. Nunca el valor de un campo editable. */
  texts: string[];
  /** Nombres de los botones tal como los dibuja Studio (pueden llevar `&`). */
  buttons: string[];
  /** Campos de texto que el usuario puede escribir. */
  editableFields: number;
  /** Campos de contrasena: si hay alguno, el dialogo es de una persona. */
  passwordFields: number;
}

export type ModalKind = "error" | "warning" | "info" | "question" | "license" | "modules" | "unknown";

export interface ModalDecision {
  kind: ModalKind;
  action: "press" | "leave";
  /** Boton a pulsar, con el nombre exacto que trae el dialogo. */
  button?: string;
  /** Regla que decidio: `job-ya-existe`, `error-generico`, ... */
  rule: string;
  /** Por que, en una frase; incluye el mensaje del dialogo cuando es un error. */
  reason: string;
}
