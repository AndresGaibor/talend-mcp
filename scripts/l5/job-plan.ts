import { outputConnectorOf } from "../../src/modules/component-definitions/application/plan-required-parameters.use-case";
import type { ComponentDefinition } from "../../src/modules/component-definitions/domain/component-definition.types";

export type JobPlanNode = {
  type: string;
  nombre?: string;
};

export type JobPlanConnectionSpec = {
  origen: string;
  destino: string;
  tipo?: string;
};

export type PlannedConnection = {
  source: string;
  target: string;
  type: string;
};

export type JobAssemblyNode = JobPlanNode & {
  schemaDespuesDeConectar?: boolean;
  tablas?: unknown;
  mapper?: unknown;
};

export type JobAssemblySpec = {
  nodes: JobAssemblyNode[];
  connections: JobPlanConnectionSpec[];
};

export type ConnectionsPlan =
  | { ok: true; connections: PlannedConnection[] }
  | { ok: false; error: string };

export type JobAssemblyPlan =
  | {
      ok: true;
      nodes: string[];
      connections: PlannedConnection[];
      afterConnect: { schemas: string[]; tables: string[]; mappers: string[] };
    }
  | { ok: false; error: string };

/**
 * Traduce las conexiones declaradas por alias a operaciones para la API.
 * El conector por defecto se obtiene del XML instalado; una especificacion
 * puede indicar `tipo` cuando se trata de un conector no predeterminado.
 */
export function planConnections(
  nodes: JobPlanNode[],
  connections: JobPlanConnectionSpec[],
  definitions: Map<string, ComponentDefinition>,
): ConnectionsPlan {
  const nodeTypes = new Map(
    nodes.filter((node) => node.nombre).map((node) => [node.nombre!, node.type]),
  );
  const planned: PlannedConnection[] = [];

  for (const connection of connections) {
    const sourceType = nodeTypes.get(connection.origen);
    if (!sourceType || !nodeTypes.has(connection.destino)) {
      return {
        ok: false,
        error: `conexion sin nodos: ${connection.origen} -> ${connection.destino}`,
      };
    }
    planned.push({
      source: connection.origen,
      target: connection.destino,
      type: connection.tipo ?? (() => {
        const definition = definitions.get(sourceType);
        return definition ? outputConnectorOf(definition) : "FLOW";
      })(),
    });
  }

  return { ok: true, connections: planned };
}

/**
 * Construye las fases independientes del bridge para montar un job.
 * Schemas marcados para re-aplicar se ordenan con los destinos antes que los
 * origenes: al conectar, Studio propaga el schema hacia atras y puede pisarlo.
 */
export function planJobAssembly(
  spec: JobAssemblySpec,
  definitions: Map<string, ComponentDefinition>,
): JobAssemblyPlan {
  const connections = planConnections(spec.nodes, spec.connections, definitions);
  if (!connections.ok) return connections;

  const destinations = new Set(spec.connections.map((connection) => connection.destino));
  const pendingSchemas = spec.nodes
    .map((node, index) => ({ node, alias: node.nombre ?? `#${index}` }))
    .filter(({ node }) => node.schemaDespuesDeConectar);

  return {
    ok: true,
    nodes: spec.nodes.map((node, index) => node.nombre ?? `#${index}`),
    connections: connections.connections,
    afterConnect: {
      schemas: [
        ...pendingSchemas.filter(({ alias }) => destinations.has(alias)),
        ...pendingSchemas.filter(({ alias }) => !destinations.has(alias)),
      ].map(({ alias }) => alias),
      tables: spec.nodes
        .map((node, index) => ({ node, alias: node.nombre ?? `#${index}` }))
        .filter(({ node }) => node.tablas !== undefined)
        .map(({ alias }) => alias),
      mappers: spec.nodes
        .map((node, index) => ({ node, alias: node.nombre ?? `#${index}` }))
        .filter(({ node }) => node.mapper !== undefined)
        .map(({ alias }) => alias),
    },
  };
}
