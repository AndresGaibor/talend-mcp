import * as z from "zod/v4";
import { bridgeFail, bridgeOk, loadBridge } from "./tools-base";
import { DefinitionIndexRepository } from "../../modules/component-definitions/infrastructure/definition-index.repository";
import { ValidateConnectionUseCase } from "../../modules/component-definitions/application/validate-connection.use-case";

let connectionValidator: ValidateConnectionUseCase | undefined;

async function validateConnection(sourceType: string, targetType: string, connector: string) {
  connectionValidator ??= new ValidateConnectionUseCase(new DefinitionIndexRepository());
  return await connectionValidator.validate(sourceType, targetType, connector);
}

export const nodeConnectionTools = [
  {
    name: "talend_job_connect_nodes",
    description:
      "Conecta dos nodos del job abierto. Antes de conectar comprueba que el conector sea legal: el tUniqRow saca sus filas por UNIQUE (no por FLOW) y conectar por FLOW compila pero no pasa ninguna fila.",
    inputSchema: z.object({
      source: z.string().describe("Unique name del nodo origen"),
      target: z.string().describe("Unique name del nodo destino"),
      type: z.string().optional().default("FLOW").describe("Conector: FLOW, REJECT, UNIQUE, ITERATE..."),
      name: z.string().optional().describe("Nombre de la conexion (por defecto, row1, row2...)"),
      job: z.string().optional().describe("Job donde estan los nodos"),
      skipValidation: z.boolean().optional().describe("Conectar sin comprobar el conector"),
    }),
    handler: async ({ source, target, type, name, job, skipValidation }: {
      source: string;
      target: string;
      type?: string;
      name?: string;
      job?: string;
      skipValidation?: boolean;
    }) => {
      const bridge = await loadBridge();
      if (!skipValidation) {
        const listado = await bridge.listNodes({ job });
        const nodos = (listado.data?.result ?? []) as Array<{
          uniqueName?: string;
          componentName?: string;
        }>;
        const origen = nodos.find((nodo) => nodo.uniqueName === source);
        const destino = nodos.find((nodo) => nodo.uniqueName === target);
        if (!origen?.componentName || !destino?.componentName) {
          return bridgeFail({
            ok: false,
            source: "studio-bridge",
            confidence: "high",
            endpoint: "/automation/nodes/connect",
            error: {
              code: "NODES_NOT_FOUND",
              message:
                `no se encontraron los nodos '${!origen ? source : target}' en el job` +
                (listado.ok ? "" : `: ${listado.error?.message ?? ""}`),
            },
          });
        }
        const comprobacion = await validateConnection(
          origen.componentName,
          destino.componentName,
          type ?? "FLOW",
        );
        if (!comprobacion.ok) {
          return bridgeFail({
            ok: false,
            source: "studio-bridge",
            confidence: "high",
            endpoint: "/automation/nodes/connect",
            error: {
              code: "INVALID_CONNECTION",
              message: comprobacion.errors.join(". "),
            },
            data: comprobacion,
          });
        }
      }

      const result = await bridge.connectNodes({ source, target, type, name, job });
      return bridgeOk({
        ok: result.ok,
        source: result.source,
        confidence: result.confidence,
        endpoint: "/automation/nodes/connect",
        data: result.data,
        error: result.error,
      });
    },
  },
];
