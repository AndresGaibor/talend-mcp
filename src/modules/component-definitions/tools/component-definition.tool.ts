import { z } from "zod/v4";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { DefinitionIndexRepository } from "../infrastructure/definition-index.repository";
import { GetComponentDefinitionsUseCase } from "../application/get-component-definitions.use-case";

export const ComponentDefinitionSchema = z.object({
  name: z.string().optional().describe("Nombre del componente (por ejemplo tFileOutputDelimited)"),
  filter: z.string().optional().describe("Texto que tiene que aparecer en el nombre o en la familia"),
  family: z.string().optional().describe("Filtra por familia exacta (por ejemplo 'File/Output')"),
  palette: z
    .enum(["DI", "SPARK", "SPARKSTREAMING", "STRUCTUREDSTREAMING", "OTHER"])
    .optional()
    .describe("Tipo de job de la variante del componente. Por defecto, la Standard (DI)"),
  limit: z.number().optional().describe("Maximo de componentes a devolver en modo lista"),
  refresh: z.boolean().optional().describe("Relee el indice de disco en vez de usar el cache"),
});

export type ComponentDefinitionInput = z.infer<typeof ComponentDefinitionSchema>;

let repository: DefinitionIndexRepository | undefined;
let useCase: GetComponentDefinitionsUseCase | undefined;

function getUseCase(): GetComponentDefinitionsUseCase {
  repository ??= new DefinitionIndexRepository();
  useCase ??= new GetComponentDefinitionsUseCase(repository);
  return useCase;
}

export function createComponentDefinitionTool() {
  return {
    name: "talend_components_definition",
    description:
      "Devuelve la definicion de un componente de Talend leida de la instalacion de Studio: que parametros son obligatorios y con que valor rellenarlos, que conexiones admite y que artefactos necesita. Funciona sin abrir Studio. Es la forma de saber como se configura un componente sin adivinar.",
    inputSchema: ComponentDefinitionSchema,
    annotations: {
      readOnly: true,
    },
    handler: async (input: ComponentDefinitionInput): Promise<CallToolResult> => {
      try {
        const useCase = getUseCase();
        if (input.refresh) {
          await useCase.refresh();
        }

        if (input.name) {
          const definition = await useCase.get(input.name, input.palette);
          if (!definition) {
            return {
              content: [
                {
                  type: "text",
                  text:
                    `No se encontro la definicion de '${input.name}' en la instalacion de Studio. ` +
                    `Los componentes de la generacion nueva (AWS, JDBC, Snowflake...) no tienen XML: ` +
                    `para esos, usa talend_studio_component_parameters.`,
                },
              ],
              isError: true,
            };
          }
          const obligatorios = definition.plan.parameters
            .filter((item) => item.kind === "value")
            .map((item) => `${item.name} = ${item.value}`)
            .join(", ");
          return {
            content: [
              {
                type: "text",
                text:
                  `${definition.name} (${definition.family}, ${definition.palette}). ` +
                  `Parametros obligatorios: ${definition.requiredParameters.length}. ` +
                  (obligatorios ? `Valores sugeridos: ${obligatorios}.` : "Sin valores que se puedan sugerir."),
              },
            ],
            structuredContent: { definition } as any,
            isError: false,
          };
        }

        const list = await useCase.list(input.filter ?? input.family, {
          palette: input.palette,
          limit: input.limit ?? 50,
        });
        const filtered = input.family
          ? list.filter((item) => item.family === input.family)
          : list;
        const summary = await useCase.summary();
        return {
          content: [
            {
              type: "text",
              text:
                `${filtered.length} componente(s) en la instalacion de Studio ` +
                `(${summary.total} definiciones en disco, ${summary.pluginsDir || "ruta no detectada"}).`,
            },
          ],
          structuredContent: { components: filtered, summary } as any,
          isError: false,
        };
      } catch (err) {
        return {
          content: [
            { type: "text", text: `Error leyendo las definiciones de componentes: ${err}` },
          ],
          isError: true,
        };
      }
    },
  };
}
