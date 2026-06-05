import * as z from "zod/v4";
import type { CallToolResult } from "@modelcontextprotocol/server";

function jsonOk(data: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    structuredContent: data as Record<string, unknown>,
  };
}

function err(text: string): CallToolResult {
  return { content: [{ type: "text", text }], isError: true };
}

export interface SnippetInput {
  jobName?: string;
  section?: "diseno" | "contextos" | "validaciones" | "errores" | "tiempo" | "evidencias";
  customText?: string;
}

function generarSnippetDiseno(jobName: string): string {
  return `## Diseño del Job

El job **${jobName}** fue diseñado siguiendo las mejores prácticas de Talend:

- **Arquitectura modular** con componentes separados para cada funcionalidad
- **Uso de contextos** para gestión de parámetros por entorno
- **Schemas definidos** con tipos de datos apropiados para cada campo
- **Manejo de errores** mediante componentes tDie y tLogRow
- **Flujo de datos optimizado** minimizando transformaciones innecesarias`;
}

function generarSnippetContextos(jobName: string): string {
  return `## Contextos Usados

El job **${jobName}** implementa múltiples contextos para gestionar diferentes entornos:

- **Contexto Development**: Parametrización para entorno de desarrollo local
- **Contexto Staging**: Configuración para pruebas de integración
- **Contexto Production**: Parámetros optimizados para producción
- **Parámetros críticos**: Credenciales, rutas de archivos, timeouts
- **Transición de contextos**: Validada correctamente entre entornos`;
}

function generarSnippetValidaciones(jobName: string): string {
  return `## Validaciones Realizadas

Se realizaron las siguientes validaciones en el job **${jobName}**:

- **Validación de esquema**: Todos los schemas cumplen con el formato esperado
- **Validación de conexión**: Componentes tDBConnection verificados
- **Validación de datos**: Transformaciones verificadas con datos de prueba
- **Validación de logs**: Salidas correcta formateadas para monitoreo
- **Validación de rendimiento**: Tiempo de ejecución dentro de umbrales aceptables`;
}

function generarSnippetErrores(jobName: string): string {
  return `## Errores y Soluciones

Durante el desarrollo del job **${jobName}** se encontraron y resolvieron:

- **Error de conexión**: Configuración incorrecta de credenciales → Actualizado con variables de contexto
- **Error de tipos**: Incompatibilidad en conversión de fechas → Implementado formato iso8601
- **Error de null**: Valores nulos no manejados → Agregado componente tMap con lógica de coalescencia
- **Error de rendimiento**: Queries lentas → Optimizado con filtros tempranaos en tMap
- **Lecciones aprendidas**: Documentación actualizada para futuros desarrollos`;
}

function generarSnippetTiempo(jobName: string): string {
  return `## Tiempo de Ejecución

Métricas de ejecución del job **${jobName}**:

- **Ejecución inicial**: 45 segundos (dataset de prueba pequeño)
- **Ejecución con datos completos**: 3 minutos 20 segundos
- **Puntos de control**: Logging каждые 1000 registros procesadas
- **Optimizaciones aplicadas**: Reducción de 15% mediante filtros adelantados
- **Comparativa**: Rendimiento mejorado vs versión anterior en 20%`;
}

function generarSnippetEvidencias(jobName: string): string {
  return `## Evidencias Generadas

El job **${jobName}** produce las siguientes evidencias:

- **Log de ejecución**: Archivo de log con timestamps detallados
- **Archivo de salida**: Dataset procesada con validación de registros
- **Reporte de errores**: Archivo JSON con detalle de posibles incidencias
- **Métricas**: CSV con estadísticas de procesamiento (tiempo, registros, errores)
- **Snapshot**: Captura del estado del job para auditorías`;
}

export function generateSnippet(input: SnippetInput): string {
  const jobName = input.jobName || "NombreJob";

  switch (input.section) {
    case "diseno":
      return generarSnippetDiseno(jobName);
    case "contextos":
      return generarSnippetContextos(jobName);
    case "validaciones":
      return generarSnippetValidaciones(jobName);
    case "errores":
      return generarSnippetErrores(jobName);
    case "tiempo":
      return generarSnippetTiempo(jobName);
    case "evidencias":
      return generarSnippetEvidencias(jobName);
    default:
      return input.customText || "Seleccione una sección para generar el snippet.";
  }
}

export const talendReportGenerateSnippetsTool = {
  name: "talend_report_generate_snippets",
  description: "Genera fragmentos de texto listos para usar en reportes académicos sobre jobs de Talend.",
  inputSchema: z.object({
    jobName: z.string().optional().describe("Nombre del job"),
    section: z.enum(["diseno", "contextos", "validaciones", "errores", "tiempo", "evidencias"]).optional().describe("Sección del reporte"),
    customText: z.string().optional().describe("Texto personalizado para el snippet"),
  }),
  handler: async (input: SnippetInput): Promise<CallToolResult> => {
    try {
      const snippet = generateSnippet(input);
      return jsonOk({ snippet, section: input.section || "custom", jobName: input.jobName });
    } catch (e) {
      return err(`Error generando snippet: ${e}`);
    }
  },
};