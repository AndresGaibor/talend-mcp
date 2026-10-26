import type { DefinitionParameter } from "../domain/component-definition.types";
import { evaluateCondition } from "./plan-required-parameters/condition";

/**
 * Resumen de la configuracion pensado para un agente externo.
 *
 * La lista cruda ("parametros obligatorios: 18") no dice que hacer. Aqui se
 * separa lo que quien llama tiene que decidir (una ruta, un schema, la tabla
 * de un job hijo) de lo que ya trae valor por defecto y de lo que el formulario
 * no muestra con los valores actuales.
 */

/** Campos que siempre los decide quien usa el componente. */
const CAMPOS_DEL_USUARIO = new Set(["FILE", "DIRECTORY", "SCHEMA_TYPE"]);

export type ResumenParaAgente = {
  /** Lo que tiene que decidir quien llama. */
  tuPones: string[];
  /** Lo que ya tiene valor por defecto y no hace falta tocar. */
  yaTieneValor: string[];
  /** Obligatorios que no aplican con los valores actuales (ocultos o condicionados). */
  ignorables: number;
};

export type DefinicionParaResumen = {
  /** Todos los parametros del componente, obligatorios o no. */
  parameters: DefinitionParameter[];
  /** Los obligatorios que marca el XML. */
  requiredParameters: DefinitionParameter[];
  /** El plan de relleno: solo se usan sus parametros con valor y sus parametros sin valor posible. */
  plan: {
    component?: string;
    parameters: Array<{ name: string; kind: string; value?: string; [extra: string]: unknown }>;
    skipped: Array<{ name: string; reason: string }>;
  };
  /** Parametros que el MCP sabe que hay que poner aunque el XML no los marque (el PROCESS del tRunJob). */
  esenciales?: string[];
  /** Valores por defecto que el MCP conoce para algunos parametros (el ROWSEPARATOR del tFileInputDelimited). */
  valoresDelRegistro?: Record<string, string>;
};

/** Quita las comillas de un literal Java (`"false"` -> `false`). */
function sinComillas(valor: string | undefined): string | undefined {
  if (valor === undefined) return undefined;
  return valor.replace(/^"(.*)"$/, "$1");
}

/**
 * Si el parametro se ve en el formulario con estos valores.
 *
 * Se evalua el `SHOW_IF` y el `NOT_SHOW_IF` con los valores por defecto y los
 * que ya trae el plan. Una condicion que no se puede decidir se trata como
 * visible: es mejor pedir de mas que callarse un parametro.
 */
function seVe(parametro: DefinitionParameter, valores: Record<string, string | undefined>): boolean {
  if (!parametro.show) return false;
  if (parametro.showIf && evaluateCondition(parametro.showIf, valores) === false) return false;
  if (parametro.notShowIf && evaluateCondition(parametro.notShowIf, valores) === true) return false;
  return true;
}

export function resumenParaAgente(definicion: DefinicionParaResumen): ResumenParaAgente {
  const planificados = new Map(
    definicion.plan.parameters
      .filter((item) => item.kind === "value")
      .map((item) => [item.name, item.value ?? ""] as const),
  );
  const valores: Record<string, string | undefined> = {};
  // Un parametro sin valor por defecto vale vacio: una comparacion contra vacio es falsa, como en Studio.
  for (const parametro of definicion.parameters) valores[parametro.name] = sinComillas(parametro.defaultValue) ?? "";
  for (const [nombre, valor] of planificados) valores[nombre] = sinComillas(valor);

  const tuPones: string[] = [];
  const yaTieneValor: string[] = [];
  let ignorables = 0;

  for (const parametro of definicion.requiredParameters) {
    // El schema de rechazo (`*_REJECT`) es opcional: solo existe si el job usa el flujo de rechazo.
    if (!seVe(parametro, valores) || parametro.name.endsWith("_REJECT")) {
      ignorables++;
    } else if (CAMPOS_DEL_USUARIO.has(parametro.field) || !tieneValor(parametro, planificados)) {
      tuPones.push(parametro.name);
    } else {
      yaTieneValor.push(parametro.name);
    }
  }

  // Un fichero que se ve por defecto lo pone quien llama, aunque el XML no lo marque obligatorio (el JSONFILE del tFileInputJSON).
  // Un directorio opcional (el temporal del tMap) no: tiene un valor por defecto que sirve.
  for (const parametro of definicion.parameters) {
    if (parametro.field === "FILE" && !parametro.advanced && seVe(parametro, valores) && !tuPones.includes(parametro.name)) {
      tuPones.push(parametro.name);
    }
  }

  // Esenciales del registro: si el plan no les da valor, o el registro tampoco, los pone quien llama.
  for (const nombre of definicion.esenciales ?? []) {
    if (tuPones.includes(nombre) || planificados.has(nombre) || yaTieneValor.includes(nombre)) continue;
    if (definicion.valoresDelRegistro?.[nombre] !== undefined) {
      yaTieneValor.push(nombre);
    } else {
      tuPones.push(nombre);
    }
  }

  return { tuPones, yaTieneValor, ignorables };
}

/**
 * Si el parametro ya tiene valor sin que lo toque nadie: lo da el plan, o es
 * un sí/no (CHECK), que Studio siempre rellena con su valor por defecto.
 */
function tieneValor(parametro: DefinitionParameter, planificados: Map<string, string>): boolean {
  return planificados.has(parametro.name) || parametro.field === "CHECK";
}

/** Frase para el agente con el resumen de arriba. */
export function textoResumen(
  definicion: { name: string; family: string; palette: string },
  resumen: ResumenParaAgente,
): string {
  const partes = [
    `${definicion.name} (${definicion.family}, ${definicion.palette}).`,
    `Tú pones: ${resumen.tuPones.length > 0 ? resumen.tuPones.join(", ") : "nada obligatorio, todo tiene valor por defecto"}.`,
  ];
  if (resumen.yaTieneValor.length > 0) {
    partes.push(`Ya tiene valor, no hace falta tocarlo: ${resumen.yaTieneValor.join(", ")}.`);
  }
  if (resumen.ignorables > 0) {
    partes.push(
      `Hay ${resumen.ignorables} obligatorio(s) más que están ocultos o dependen de otros parámetros: ignóralos.`,
    );
  }
  return partes.join(" ");
}

/**
 * Mensaje cuando el nombre no existe en la paleta Standard de esta instalacion.
 *
 * El agente no tiene que adivinar: se le dice que buscar y con que termino.
 */
export function mensajeNoEncontrado(nombre: string): string {
  const termino = nombre.replace(/^t/, "");
  return (
    `No hay ningún componente llamado '${nombre}' en la paleta Standard (DI) de esta instalación de Studio. ` +
    `Busca el nombre exacto con talend_components_search, por ejemplo {"query":"${termino}"}. ` +
    `Si es un componente de la generación nueva (JDBC, AWS, Snowflake...) puede no tener XML: ` +
    `en ese caso usa talend_studio_component_parameters.`
  );
}
