import { useState, useCallback, useEffect } from "react";
import { useCallTool } from "../../openai/useCallTool";
import { useAppSession } from "../../openai/useAppSession";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { RunStatusCard } from "./RunStatusCard";
import { RunTimeline } from "./RunTimeline";
import { RunLogsPanel } from "./RunLogsPanel";
import { ErrorExplanation } from "./ErrorExplanation";

type AppStep = "select" | "confirm" | "running" | "status" | "duration" | "problems" | "explanation" | "export";

interface Job {
  id: string;
  name: string;
  label?: string;
  status?: string;
}

interface RunStatus {
  runId: string;
  status: "STARTING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "UNKNOWN";
  startTime?: string;
  endTime?: string;
  duration?: number;
  errorCount?: number;
  warningCount?: number;
}

interface TimelineEvent {
  timestamp: string;
  event: string;
  details?: string;
}

interface LogEntry {
  timestamp: string;
  level: "INFO" | "WARN" | "ERROR" | "DEBUG";
  message: string;
}

interface RunResult {
  logs: LogEntry[];
  events: TimelineEvent[];
  status: RunStatus;
}

interface ErrorInfo {
  errorCode?: string;
  errorMessage?: string;
  stackTrace?: string;
  possibleCauses?: string[];
  suggestedFixes?: string[];
}

export function RunMonitorApp() {
  const { execute: callTool, isLoading } = useCallTool();
  const { updateSession } = useAppSession();

  const [step, setStep] = useState<AppStep>("select");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  const loadJobs = useCallback(async () => {
    setError(null);
    const result = await callTool("talend_runs_list", { limit: 100 });
    if (result.success && result.result) {
      try {
        const data = JSON.parse(result.result);
        if (Array.isArray(data)) {
          setJobs(data);
        } else if (data.jobs) {
          setJobs(data.jobs);
        } else {
          setJobs([]);
        }
      } catch {
        setJobs([]);
      }
    } else {
      setError(result.error || "Error cargando jobs");
    }
  }, [callTool]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  const startRun = useCallback(async () => {
    if (!selectedJob) return;
    setShowConfirmModal(false);
    setIsRunning(true);
    setStep("running");
    setError(null);

    const startResult = await callTool("talend_runs_start", { jobId: selectedJob.id });
    if (!startResult.success || !startResult.result) {
      setError(startResult.error || "Error iniciando job");
      setIsRunning(false);
      setStep("select");
      return;
    }

    let runId: string;
    try {
      const parsed = JSON.parse(startResult.result);
      runId = parsed.runId || parsed.id || startResult.result;
    } catch {
      runId = startResult.result;
    }

    const pollStatus = async () => {
      const statusResult = await callTool("talend_runs_read", { runId });
      if (statusResult.success && statusResult.result) {
        try {
          const data = JSON.parse(statusResult.result);
          if (data.status === "SUCCEEDED" || data.status === "FAILED") {
            if (pollingInterval) clearInterval(pollingInterval);
            setRunResult({
              logs: data.logs || [],
              events: data.events || [],
              status: data,
            });
            setIsRunning(false);
            setStep("status");
            await updateSession({ lastRunId: runId });
          }
        } catch {
          // Continue polling
        }
      }
    };

    const interval = setInterval(pollStatus, 2000);
    setPollingInterval(interval);
  }, [selectedJob, callTool, pollingInterval]);

  const viewDuration = useCallback(() => {
    setStep("duration");
  }, []);

  const viewProblems = useCallback(async () => {
    if (!runResult?.status?.runId) return;
    setStep("problems");
  }, [runResult]);

  const explainError = useCallback(async () => {
    if (!runResult?.status?.runId) return;
    setStep("explanation");
    setError(null);

    const result = await callTool("talend_errors_explain", { runId: runResult.status.runId });
    if (result.success && result.result) {
      try {
        const data = JSON.parse(result.result);
        setErrorInfo(data);
      } catch {
        setErrorInfo({ errorMessage: result.result });
      }
    } else {
      setErrorInfo({ errorMessage: result.error || "No se pudo obtener explicación" });
    }
  }, [runResult, callTool]);

  const exportEvidence = useCallback(() => {
    if (!runResult) return;
    const evidence = {
      jobName: selectedJob?.name,
      runId: runResult.status.runId,
      status: runResult.status.status,
      duration: runResult.status.duration,
      startTime: runResult.status.startTime,
      endTime: runResult.status.endTime,
      logs: runResult.logs,
      events: runResult.events,
      errorInfo,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(evidence, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `run-evidence-${runResult.status.runId || Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [runResult, selectedJob, errorInfo]);

  const goBack = useCallback(() => {
    if (step === "status" || step === "duration" || step === "problems" || step === "explanation") {
      setStep("select");
      setSelectedJob(null);
      setRunResult(null);
      setErrorInfo(null);
    } else if (step === "running") {
      if (pollingInterval) clearInterval(pollingInterval);
      setIsRunning(false);
      setStep("select");
    }
  }, [step, pollingInterval]);

  const selectJob = useCallback((job: Job) => {
    setSelectedJob(job);
    setShowConfirmModal(true);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Run Monitor Pro</h2>
          <p className="text-gray-500 mt-1">Ejecuta y monitorea jobs de Talend</p>
        </div>
        {step !== "select" && step !== "running" && (
          <Button variant="ghost" size="sm" onClick={goBack}>
            ← Nuevo Job
          </Button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {step === "select" && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Seleccionar Job</h3>
          {jobs.length === 0 ? (
            <p className="text-gray-500">No hay jobs disponibles</p>
          ) : (
            <div className="space-y-2">
              {jobs.map((job) => (
                <button
                  key={job.id}
                  onClick={() => selectJob(job)}
                  className="w-full text-left px-4 py-3 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
                >
                  <span className="font-medium text-gray-900">{job.name}</span>
                  {job.label && <span className="ml-2 text-gray-500">({job.label})</span>}
                </button>
              ))}
            </div>
          )}
        </Card>
      )}

      {showConfirmModal && selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Confirmar Ejecución</h3>
            <p className="text-gray-600 mb-6">
              ¿Estás seguro de que deseas ejecutar el job <strong>{selectedJob.name}</strong>?
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShowConfirmModal(false)}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={startRun} disabled={isLoading}>
                {isLoading ? "Iniciando..." : "Ejecutar"}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {step === "running" && (
        <Card className="p-6 text-center">
          <div className="animate-pulse">
            <div className="text-4xl mb-4">⏳</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Ejecutando Job...</h3>
            <p className="text-gray-500">
              {selectedJob?.name} está en ejecución
            </p>
          </div>
        </Card>
      )}

      {(step === "status" || step === "duration" || step === "problems" || step === "explanation" || step === "export") && runResult && (
        <>
          <RunStatusCard status={runResult.status} />

          {step === "status" && (
            <div className="space-y-4">
              <RunTimeline events={runResult.events} />
              <RunLogsPanel logs={runResult.logs} />
              <div className="flex gap-3 flex-wrap">
                <Button variant="secondary" onClick={viewDuration}>
                  Ver Duración
                </Button>
                <Button variant="secondary" onClick={viewProblems}>
                  Ver Problemas
                </Button>
                <Button variant="secondary" onClick={explainError} disabled={runResult.status.status !== "FAILED"}>
                  Explicar Error
                </Button>
                <Button variant="primary" onClick={exportEvidence}>
                  Exportar Evidencia
                </Button>
              </div>
            </div>
          )}

          {step === "duration" && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Duración de Ejecución</h3>
              <div className="text-3xl font-bold text-blue-600">
                {runResult.status.duration ? `${(runResult.status.duration / 1000).toFixed(2)}s` : "N/A"}
              </div>
              <p className="text-gray-500 mt-2">
                Inicio: {runResult.status.startTime ? new Date(runResult.status.startTime).toLocaleString() : "N/A"}
              </p>
              <p className="text-gray-500">
                Fin: {runResult.status.endTime ? new Date(runResult.status.endTime).toLocaleString() : "N/A"}
              </p>
              <Button variant="outline" className="mt-4" onClick={() => setStep("status")}>
                ← Volver
              </Button>
            </Card>
          )}

          {step === "problems" && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Problemas Detectados</h3>
              <div className="text-2xl font-bold text-orange-600">
                {runResult.status.errorCount || 0} errores, {runResult.status.warningCount || 0} warnings
              </div>
              <RunLogsPanel logs={runResult.logs.filter(l => l.level === "ERROR" || l.level === "WARN")} />
              <Button variant="outline" className="mt-4" onClick={() => setStep("status")}>
                ← Volver
              </Button>
            </Card>
          )}

          {step === "explanation" && (
            <ErrorExplanation errorInfo={errorInfo} isLoading={isLoading} />
          )}
        </>
      )}
    </div>
  );
}
