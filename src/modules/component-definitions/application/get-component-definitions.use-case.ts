import { DefinitionIndexRepository } from "../infrastructure/definition-index.repository";
import { planRequiredParameters } from "./plan-required-parameters.use-case";
import type {
  ComponentDefinition,
  ComponentPalette,
  DefinitionParameter,
} from "../domain/component-definition.types";

/**
 * Consulta de las definiciones de componentes instaladas en Studio.
 *
 * Devuelve lo que un componente exige (parámetros obligatorios y su valor),
 * lo que admite (conexiones) y lo que necesita (artefactos), sin necesidad
 * de abrir Studio.
 */

export type ParameterView = DefinitionParameter & {
  /** Valor con el que se rellenaría el parámetro, si se puede. */
  suggestedValue?: string;
  /** El valor va entre comillas (literal de Java). */
  literal?: boolean;
  /** La tabla, si el parámetro es de tipo TABLE. */
  table?: DefinitionParameter["table"];
};

export type ComponentDefinitionView = {
  name: string;
  family: string;
  families: string[];
  version?: string;
  palette: ComponentPalette;
  pluginId: string;
  definitionPath: string;
  startable: boolean;
  parameters: ParameterView[];
  requiredParameters: ParameterView[];
  /** Los valores concretos para rellenar los obligatorios. */
  plan: {
    parameters: Array<
      | { name: string; field: string; kind: "value"; value: string; literal: boolean; source: string }
      | { name: string; field: string; kind: "table"; table: unknown }
    >;
    skipped: Array<{ name: string; field: string; reason: string }>;
  };
  connectors: Array<{ name: string; type: string; maxInput?: number; maxOutput?: number }>;
  imports: Array<{ name: string; module?: string; mvn?: string; required: boolean }>;
  returns: Array<{ name: string; type: string; availability?: string }>;
};

export type ComponentSummary = {
  name: string;
  family: string;
  families: string[];
  palette: ComponentPalette;
  requiredCount: number;
  connectorTypes: string[];
};

export class GetComponentDefinitionsUseCase {
  constructor(private readonly repository: DefinitionIndexRepository) {}

  private view(definition: ComponentDefinition): ComponentDefinitionView {
    const plan = planRequiredParameters(definition);
    const suggested = new Map(
      plan.parameters
        .filter((item) => item.kind === "value")
        .map((item) => [item.name, item as Extract<typeof item, { kind: "value" }>]),
    );
    const decorate = (parameter: DefinitionParameter): ParameterView => {
      const planned = suggested.get(parameter.name);
      return planned
        ? { ...parameter, suggestedValue: planned.value, literal: planned.literal }
        : { ...parameter };
    };
    return {
      name: definition.name,
      family: definition.family,
      families: definition.families,
      version: definition.version,
      palette: definition.palette,
      pluginId: definition.pluginId,
      definitionPath: definition.definitionPath,
      startable: definition.startable,
      parameters: definition.parameters.map(decorate),
      requiredParameters: definition.requiredParameters.map(decorate),
      plan: { parameters: plan.parameters, skipped: plan.skipped },
      connectors: definition.connectors,
      imports: definition.imports,
      returns: definition.returns,
    };
  }

  /** Relee el índice de disco, ignorando el caché. */
  async refresh(): Promise<void> {
    await this.repository.load({ refresh: true });
  }

  /** Definición de un componente (la Standard si hay varias paletas). */
  async get(name: string, palette?: ComponentPalette): Promise<ComponentDefinitionView | null> {
    const definition = await this.repository.find(name, palette);
    return definition ? this.view(definition) : null;
  }

  /** Resumen de los componentes que cuadran con un filtro. */
  async list(
    filter?: string,
    options: { palette?: ComponentPalette; limit?: number } = {},
  ): Promise<ComponentSummary[]> {
    const definitions = await this.repository.list(filter, options);
    return definitions.map((definition) => ({
      name: definition.name,
      family: definition.family,
      families: definition.families,
      palette: definition.palette,
      requiredCount: definition.requiredParameters.length,
      connectorTypes: definition.connectors.map((connector) => connector.name),
    }));
  }

  /** Recuento por familia y paleta del catálogo en disco. */
  async summary() {
    return this.repository.summary();
  }
}
