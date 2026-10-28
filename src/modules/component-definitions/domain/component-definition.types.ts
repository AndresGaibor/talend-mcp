/**
 * Definición de un componente de Talend leída de su XML (`<nombre>_java.xml`).
 *
 * Es la fuente que dice qué exige cada componente: qué parámetros son
 * obligatorios, con qué valor por defecto, qué conexiones admite y qué
 * artefactos necesita. Se lee del disco (la instalación de Studio), así que
 * está disponible aunque Studio no esté abierto.
 */

/** Paleta de Studio a la que pertenece la definición (el tipo de job). */
export type ComponentPalette =
  | "DI"
  | "SPARK"
  | "SPARKSTREAMING"
  | "STRUCTUREDSTREAMING"
  | "OTHER";

export type DefinitionParameter = {
  name: string;
  /** Tipo de campo de Studio: TEXT, FILE, CHECK, OPENED_LIST... */
  field: string;
  /** `REQUIRED="true"` en el XML. */
  required: boolean;
  /** `SHOW="false"` en el XML: el parámetro no se ve en el formulario. */
  show: boolean;
  /** Condición de visibilidad (`SHOW_IF`). */
  showIf?: string;
  /** Condición de ocultación (`NOT_SHOW_IF`). */
  notShowIf?: string;
  /** Valor por defecto tal cual aparece en el XML (ya es literal Java). */
  defaultValue?: string;
  /** Nombre del valor en el repositorio de metadata (`REPOSITORY_VALUE`). */
  repositoryValue?: string;
  /** Valores posibles de una lista (`<ITEMS>`). */
  possibleValues?: string[];
  /** Viene de `<ADVANCED_PARAMETERS>` (pestaña de ajustes avanzados). */
  advanced: boolean;
  /** Estructura de la tabla, si el parámetro es de tipo TABLE. */
  table?: DefinitionTable;
};

/**
 * Estructura de un parámetro de tipo TABLE.
 *
 * El XML declara las columnas de la tabla (`<ITEMS>`) con su valor por
 * defecto, y si la tabla tiene una fila por cada columna del schema
 * (`BASED_ON_SCHEMA="true"`) o un número fijo de filas (`NB_LINES`).
 */
export type DefinitionTable = {
  /** Una fila por cada columna del schema. */
  basedOnSchema: boolean;
  /** Número de filas cuando no depende del schema. */
  rows: number;
  columns: DefinitionTableColumn[];
};

export type DefinitionTableColumn = {
  name: string;
  /** Valor por defecto de la celda (ya es literal Java). */
  defaultValue?: string;
  /** Valores posibles, si la celda es una lista cerrada. */
  options?: Array<{ name: string; value: string }>;
};

export type DefinitionConnector = {
  /**
   * Nombre del conector (`NAME`): es lo que se usa al conectar
   * ("FLOW", "REJECT", "ITERATE", "SUBJOB_OK"...).
   */
  name: string;
  /** Tipo de enlace (`CTYPE`): FLOW, ITERATE, REJECT, LOOKUP, SUBJOB_OK... */
  type: string;
  maxInput?: number;
  /** `MIN_INPUT`: un conector con entradas obligatorias y sin `MAX_INPUT` admite un numero indeterminado (tUnite). */
  minInput?: number;
  maxOutput?: number;
};

export type DefinitionImport = {
  name: string;
  /** Jar del módulo de Talend. */
  module?: string;
  /** Coordenada Maven (`mvn:group/artifact/version`). */
  mvn?: string;
  /** `REQUIRED="true"`: sin este artefacto el componente no genera código. */
  required: boolean;
};

export type DefinitionReturn = {
  name: string;
  type: string;
  availability?: string;
};

export type ComponentDefinition = {
  name: string;
  /** Familia principal (la primera que declara el XML). */
  family: string;
  /** Todas las familias: un componente puede estar en varias. */
  families: string[];
  version?: string;
  /** `STARTABLE="true"`: el componente puede iniciar un flujo. */
  startable: boolean;
  palette: ComponentPalette;
  pluginId: string;
  /** Ruta del XML de donde salió la definición. */
  definitionPath: string;
  parameters: DefinitionParameter[];
  /** Los parámetros obligatorios (los que hay que rellenar para que funcione). */
  requiredParameters: DefinitionParameter[];
  connectors: DefinitionConnector[];
  imports: DefinitionImport[];
  returns: DefinitionReturn[];
};

export type DefinitionIndex = {
  /** Versión del formato del índice: si cambia, el caché se rehace. */
  version: number;
  generatedAt: string;
  pluginsDir: string;
  components: ComponentDefinition[];
};
