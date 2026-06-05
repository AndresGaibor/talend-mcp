import type { RuntimeTool } from "../../server/registered-tools";

/**
 * Crea una herramienta de alias legacy que envuelve a una herramienta canónica.
 * Agrega un mensaje de advertencia de deprecación al resultado.
 * 
 * @param legacyName Nombre del alias legacy
 * @param canonicalTool Herramienta canónica a la que apunta el alias
 * @returns Una nueva RuntimeTool con el nombre legacy y handler con advertencia
 */
export function createLegacyAliasTool(legacyName: string, canonicalTool: RuntimeTool): RuntimeTool {
  const canonicalName = canonicalTool.definition.name;
  const warningMessage = `Warning: ${legacyName} is legacy. Use ${canonicalName} instead.`;

  return {
    ...canonicalTool,
    definition: {
      ...canonicalTool.definition,
      name: legacyName,
    },
    handler: async (input: unknown) => {
      const result = await canonicalTool.handler(input);

      if (result && typeof result === "object") {
        // Caso 1: TalendToolResult (formato interno común)
        // Verificado en src/presentation/tools/common/result.ts
        if ("ok" in result && ("data" in result || "warnings" in result || "errors" in result)) {
          const res = result as any;
          const currentWarnings = Array.isArray(res.warnings) ? res.warnings : [];
          
          if (!currentWarnings.includes(warningMessage)) {
            return {
              ...res,
              warnings: [...currentWarnings, warningMessage],
            };
          }
          return res;
        }

        // Caso 2: MCP CallToolResult (formato estándar de MCP)
        if ("content" in result && Array.isArray((result as any).content)) {
          const res = result as any;
          return {
            ...res,
            content: [
              ...res.content,
              {
                type: "text",
                text: `\n\n[DEPRECATION WARNING]\n${warningMessage}`,
              },
            ],
          };
        }

        // Caso 3: Objeto genérico, intentamos agregar campo 'warning' si no existe
        const res = result as any;
        if (res.warning === undefined && res.warnings === undefined) {
          return {
            ...res,
            warning: warningMessage,
          };
        }
      }

      // Si no es un objeto o ya tiene advertencias, retornamos el original
      return result;
    },
  };
}
