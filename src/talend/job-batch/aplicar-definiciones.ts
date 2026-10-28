import {
  normalizarComponente,
  type ParametroEntrada,
  type TablaEntrada,
} from "../../modules/component-definitions/application/normalizar-parametros";
import type { ComponentDefinition } from "../../modules/component-definitions/domain/component-definition.types";

type ComponenteDePlantilla = {
  componentName: string;
  parameters?: Record<string, ParametroEntrada>;
  tables?: Record<string, TablaEntrada>;
};

/**
 * Traduce los parametros y las tablas de una plantilla a lo que Studio guarda, segun la definicion de cada componente.
 *
 * Un parametro pasa a `{ value, field }` (con el valor de la lista, no su nombre) y una tabla pasa a una lista de
 * celdas `elementValue`, que es como el generador de `.item` escribe un parametro TABLE. Escribe tambien el valor por
 * defecto de las listas cerradas que no se pidieron. Devuelve ademas los avisos de lo que no se pudo traducir.
 *
 * @param buscar definicion de un componente por nombre (null si Studio no la tiene).
 */
export async function aplicarDefiniciones<T extends { components: ComponenteDePlantilla[] }>(
  plantilla: T,
  buscar: (componentName: string) => Promise<ComponentDefinition | null>,
): Promise<{ plantilla: T; avisos: string[] }> {
  const avisos: string[] = [];
  const definiciones = new Map<string, Promise<ComponentDefinition | null>>();
  const definicionDe = (nombre: string) => {
    if (!definiciones.has(nombre)) definiciones.set(nombre, buscar(nombre).catch(() => null));
    return definiciones.get(nombre)!;
  };

  const components = [];
  for (const componente of plantilla.components) {
    const { tables, ...resto } = componente;
    const normalizado = normalizarComponente(
      await definicionDe(componente.componentName),
      { parameters: componente.parameters, tables },
      componente.componentName,
    );
    avisos.push(...normalizado.avisos);
    const parameters: Record<string, unknown> = {};
    for (const parametro of normalizado.parameters) {
      parameters[parametro.name] = { value: parametro.value, field: parametro.field };
    }
    for (const tabla of normalizado.tables) {
      parameters[tabla.name] = tabla.cells.map((celda, indice) => ({
        "@_elementRef": celda.ref,
        "@_value": celda.value,
        "@_id": String(indice),
      }));
    }
    components.push({ ...resto, parameters });
  }
  return { plantilla: { ...plantilla, components } as T, avisos };
}
