import { useState, useCallback } from "react";
import { AppHeader } from "../../design-system";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { Badge } from "../../components/Badge";
import { useExecutionData } from "./hooks";
import type { ExecutionRun, LaunchConfig } from "./types";

function StatusBadge({ status }: { status: ExecutionRun["status"] }) {
  const variants: Record<ExecutionRun["status"], "success" | "warning" | "error" | "default" | "info"> = {
    SUCCEEDED: "success",
    FAILED: "error",
    RUNNING: "info",
    STARTING: "warning",
    CANCELLED: "default",
    UNKNOWN: "default",
  };
  return <Badge variant={variants[status]}>{status}</Badge>;
}

function LaunchConfigList({ configs }: { configs: LaunchConfig[] }) {
  if (configs.length === 0) {
    return (
      <Card className="p-6 text-center">
        <p className="text-gray-500">No hay configs de lanzamiento</p>
      </Card>
    );
  }
  return (
    <div className="space-y-2">
      {configs.map((config) => (
        <div key={config.id} className="cursor-pointer" onClick={() => {}}>
          <Card className="p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-900">{config.name}</h4>
                <p className="text-sm text-gray-500">{config.jobName}</p>
              </div>
              {config.lastUsed && (
                <span className="text-xs text-gray-400">
                  Ultima vez: {new Date(config.lastUsed).toLocaleDateString()}
                </span>
              )}
            </div>
          </Card>
        </div>
      ))}
    </div>
  );
}

function RunList({
  runs,
  onSelectRun,
 selectedRun,
}: {
  runs: ExecutionRun[];
  onSelectRun: (run: ExecutionRun) => void;
  selectedRun: ExecutionRun | null;
}) {
  if (runs.length === 0) {
    return (
      <Card className="p-6 text-center">
        <p className="text-gray-500">No hay ejecuciones recientes</p>
      </Card>
    );
  }
  return (
    <div className="space-y-2">
      {runs.map((run) => (
        <div
          key={run.runId}
          className={`cursor-pointer ${
            selectedRun?.runId === run.runId ? "ring-2 ring-blue-500 rounded-lg" : ""
          }`}
          onClick={() => onSelectRun(run)}
        >
          <Card className="p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-900">{run.jobName}</h4>
                <p className="text-sm text-gray-500">
                  {run.startTime ? new Date(run.startTime).toLocaleString() : "Sin fecha"}
                </p>
              </div>
              <StatusBadge status={run.status} />
            </div>
            {run.duration && (
              <p className="text-xs text-gray-400 mt-1">
                Duracion: {(run.duration / 1000).toFixed(2)}s
              </p>
            )}
          </Card>
        </div>
      ))}
    </div>
  );
}

function RunDetails({ run }: { run: ExecutionRun }) {
  const [activeTab, setActiveTab] = useState<"logs" | "outputs" | "timeline">("logs");
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Detalles de Ejecucion</h3>
        <StatusBadge status={run.status} />
      </div>
      <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
        <div>
          <span className="text-gray-500">Job:</span>
          <span className="ml-2 font-medium">{run.jobName}</span>
        </div>
        <div>
          <span className="text-gray-500">Run ID:</span>
          <span className="ml-2 font-mono text-xs">{run.runId}</span>
        </div>
        <div>
          <span className="text-gray-500">Inicio:</span>
          <span className="ml-2">
            {run.startTime ? new Date(run.startTime).toLocaleString() : "N/A"}
          </span>
        </div>
        <div>
          <span className="text-gray-500">Duracion:</span>
          <span className="ml-2">{run.duration ? `${(run.duration / 1000).toFixed(2)}s` : "N/A"}</span>
        </div>
        <div>
          <span className="text-gray-500">Errores:</span>
          <span className="ml-2 text-red-600">{run.errorCount || 0}</span>
        </div>
        <div>
          <span className="text-gray-500">Warnings:</span>
          <span className="ml-2 text-orange-600">{run.warningCount || 0}</span>
        </div>
      </div>
      <div className="flex gap-2 mb-4 border-b">
        {(["logs", "outputs", "timeline"] as const).map((tab) => (
<button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab === "logs" ? "Logs" : tab === "outputs" ? "Outputs" : "Timeline"}
          </button>
        ))}
      </div>
      <div className="max-h-64 overflow-auto bg-gray-50 rounded-lg p-4">
        {activeTab === "logs" && (
          <div className="space-y-1 font-mono text-xs">
            {run.logs.length === 0 ? (
              <p className="text-gray-500">No hay logs</p>
            ) : (
              run.logs.map((log, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-gray-400">[{log.timestamp}]</span>
                  <span
                    className={`${
                      log.level === "ERROR"
                        ? "text-red-600"
                        : log.level === "WARN"
                        ? "text-orange-600"
                        : "text-gray-700"
                    }`}
                  >
                    [{log.level}]
                  </span>
                  <span className="text-gray-700">{log.message}</span>
                </div>
              ))
            )}
          </div>
        )}
        {activeTab === "outputs" && (
          <div className="space-y-2">
            {run.outputs.length === 0 ? (
              <p className="text-gray-500">No hay outputs</p>
            ) : (
              run.outputs.map((output, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="font-mono text-gray-700">{output.name}</span>
                  {output.size && (
                    <span className="text-gray-400">{(output.size / 1024).toFixed(1)} KB</span>
                  )}
                </div>
              ))
            )}
          </div>
        )}
        {activeTab === "timeline" && (
          <div className="space-y-2">
            {run.events.length === 0 ? (
              <p className="text-gray-500">No hay eventos</p>
            ) : (
              run.events.map((event, i) => (
                <div key={i} className="flex gap-2 text-sm">
                  <span className="text-gray-400">[{event.timestamp}]</span>
                  <span className="font-medium text-gray-700">{event.event}</span>
                  {event.details && (
                    <span className="text-gray-500">- {event.details}</span>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

export function ExecutionCenterApp() {
  const { configs, runs, selectedRun, selectRun } = useExecutionData();
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateEvidence = useCallback(async () => {
    if (!selectedRun) return;
    setIsGenerating(true);
    const evidence = {
      runId: selectedRun.runId,
      jobName: selectedRun.jobName,
      status: selectedRun.status,
      duration: selectedRun.duration,
      startTime: selectedRun.startTime,
      endTime: selectedRun.endTime,
      logs: selectedRun.logs,
      events: selectedRun.events,
      outputs: selectedRun.outputs,
      errorCount: selectedRun.errorCount,
      warningCount: selectedRun.warningCount,
      generatedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(evidence, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `evidence-${selectedRun.runId || Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setIsGenerating(false);
  }, [selectedRun]);

  return (
    <div className="space-y-6">
      <AppHeader
        title="Execution Center"
        subtitle="Historial de ejecuciones y evidencia"
      />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Launch Configs</h3>
          <LaunchConfigList configs={configs} />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Ejecuciones Recientes</h3>
          <RunList runs={runs} onSelectRun={selectRun} selectedRun={selectedRun} />
        </div>
      </div>

      {selectedRun && (
        <div className="space-y-4">
          <RunDetails run={selectedRun} />
          <Button
            variant="primary"
            onClick={handleGenerateEvidence}
            disabled={isGenerating}
            className="bg-green-500 hover:bg-green-600"
          >
            {isGenerating ? "Generando..." : "Generate Evidence"}
          </Button>
        </div>
      )}
    </div>
  );
}
