import { useState, useCallback } from "react";
import { useCallTool } from "../../openai/useCallTool";
import { AppHeader, ErrorBanner } from "../../design-system";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import type { RequirementItem, RequirementAnalysisResult, ChecklistBuildResult } from "./types";

const RESPONSIBILITY_COLORS = {
  talend: "bg-purple-100 text-purple-800 border-purple-200",
  sql: "bg-blue-100 text-blue-800 border-blue-200",
  external: "bg-amber-100 text-amber-800 border-amber-200",
  report: "bg-emerald-100 text-emerald-800 border-emerald-200",
} as const;

const RESPONSIBILITY_LABELS = {
  talend: "Talend",
  sql: "SQL",
  external: "External",
  report: "Report",
} as const;

const STATUS_COLORS = {
  pending: "bg-gray-100 text-gray-700 border-gray-200",
  in_progress: "bg-blue-100 text-blue-700 border-blue-200",
  completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  not_applicable: "bg-gray-100 text-gray-400 border-gray-200",
} as const;

const STATUS_LABELS = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
  not_applicable: "N/A",
} as const;

export function RequirementChecklistApp() {
  const { execute: callTool, isLoading } = useCallTool();

  const [requirementText, setRequirementText] = useState("");
  const [items, setItems] = useState<RequirementItem[]>([]);
  const [analysisResult, setAnalysisResult] = useState<RequirementAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyzeRequirements = useCallback(async () => {
    if (!requirementText.trim()) {
      setError("Ingresa el texto del requerimiento");
      return;
    }

    setError(null);
    setItems([]);
    setAnalysisResult(null);

    const analyzeResult = await callTool("talend_task_analyze_requirements", {
      requirementText: requirementText.trim(),
    });

    if (!analyzeResult.success || !analyzeResult.result) {
      setError(analyzeResult.error ?? "Error al analizar requerimientos");
      return;
    }

    try {
      const data = JSON.parse(analyzeResult.result) as RequirementAnalysisResult;
      setAnalysisResult(data);

      const checklistResult = await callTool("talend_task_build_execution_plan", {
        requirements: data.requirements,
      });

      if (checklistResult.success && checklistResult.result) {
        const checklistData = JSON.parse(checklistResult.result) as ChecklistBuildResult;
        setItems(checklistData.checklist);
      } else {
        setItems(data.requirements);
      }
    } catch {
      setError("Error al parsear resultado del analisis");
    }
  }, [callTool, requirementText]);

  const updateItemStatus = useCallback((id: string, status: RequirementItem["status"]) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status } : item))
    );
  }, []);

  const updateItemEvidence = useCallback((id: string, evidence: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, evidence } : item))
    );
  }, []);

  const summary = analysisResult?.summary ?? null;

  return (
    <div className="space-y-6">
      <AppHeader
        title="Requirement Checklist"
        subtitle="Analiza requerimientos de workshop y genera checklist"
      />

      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      <Card className="p-4">
        <div className="space-y-4">
          <div>
            <label htmlFor="requirement-text" className="block text-sm font-medium text-gray-700 mb-1">
              Requirement Text
            </label>
            <textarea
              id="requirement-text"
              value={requirementText}
              onChange={(e) => setRequirementText(e.target.value)}
              placeholder="Pega aqui el texto del requerimiento del workshop..."
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            />
          </div>
          <Button onClick={analyzeRequirements} disabled={isLoading || !requirementText.trim()}>
            {isLoading ? "Analizando..." : "Analizar Requerimientos"}
          </Button>
        </div>
      </Card>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="p-4 text-center">
            <p className="text-3xl font-bold text-gray-900">{summary.total}</p>
            <p className="text-sm text-gray-500">Total</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-3xl font-bold text-purple-600">{summary.talend}</p>
            <p className="text-sm text-gray-500">Talend</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-3xl font-bold text-blue-600">{summary.sql}</p>
            <p className="text-sm text-gray-500">SQL</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-3xl font-bold text-amber-600">{summary.external}</p>
            <p className="text-sm text-gray-500">External</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-3xl font-bold text-emerald-600">{summary.report}</p>
            <p className="text-sm text-gray-500">Report</p>
          </Card>
        </div>
      )}

      {items.length > 0 && (
        <Card className="p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Checklist Items</h3>
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="border border-gray-200 rounded-lg p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{item.description}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                          RESPONSIBILITY_COLORS[item.responsibility]
                        }`}
                      >
                        {RESPONSIBILITY_LABELS[item.responsibility]}
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                          item.priority === "high"
                            ? "bg-red-100 text-red-700 border-red-200"
                            : item.priority === "medium"
                            ? "bg-amber-100 text-amber-700 border-amber-200"
                            : "bg-gray-100 text-gray-600 border-gray-200"
                        }`}
                      >
                        {item.priority}
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                          STATUS_COLORS[item.status]
                        }`}
                      >
                        {STATUS_LABELS[item.status]}
                      </span>
                    </div>
                  </div>
                </div>

                {item.suggestedTool && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Suggested Tool:</span>
                    <Badge variant="default">{item.suggestedTool}</Badge>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Evidence
                  </label>
                  <input
                    type="text"
                    value={item.evidence ?? ""}
                    onChange={(e) => updateItemEvidence(item.id, e.target.value)}
                    placeholder="Documenta la evidencia aqui..."
                    className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Update Status:</span>
                  <div className="flex gap-1">
                    {(["pending", "in_progress", "completed", "not_applicable"] as const).map((status) => (
                      <button
                        key={status}
                        onClick={() => updateItemStatus(item.id, status)}
                        className={`px-2 py-1 text-xs rounded border transition-colors ${
                          item.status === status
                            ? "bg-blue-100 border-blue-300 text-blue-700"
                            : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        {STATUS_LABELS[status]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {!isLoading && items.length === 0 && !error && (
        <Card className="p-8 text-center">
          <p className="text-gray-500">Ingresa el texto del requerimiento y haz clic en "Analizar" para generar el checklist</p>
        </Card>
      )}
    </div>
  );
}
