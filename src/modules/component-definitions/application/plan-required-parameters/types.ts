import type { DefinitionTable } from "../../domain/component-definition.types";

/**
 * Tipos del plan de relleno de los parámetros obligatorios de un componente.
 *
 * Un componente se configura con sus parámetros obligatorios: sin ellos el
 * código generado no compila (un `tFileOutputDelimited` sin `FILENAME` da
 * "The constructor File() is undefined"). El plan dice qué valor poner en
 * cada uno, de dónde sale ese valor y a cuál no se le puede dar uno.
 */

export type PlannedParameter =
  | {
      name: string;
      field: string;
      kind: "value";
      value: string;
      /** El valor va entre comillas (es un literal de Java). */
      literal: boolean;
      /** De dónde sale el valor. */
      source: "default" | "generated";
    }
  | {
      name: string;
      field: string;
      kind: "table";
      /** La estructura de la tabla: sus columnas y sus valores por defecto. */
      table: DefinitionTable;
    };

export type SkippedParameter = {
  name: string;
  field: string;
  reason: string;
};

export type RequiredParametersPlan = {
  component: string;
  parameters: PlannedParameter[];
  skipped: SkippedParameter[];
};

/**
 * Plan de montaje de un componente: qué conexiones necesita para que el
 * generador produzca código.
 *
 * - Un componente que **consume** (tiene un conector FLOW de entrada) necesita
 *   un origen: un `tFixedFlowInput` con schema.
 * - El destino (un `tLogRow`) no se decide aqui: lo que hace falta depende de
 *   lo que diga el generador. Los componentes de la generación nueva (JDBC,
 *   Snowflake...) no declaran sus conectores en el modelo de Studio, y el
 *   generador falla con "Missing output connection for component X": en ese
 *   caso, quien mide la cobertura anade el `tLogRow` y compila otra vez.
 */
export type MountPlan = {
  /** Los parámetros obligatorios y el valor con el que se rellenan. */
  parameters: Record<string, { value: string; literal: boolean } | { table: DefinitionTable }>;
  /** Hay que conectarle un origen. */
  source: boolean;
  /** Conector por el que se entra ("FLOW", o el que declare el XML). */
  input: string;
  /** Conector por el que sale ("FLOW", "UNIQUE"...). */
  output: string;
};
