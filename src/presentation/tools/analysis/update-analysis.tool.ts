import { updateDqAnalysis, type DqAnalysisMetadataUpdate } from "../../../infrastructure/repositories/dq-xml.repository";
import { ok, fail } from "../common/response";

export function createUpdateAnalysisTool() {
  return {
    name: "update_analysis",
    description: "Actualiza los metadatos de un análisis DQ (name, status, purpose, description, version, author).",
    inputSchema: {
      type: "object",
      properties: {
        analysisPath: { type: "string", description: "Ruta completa al archivo .ana del análisis" },
        name: { type: "string", description: "Nuevo nombre del análisis" },
        status: { type: "string", description: "Estado del análisis" },
        purpose: { type: "string", description: "Propósito del análisis" },
        description: { type: "string", description: "Descripción del análisis" },
        version: { type: "string", description: "Versión del análisis" },
        author: { type: "string", description: "Autor del análisis" },
        defaultContext: { type: "string", description: "Contexto por defecto" },
      },
      required: ["analysisPath"],
    },
    handler: async (input: { analysisPath: string; name?: string; status?: string; purpose?: string; description?: string; version?: string; author?: string; defaultContext?: string }) => {
      const start = Date.now();
      try {
        const updates: DqAnalysisMetadataUpdate = {};
        if (input.name !== undefined) updates.name = input.name;
        if (input.status !== undefined) updates.status = input.status;
        if (input.purpose !== undefined) updates.purpose = input.purpose;
        if (input.description !== undefined) updates.description = input.description;
        if (input.version !== undefined) updates.version = input.version;
        if (input.author !== undefined) updates.author = input.author;
        if (input.defaultContext !== undefined) updates.defaultContext = input.defaultContext;

        await updateDqAnalysis(input.analysisPath, updates);
        return ok({ updated: true, analysisPath: input.analysisPath }, { startTime: start });
      } catch (err) {
        return fail("UPDATE_ANALYSIS_ERROR", `Error actualizando análisis DQ: ${err}`, { startTime: start });
      }
    },
  };
}