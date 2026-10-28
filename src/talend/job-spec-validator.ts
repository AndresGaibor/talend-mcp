const IDENTIFICADOR = /^[A-Za-z][A-Za-z0-9_]*$/;
const NODO = /^[A-Za-z_]\w*$/;
const COMPONENTE = /^t[A-Za-z0-9_]+$/;
const VERSION = /^\d+\.\d+$/;

/**
 * Valida la especificacion de un job antes de escribirlo.
 *
 * El modo offline escribe `.item` directamente, sin la proteccion de Studio, asi que aqui se comprueba lo que Studio
 * rechazaria o dejaria roto: nombres que no son identificadores Java (el nombre del job es el de una clase), nodos y
 * conexiones incoherentes y variables de contexto repetidas.
 */
export function validateJobSpec(spec: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!spec || typeof spec !== "object") {
    return { valid: false, errors: ["Spec must be an object"] };
  }

  const value = spec as Record<string, unknown>;

  if (typeof value.jobName !== "string" || value.jobName.length === 0) {
    errors.push("jobName is required and must be a non-empty string");
  } else if (!IDENTIFICADOR.test(value.jobName)) {
    errors.push(`jobName '${value.jobName}' no es un identificador valido (letras, numeros y _, empezando por letra)`);
  }

  if (value.version !== undefined && (typeof value.version !== "string" || !VERSION.test(value.version))) {
    errors.push(`version '${String(value.version)}' debe tener la forma mayor.menor (por ejemplo 0.1)`);
  }

  const nodos = new Set<string>();
  if (!Array.isArray(value.components)) {
    errors.push("components is required and must be an array");
  } else {
    for (let index = 0; index < value.components.length; index++) {
      const component = value.components[index] as Record<string, unknown>;
      if (typeof component.uniqueName !== "string") {
        errors.push(`components[${index}].uniqueName is required`);
      } else if (!NODO.test(component.uniqueName)) {
        errors.push(`components[${index}].uniqueName '${component.uniqueName}' no es un identificador valido`);
      }
      if (typeof component.componentName !== "string") {
        errors.push(`components[${index}].componentName is required`);
      } else if (!COMPONENTE.test(component.componentName)) {
        errors.push(`components[${index}].componentName '${component.componentName}' no tiene la forma t<Nombre>`);
      }
      if (typeof component.uniqueName === "string" && nodos.has(component.uniqueName)) {
        errors.push(`Duplicate uniqueName: ${component.uniqueName}`);
      }
      if (typeof component.uniqueName === "string") nodos.add(component.uniqueName);
    }
  }

  if (Array.isArray(value.connections)) {
    const nombres = new Set<string>();
    for (let index = 0; index < value.connections.length; index++) {
      const connection = value.connections[index] as Record<string, unknown>;
      if (typeof connection.source !== "string") {
        errors.push(`connections[${index}].source is required`);
      } else if (!nodos.has(connection.source)) {
        errors.push(`connections[${index}]: el origen '${connection.source}' no es un componente del job`);
      }
      if (typeof connection.target !== "string") {
        errors.push(`connections[${index}].target is required`);
      } else if (!nodos.has(connection.target)) {
        errors.push(`connections[${index}]: el destino '${connection.target}' no es un componente del job`);
      }
      if (typeof connection.source === "string" && connection.source === connection.target) {
        errors.push(`connections[${index}]: conecta '${connection.source}' a si mismo`);
      }
      if (typeof connection.label !== "string") {
        errors.push(`connections[${index}].label is required`);
      }
      // Studio exige un nombre unico por conexion: el explicito si lo hay y, si no, la etiqueta.
      const nombre = typeof connection.uniqueName === "string" ? connection.uniqueName : connection.label;
      if (typeof nombre === "string") {
        if (nombres.has(nombre)) errors.push(`Duplicate connection uniqueName: ${nombre}`);
        nombres.add(nombre);
      }
    }
  }

  if (Array.isArray(value.contexts)) {
    const variables = new Set<string>();
    for (let index = 0; index < value.contexts.length; index++) {
      const variable = value.contexts[index] as Record<string, unknown>;
      if (typeof variable.name !== "string" || !NODO.test(variable.name)) {
        errors.push(`variable de contexto invalida en contexts[${index}]: '${String(variable.name)}'`);
      } else if (variables.has(variable.name)) {
        errors.push(`variable de contexto repetida: ${variable.name}`);
      } else {
        variables.add(variable.name);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
