import type { ComponentDefinition, DefinitionParameter } from "../domain/component-definition.types";

/**
 * Parametros y tablas de un componente tal como los guarda Studio, a partir de lo que pide quien llama.
 *
 * Quien migra escribe lo que ve en la interfaz (`LOGICAL_OP: "AND"`, un operador `GREATER`), pero el `.item`
 * guarda el VALOR del elemento de la lista (`&&`, `>`) y el tipo de campo real (CLOSED_LIST, CHECK, FILE...).
 * Sin esa traduccion Studio marca el Job con "has a value (AND) that doesn't exist". La definicion del
 * componente (su XML en la instalacion de Studio) trae lo necesario, y se lee sin abrir Studio.
 */

export type ParametroEntrada = string | { value: string; field?: string };

export type TablaEntrada = {
  /** Orden de las celdas de las filas dadas como lista. Si falta, el de la definicion. */
  columns?: string[];
  rows: Array<string[] | Record<string, string>>;
};

export type ParametroNormalizado = { name: string; value: string; field: string };

/** Una tabla: sus celdas, fila tras fila, en el orden de las columnas de la definicion. */
export type TablaNormalizada = { name: string; cells: Array<{ ref: string; value: string }> };

export type Normalizado = {
  parameters: ParametroNormalizado[];
  tables: TablaNormalizada[];
  avisos: string[];
};

const LISTAS = new Set(["CLOSED_LIST", "OPENED_LIST"]);

/** El valor que Studio guarda para un elemento de lista, o undefined si el texto no es de la lista. */
function valorDeLista(
  options: Array<{ name: string; value: string }>,
  texto: string,
): { value: string; conocido: boolean } {
  if (options.some((option) => option.value === texto)) return { value: texto, conocido: true };
  const porNombre = options.find((option) => option.name === texto);
  return porNombre ? { value: porNombre.value, conocido: true } : { value: texto, conocido: false };
}

export function normalizarComponente(
  definicion: ComponentDefinition | null,
  entrada: { parameters?: Record<string, ParametroEntrada>; tables?: Record<string, TablaEntrada> },
  componentName = definicion?.name ?? "?",
): Normalizado {
  const resultado: Normalizado = { parameters: [], tables: [], avisos: [] };
  const declarados = new Map<string, DefinitionParameter>(
    (definicion?.parameters ?? []).map((parametro) => [parametro.name, parametro]),
  );
  if (!definicion) {
    resultado.avisos.push(`${componentName}: sin definicion en la instalacion de Studio; los parametros se escriben sin traducir`);
  }

  for (const [name, raw] of Object.entries(entrada.parameters ?? {})) {
    const declarado = declarados.get(name);
    if (definicion && !declarado) {
      resultado.avisos.push(`${componentName}: se omitio la propiedad '${name}', que el componente no declara`);
      continue;
    }
    const texto = typeof raw === "string" ? raw : raw.value;
    const field = (typeof raw === "object" ? raw.field : undefined) ?? declarado?.field ?? "TEXT";
    let value = texto;
    if (declarado && LISTAS.has(declarado.field) && declarado.options?.length) {
      const traducido = valorDeLista(declarado.options, texto);
      value = traducido.value;
      if (!traducido.conocido && declarado.field === "CLOSED_LIST") {
        resultado.avisos.push(
          `${componentName}: '${name}' vale '${texto}', que no esta en su lista (${declarado.options.map((o) => o.name).join(", ")})`,
        );
      }
    }
    resultado.parameters.push({ name, value, field });
  }

  // Un nodo escrito sin un valor para una lista conserva el NOMBRE del defecto (`AND`), no su valor (`&&`),
  // y Studio lo marca como error. La interfaz escribe siempre el valor, asi que se escribe aqui tambien.
  const pedidos = new Set(Object.keys(entrada.parameters ?? {}));
  for (const declarado of definicion?.parameters ?? []) {
    if (pedidos.has(declarado.name) || declarado.field !== "CLOSED_LIST" || !declarado.options?.length) continue;
    const defecto = declarado.defaultOption ?? declarado.defaultValue ?? "";
    const elegido =
      declarado.options.find((opcion) => opcion.name === defecto) ??
      declarado.options.find((opcion) => opcion.value === defecto) ??
      declarado.options[0]!;
    resultado.parameters.push({ name: declarado.name, value: elegido.value, field: declarado.field });
  }

  for (const [name, tabla] of Object.entries(entrada.tables ?? {})) {
    const declarado = declarados.get(name);
    const estructura = declarado?.table;
    if (!estructura) {
      resultado.avisos.push(`${componentName}: se omitio la tabla '${name}', que el componente no declara`);
      continue;
    }
    const cells: TablaNormalizada["cells"] = [];
    const ordenDeLista = tabla.columns ?? estructura.columns.map((columna) => columna.name);
    for (const fila of tabla.rows) {
      const celdas = Array.isArray(fila)
        ? Object.fromEntries(ordenDeLista.map((columna, indice) => [columna, fila[indice]]))
        : fila;
      for (const columna of estructura.columns) {
        let value = celdas[columna.name] ?? columna.defaultValue ?? "";
        if (columna.options?.length) {
          const traducido = valorDeLista(columna.options, value);
          value = traducido.value;
          if (!traducido.conocido) {
            resultado.avisos.push(
              `${componentName}: la celda '${columna.name}' de '${name}' vale '${celdas[columna.name]}', que no esta en su lista`,
            );
          }
        }
        cells.push({ ref: columna.name, value });
      }
    }
    resultado.tables.push({ name, cells });
  }
  return resultado;
}
