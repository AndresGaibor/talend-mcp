import { z } from "zod/v4";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { generateSnippet, type SnippetInput } from "./report-generate-snippets.tool";

export function createReportSnippetsGenerateTool() {
  return {
    name: "talend_report_snippets_generate",
    description: "Genera fragmentos de texto listos para usar en reportes académicos sobre jobs de Talend.",
    inputSchema: z.object({
      jobName: z.string().optional().describe("Nombre del job"),
      category: z.string().optional().describe("Categoría del snippet"),
      section: z.string().optional().describe("Sección del reporte (alternativo para compatibilidad)"),
      mode: z.enum(["single", "list", "all"]).optional().default("single").describe("Modo de generación"),
      customText: z.string().optional().describe("Texto personalizado"),
    }),
    annotations: {
      readOnly: true,
    },
    handler: async (input: {
      jobName?: string;
      category?: string;
      section?: string;
      mode?: "single" | "list" | "all";
      customText?: string;
    }): Promise<CallToolResult> => {
      try {
        const jobName = input.jobName || "MiJobTalend";
        const targetSection = (input.category || input.section || "diseno") as any;

        if (input.mode === "all") {
          const sections = ["diseno", "contextos", "validaciones", "errores", "tiempo", "evidencias"];
          const snippets = sections.map((sec) => {
            return generateSnippet({ jobName, section: sec as any, customText: input.customText });
          });
          const combined = snippets.join("\n\n---\n\n");
          return {
            content: [{ type: "text", text: combined }],
            structuredContent: { snippet: combined, jobName, mode: "all" } as any,
            isError: false,
          };
        }

        const snippet = generateSnippet({
          jobName,
          section: targetSection,
          customText: input.customText,
        });

        return {
          content: [{ type: "text", text: snippet }],
          structuredContent: { snippet, section: targetSection, jobName } as any,
          isError: false,
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error generando snippet: ${err}` }],
          isError: true,
        };
      }
    },
  };
}
