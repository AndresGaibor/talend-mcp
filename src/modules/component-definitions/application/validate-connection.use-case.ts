import { DefinitionIndexRepository } from "../infrastructure/definition-index.repository";
import type { ComponentDefinition, DefinitionConnector } from "../domain/component-definition.types";

/**
 * Comprobacion de una conexion antes de crearla.
 *
 * Conectar por el conector equivocado no da error: el job se guarda, compila
 * y no sale ninguna fila. El `tUniqRow` saca sus filas por `UNIQUE`, no por
 * `FLOW`, y el `tFilterRow` por `REJECT`. Con las definiciones del XML de
 * Studio se puede comprobar antes.
 */

export type ConnectionCheck = {
  ok: boolean;
  /** El conector pedido (o el que corresponde, si se deduce). */
  connector: string;
  /** El conector que el componente de origen usa de verdad. */
  sourceConnector?: string;
  errors: string[];
  warnings: string[];
  /** Conectores de salida del origen. */
  sourceConnectors: string[];
  /** Conectores de entrada del destino. */
  targetConnectors: string[];
};

export class ValidateConnectionUseCase {
  constructor(private readonly repository: DefinitionIndexRepository) {}

  /**
   * Comprueba la conexion entre dos componentes.
   *
   * @param sourceType componente de origen.
   * @param targetType componente de destino.
   * @param connector conector pedido ("FLOW", "REJECT", "UNIQUE"...).
   */
  async validate(
    sourceType: string,
    targetType: string,
    connector?: string,
  ): Promise<ConnectionCheck> {
    const check: ConnectionCheck = {
      ok: true,
      connector: (connector ?? "FLOW").toUpperCase(),
      errors: [],
      warnings: [],
      sourceConnectors: [],
      targetConnectors: [],
    };

    const source = await this.repository.find(sourceType);
    const target = await this.repository.find(targetType);

    if (!source || !target) {
      // Sin definicion no se puede comprobar: se deja pasar (los componentes
      // de la generacion nueva no tienen XML).
      const sinDefinicion = [!source ? sourceType : "", !target ? targetType : ""]
        .filter(Boolean)
        .join(", ");
      check.warnings.push(
        `sin definicion en el XML de Studio (${sinDefinicion}): no se ha podido comprobar la conexion`,
      );
      return check;
    }

    const salidas = dataConnectors(source);
    const entradas = dataConnectors(target);
    check.sourceConnectors = salidas.map((item) => item.name);
    check.targetConnectors = entradas.map((item) => item.name);

    const salida = salidas.find((item) => item.name === check.connector);
    const entrada = entradas.find((item) => item.name === check.connector);

    if (!salida) {
      const otro = salidas.find((item) => (item.maxOutput ?? 0) >= 1 && item.name !== "FLOW");
      check.errors.push(
        `el componente '${sourceType}' no tiene el conector de salida '${check.connector}'` +
          (salidas.length > 0
            ? ` (sus salidas son: ${salidas.map((item) => item.name).join(", ")})`
            : ` (no tiene salidas de datos)`),
      );
      if (otro) {
        check.sourceConnector = otro.name;
        check.errors.push(
          `usa el conector '${otro.name}': conectar por '${check.connector}' compila pero no pasa ninguna fila`,
        );
      }
      check.ok = false;
    } else if (
      (salida.maxOutput ?? 0) < 1 &&
      !(source.name.toLowerCase() === "tmap" && check.connector === "FLOW")
    ) {
      // El conector existe pero no puede emitir (el FLOW del tUniqRow).
      const otro = salidas.find((item) => (item.maxOutput ?? 0) >= 1 && item.name !== "FLOW");
      check.errors.push(`el conector '${check.connector}' de '${sourceType}' no admite salidas`);
      if (otro) {
        check.sourceConnector = otro.name;
        check.errors.push(
          `usa el conector '${otro.name}': conectar por '${check.connector}' compila pero no pasa ninguna fila`,
        );
      }
      check.ok = false;
    }

    // Un conector del destino con el mismo nombre solo cuenta si puede recibir filas: el FILTER del
    // tFilterRow es una salida, y un tFilterRow encadenado a otro entra por su FLOW principal.
    const entradaPrincipal = entradas.find(acceptsInput);
    const mismoNombreSoloSale = entrada !== undefined && !acceptsInput(entrada) && entradaPrincipal !== undefined;

    if (entradas.length === 0) {
      check.errors.push(`el componente '${targetType}' no tiene conectores de entrada`);
      check.ok = false;
    } else if (!entrada || mismoNombreSoloSale) {
      // El conector es el del origen: el destino usa su entrada principal.
      check.warnings.push(
        `'${targetType}' no tiene un conector '${check.connector}': la conexion entrara por su conector principal` +
          ` (${entradas.map((item) => item.name).join(", ")})`,
      );
    } else if (
      !acceptsInput(entrada) &&
      !(target.name.toLowerCase() === "tmap" && check.connector === "FLOW")
    ) {
      check.errors.push(`el conector '${check.connector}' de '${targetType}' no admite entradas`);
      check.ok = false;
    }

    return check;
  }
}

/**
 * Si el conector puede recibir filas.
 *
 * `MAX_INPUT` ausente no significa cero: un conector con `MIN_INPUT` y sin tope (el FLOW del tUnite)
 * recibe un numero indeterminado de flujos, y `-1` es ilimitado.
 */
function acceptsInput(connector: DefinitionConnector): boolean {
  if (connector.maxInput === undefined) return (connector.minInput ?? 0) >= 1;
  return connector.maxInput >= 1 || connector.maxInput === -1;
}

/** Los conectores de datos (no los triggers) de un componente. */
function dataConnectors(definition: ComponentDefinition): DefinitionConnector[] {
  return definition.connectors.filter(
    (connector) =>
      !["SUBJOB_OK", "SUBJOB_ERROR", "COMPONENT_OK", "COMPONENT_ERROR", "RUN_IF"].includes(
        connector.name,
      ),
  );
}
