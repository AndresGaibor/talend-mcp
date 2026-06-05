import { useState, useCallback } from "react";
import { useCallTool } from "../../openai/useCallTool";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import type { ComponentInfo, TemplateResult } from "./types";

interface ComponentTemplatePanelProps {
  component: ComponentInfo | null;
}

export function ComponentTemplatePanel({ component }: ComponentTemplatePanelProps) {
  const { execute: callTool, isLoading } = useCallTool();
  const [template, setTemplate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateTemplate = useCallback(async () => {
    if (!component) return;
    setError(null);
    setTemplate(null);

    const result = await callTool("talend_components_generate_template", {
      family: component.family,
      name: component.name,
    });

    if (result.success && result.result) {
      try {
        const data = JSON.parse(result.result) as TemplateResult;
        if (data.ok) {
          setTemplate(data.template || "");
        } else {
          setError(data.error || "Generación de template falló");
        }
      } catch {
        setError("Error parseando respuesta");
      }
    } else {
      setError(result.error || "Error en generación");
    }
  }, [component, callTool]);

  const copyToClipboard = useCallback(() => {
    if (template) {
      navigator.clipboard.writeText(template);
    }
  }, [template]);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Generar Template</h3>
        <Button
          variant="primary"
          size="sm"
          onClick={generateTemplate}
          disabled={isLoading || !component}
        >
          {isLoading ? "Generando..." : "Generar"}
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-md mb-4">
          {error}
        </div>
      )}

      {!component && (
        <p className="text-gray-500 text-center py-8">
          Selecciona un componente para generar template
        </p>
      )}

      {component && !template && !error && !isLoading && (
        <p className="text-gray-500 text-center py-8">
          Presiona "Generar" para crear el template XML del componente
        </p>
      )}

      {template && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={copyToClipboard}>
              Copiar al portapapeles
            </Button>
          </div>
          <pre className="bg-gray-900 text-gray-100 p-4 rounded-md overflow-x-auto text-sm max-h-96 overflow-y-auto">
            <code>{template}</code>
          </pre>
        </div>
      )}
    </Card>
  );
}
