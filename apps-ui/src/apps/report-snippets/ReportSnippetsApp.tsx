import { useState, useCallback } from "react";
import { useCallTool } from "../../openai/useCallTool";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { Badge } from "../../components/Badge";
import { SnippetCard } from "./SnippetCard";

type SnippetSection = "diseno" | "contextos" | "validaciones" | "errores" | "tiempo" | "evidencias";

interface GeneratedSnippet {
  section: SnippetSection;
  content: string;
  timestamp: Date;
}

const SECTION_LABELS: Record<SnippetSection, string> = {
  diseno: "Diseño del Job",
  contextos: "Contextos Usados",
  validaciones: "Validaciones Realizadas",
  errores: "Errores y Soluciones",
  tiempo: "Tiempo de Ejecución",
  evidencias: "Evidencias Generadas",
};

const SECTION_DESCRIPTIONS: Record<SnippetSection, string> = {
  diseno: "Descripción de la arquitectura y componentes",
  contextos: "Parámetros de configuración por entorno",
  validaciones: "Pruebas y verificaciones realizadas",
  errores: "Problemas encontrados y soluciones aplicadas",
  tiempo: "Métricas de rendimiento y optimización",
  evidencias: "Archivos y logs generados",
};

const DEFAULT_JOB_NAME = "MiJobTalend";

export function ReportSnippetsApp() {
  const [jobName, setJobName] = useState(DEFAULT_JOB_NAME);
  const [generatedSnippets, setGeneratedSnippets] = useState<GeneratedSnippet[]>([]);
  const [copiedSection, setCopiedSection] = useState<SnippetSection | null>(null);
  const { execute, isLoading, error } = useCallTool();

  const generarSnippet = useCallback(
    async (section: SnippetSection) => {
      const toolResult = await execute("talend_report_generate_snippets", {
        jobName,
        section,
      });

      if (toolResult.success && toolResult.result) {
        try {
          const parsed = JSON.parse(toolResult.result);
          const newSnippet: GeneratedSnippet = {
            section,
            content: parsed.snippet || parsed.data?.snippet || String(parsed),
            timestamp: new Date(),
          };

          setGeneratedSnippets((prev) => {
            const existing = prev.findIndex((s) => s.section === section);
            if (existing >= 0) {
              const updated = [...prev];
              updated[existing] = newSnippet;
              return updated;
            }
            return [...prev, newSnippet];
          });
        } catch {
          const newSnippet: GeneratedSnippet = {
            section,
            content: toolResult.result,
            timestamp: new Date(),
          };
          setGeneratedSnippets((prev) => {
            const existing = prev.findIndex((s) => s.section === section);
            if (existing >= 0) {
              const updated = [...prev];
              updated[existing] = newSnippet;
              return updated;
            }
            return [...prev, newSnippet];
          });
        }
      }
    },
    [execute, jobName]
  );

  const copiarSnippet = useCallback((section: SnippetSection, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  }, []);

  const generarTodos = useCallback(async () => {
    const sections: SnippetSection[] = ["diseno", "contextos", "validaciones", "errores", "tiempo", "evidencias"];
    for (const section of sections) {
      await generarSnippet(section);
    }
  }, [generarSnippet]);

  const exportarTodo = useCallback(() => {
    const contenido = generatedSnippets
      .map((s) => s.content)
      .join("\n\n---\n\n");
    navigator.clipboard.writeText(contenido);
  }, [generatedSnippets]);

  const secciones: SnippetSection[] = ["diseno", "contextos", "validaciones", "errores", "tiempo", "evidencias"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Generador de Snippets para Reportes</h1>
          <p className="text-sm text-gray-500 mt-1">
            Genera texto listo para pegar en reportes académicos sobre jobs de Talend
          </p>
        </div>
        <Badge variant="info">v1.0</Badge>
      </div>

      <Card className="p-4">
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label htmlFor="jobName" className="block text-sm font-medium text-gray-700 mb-1">
              Nombre del Job
            </label>
            <input
              id="jobName"
              type="text"
              value={jobName}
              onChange={(e) => setJobName(e.target.value)}
              placeholder="Ingrese el nombre del job"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <Button onClick={generarTodos} disabled={isLoading} variant="primary">
            {isLoading ? "Generando..." : "Generar Todos"}
          </Button>
          {generatedSnippets.length > 0 && (
            <Button onClick={exportarTodo} variant="secondary">
              Exportar Todo
            </Button>
          )}
        </div>
      </Card>

      {error && (
        <Card className="p-4 border-red-300 bg-red-50">
          <p className="text-red-700 text-sm">{error}</p>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {secciones.map((section) => {
          const snippet = generatedSnippets.find((s) => s.section === section);
          return (
            <SnippetCard
              key={section}
              section={section}
              label={SECTION_LABELS[section]}
              description={SECTION_DESCRIPTIONS[section]}
              content={snippet?.content}
              isLoading={isLoading}
              isCopied={copiedSection === section}
              onGenerate={() => generarSnippet(section)}
              onCopy={() => snippet && copiarSnippet(section, snippet.content)}
            />
          );
        })}
      </div>

      {generatedSnippets.length === 0 && !isLoading && (
        <Card className="p-8 text-center">
          <p className="text-gray-500">
            Seleccione una sección para generar el snippet o use "Generar Todos"
          </p>
        </Card>
      )}
    </div>
  );
}