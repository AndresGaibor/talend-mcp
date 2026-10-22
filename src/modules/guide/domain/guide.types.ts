/**
 * Tipos del catalogo de orientacion para agentes.
 *
 * El catalogo es la fuente unica de verdad de "como se hace cada tarea" y la
 * consumen tres cosas: la tool `talend_guide`, las instrucciones que el
 * servidor MCP entrega en `initialize` y la documentacion generada
 * (`docs/CATALOGO-DE-TOOLS.md`).
 */

/** Lo que hace falta tener listo antes de empezar una tarea. */
export type GuideRequirement = "studio" | "bridge" | "project";

/** Un paso de una tarea: una tool y para que se usa. */
export type GuideStep = {
  /** Nombre exacto de la tool registrada. */
  tool: string;
  /** Que hace este paso dentro de la tarea. */
  purpose: string;
  /** Ejemplo minimo de argumentos. No es obligatorio. */
  input?: Record<string, unknown>;
  /** El paso se puede omitir segun el caso. */
  optional?: boolean;
};

/** Una tarea completa, con su orden obligatorio de pasos. */
export type GuideTask = {
  /** Identificador estable, en minusculas y con guiones. */
  id: string;
  title: string;
  /** Que se consigue al terminar la tarea. */
  goal: string;
  /** Cuando conviene usar esta tarea y cuando no. */
  whenToUse: string;
  requires: GuideRequirement[];
  /** Palabras que ayudan a encontrar la tarea desde lenguaje natural. */
  aliases: string[];
  steps: GuideStep[];
  pitfalls?: string[];
  /** Como comprobar que la tarea salio bien. */
  doneWhen: string;
};

/** Familia de tools, para agrupar el catalogo. */
export type GuideArea = {
  id: string;
  name: string;
  useFor: string;
};

/** Regla de configuracion que evita fallos silenciosos. */
export type GuideRule = {
  id: string;
  rule: string;
  detail: string;
  /** Tareas en las que aplica. Vacio o ausente = aplica a todas. */
  appliesTo?: string[];
};

/** Resumen de una tool registrada, tal como lo ve el agente. */
export type GuideToolSummary = {
  name: string;
  description: string;
  area: string;
  readOnly: boolean;
  requiresConfirmation: boolean;
  requiresStudio: boolean;
};
