import { useState, useCallback } from "react";
import { useCallTool } from "../../openai/useCallTool";
import { useAppSession } from "../../openai/useAppSession";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { ScoreCard } from "./ScoreCard";
import { ChecksList, type ValidationCheck } from "./ChecksList";
import { ProblemsTable, type Problem } from "./ProblemsTable";
import { SuggestedFixes, type SuggestedFix } from "./SuggestedFixes";

interface ValidationReportState {
  score: number;
  totalChecks: number;
  passedChecks: number;
  warningsCount: number;
  errorsCount: number;
  checks: ValidationCheck[];
  problems: Problem[];
  suggestedFixes: SuggestedFix[];
  missingContexts: string[];
  auditColumns: { enabled: boolean; has_load_ts: boolean; has_load_run: boolean };
  dbOutputs: { tableName: string; status: string }[];
  performanceSettings: { batchSize: number; issues: string[]; recommendation: string };
}

export function ValidationReportApp() {
  const { execute: callTool, isLoading } = useCallTool();
  const { updateSession } = useAppSession();

  const [state, setState] = useState<ValidationReportState>({
    score: 0,
    totalChecks: 0,
    passedChecks: 0,
    warningsCount: 0,
    errorsCount: 0,
    checks: [],
    problems: [],
    suggestedFixes: [],
    missingContexts: [],
    auditColumns: { enabled: false, has_load_ts: false, has_load_run: false },
    dbOutputs: [],
    performanceSettings: { batchSize: 5000, issues: [], recommendation: "" },
  });

  const [jobName, setJobName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const runValidations = useCallback(async (name: string) => {
    if (!name.trim()) {
      setError("Ingresa el nombre del job");
      return;
    }

    setError(null);
    setState({
      score: 0,
      totalChecks: 0,
      passedChecks: 0,
      warningsCount: 0,
      errorsCount: 0,
      checks: [],
      problems: [],
      suggestedFixes: [],
      missingContexts: [],
      auditColumns: { enabled: false, has_load_ts: false, has_load_run: false },
      dbOutputs: [],
      performanceSettings: { batchSize: 5000, issues: [], recommendation: "" },
    });

    const checks: ValidationCheck[] = [];
    const problems: Problem[] = [];
    const suggestedFixes: SuggestedFix[] = [];
    let fixIdCounter = 1;

    const designResult = await callTool("talend_job_validate_design", { spec: { jobName: name } });
    if (designResult.success && designResult.result) {
      try {
        const data = JSON.parse(designResult.result);
        checks.push({
          id: "design",
          label: "Diseño del Job",
          status: data.valid ? "ok" : "error",
          message: data.valid ? "Válido" : "Diseño inválido",
        });
        if (!data.valid && data.errors) {
          data.errors.forEach((err: string, idx: number) => {
            problems.push({
              marker: "D",
              severity: "error",
              description: err,
              suggestedFix: `Revisar diseño del job: ${err}`,
            });
            suggestedFixes.push({
              id: `fix-design-${fixIdCounter++}`,
              problemId: `design-${idx}`,
              description: `Revisar diseño del job: ${err}`,
              automated: false,
              effort: "medium",
            });
          });
        }
      } catch {
        checks.push({ id: "design", label: "Diseño del Job", status: "error", message: "Error al validar" });
      }
    }

    const contextResult = await callTool("talend_job_validate_context_usage", { spec: { jobName: name } });
    const missingContexts: string[] = [];
    if (contextResult.success && contextResult.result) {
      try {
        const data = JSON.parse(contextResult.result);
        const hasAllRequired = data.hasAllRequired ?? data.missing?.length === 0;
        checks.push({
          id: "context",
          label: "Uso de Contextos",
          status: hasAllRequired ? "ok" : "warning",
          message: hasAllRequired ? "Todos los contextos requeridos presentes" : `Faltan: ${data.missing?.join(", ")}`,
        });
        if (!hasAllRequired && data.missing) {
          data.missing.forEach((ctx: string, idx: number) => {
            missingContexts.push(ctx);
            problems.push({
              marker: "C",
              severity: "warning",
              description: `Contexto requerido faltante: ${ctx}`,
            });
            suggestedFixes.push({
              id: `fix-context-${fixIdCounter++}`,
              problemId: `context-${idx}`,
              description: `Agregar contexto "${ctx}" al job`,
              automated: true,
              effort: "low",
            });
          });
        }
      } catch {
        checks.push({ id: "context", label: "Uso de Contextos", status: "error", message: "Error al validar" });
      }
    }

    const auditResult = await callTool("talend_job_validate_audit_columns", { spec: { jobName: name } });
    const auditColumns = { enabled: false, has_load_ts: false, has_load_run: false };
    if (auditResult.success && auditResult.result) {
      try {
        const data = JSON.parse(auditResult.result);
        const hasAudit = data.auditColumnsEnabled && data.has_load_ts && data.has_load_run;
        auditColumns.enabled = data.auditColumnsEnabled ?? false;
        auditColumns.has_load_ts = data.has_load_ts ?? false;
        auditColumns.has_load_run = data.has_load_run ?? false;
        checks.push({
          id: "audit",
          label: "Columnas de Audit",
          status: hasAudit ? "ok" : "warning",
          message: hasAudit ? "Configuradas correctamente" : "Faltan columnas de audit",
        });
        if (!hasAudit) {
          if (!data.auditColumnsEnabled) {
            problems.push({
              marker: "A",
              severity: "warning",
              description: "Columnas de audit no habilitadas",
              suggestedFix: "Habilitar auditColumns en la especificación del job",
            });
            suggestedFixes.push({
              id: `fix-audit-${fixIdCounter++}`,
              problemId: "audit-1",
              description: "Habilitar auditColumns en la especificación del job",
              automated: true,
              effort: "low",
            });
          }
          if (!data.has_load_ts) {
            problems.push({
              marker: "T",
              severity: "warning",
              description: "Falta columna técnica _load_ts",
            });
          }
          if (!data.has_load_run) {
            problems.push({
              marker: "T",
              severity: "warning",
              description: "Falta columna técnica _load_run",
            });
          }
        }
      } catch {
        checks.push({ id: "audit", label: "Columnas de Audit", status: "error", message: "Error al validar" });
      }
    }

    const perfResult = await callTool("talend_job_validate_performance_settings", { spec: { jobName: name } });
    const performanceSettings = { batchSize: 5000, issues: [] as string[], recommendation: "" };
    if (perfResult.success && perfResult.result) {
      try {
        const data = JSON.parse(perfResult.result);
        const hasIssues = data.issues?.length > 0;
        performanceSettings.batchSize = data.batchSize ?? 5000;
        performanceSettings.recommendation = data.recommendation ?? "";
        performanceSettings.issues = data.issues ?? [];
        checks.push({
          id: "performance",
          label: "Configuración de Performance",
          status: hasIssues ? "warning" : "ok",
          message: data.recommendation ?? (hasIssues ? `${data.issues?.length} problema(s)` : "Óptimo"),
        });
        if (hasIssues && data.issues) {
          data.issues.forEach((issue: string) => {
            problems.push({
              marker: "P",
              severity: "warning",
              description: issue,
            });
          });
        }
      } catch {
        checks.push({ id: "performance", label: "Configuración de Performance", status: "error", message: "Error al validar" });
      }
    }

    const okChecks = checks.filter((c) => c.status === "ok").length;
    const warningChecks = checks.filter((c) => c.status === "warning").length;
    const errorChecks = checks.filter((c) => c.status === "error").length;
    const totalChecks = checks.length;
    const score = totalChecks > 0 ? Math.round((okChecks / totalChecks) * 100) : 0;

    setState({
      score,
      totalChecks,
      passedChecks: okChecks,
      warningsCount: warningChecks,
      errorsCount: errorChecks,
      checks,
      problems,
      suggestedFixes,
      missingContexts,
      auditColumns,
      dbOutputs: [],
      performanceSettings,
    });
    await updateSession({ 
      validationReport: { 
        score, 
        totalChecks, 
        passedChecks: okChecks, 
        warningsCount: warningChecks, 
        errorsCount: errorChecks, 
        checks, 
        problems, 
        suggestedFixes, 
        missingContexts, 
        auditColumns, 
        dbOutputs: [], 
        performanceSettings 
      } 
    });
  }, [callTool, updateSession]);

  const hasData = state.totalChecks > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Reporte de Validación</h2>
          <p className="text-gray-500 mt-1">Validación de jobs y contexto</p>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Job</label>
            <input
              type="text"
              value={jobName}
              onChange={(e) => setJobName(e.target.value)}
              placeholder="myJob"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => e.key === "Enter" && runValidations(jobName)}
            />
          </div>
          <button
            onClick={() => runValidations(jobName)}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? "Validando..." : "Validar"}
          </button>
        </div>
        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
      </Card>

      {hasData && (
        <>
          <ScoreCard
            score={state.score}
            totalChecks={state.totalChecks}
            passedChecks={state.passedChecks}
            warningsCount={state.warningsCount}
            errorsCount={state.errorsCount}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChecksList checks={state.checks} />
            <div className="space-y-4">
              <Card className="p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Contextos Faltantes</h3>
                {state.missingContexts.length === 0 ? (
                  <p className="text-sm text-emerald-600">✓ Sin contextos faltantes</p>
                ) : (
                  <ul className="space-y-1">
                    {state.missingContexts.map((ctx, idx) => (
                      <li key={idx} className="text-sm text-amber-600">⚠ {ctx}</li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card className="p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Columnas de Audit</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={state.auditColumns.enabled ? "success" : "warning"}>
                      {state.auditColumns.enabled ? "Habilitado" : "Deshabilitado"}
                    </Badge>
                    <span className="text-sm text-gray-700">auditColumns</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={state.auditColumns.has_load_ts ? "success" : "error"}>
                      {state.auditColumns.has_load_ts ? "✓" : "✗"}
                    </Badge>
                    <span className="text-sm text-gray-700">_load_ts</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={state.auditColumns.has_load_run ? "success" : "error"}>
                      {state.auditColumns.has_load_run ? "✓" : "✗"}
                    </Badge>
                    <span className="text-sm text-gray-700">_load_run</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          <Card className="p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Configuración de Performance</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-500">Batch Size</p>
                <p className="text-xl font-semibold text-gray-900">{state.performanceSettings.batchSize}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Recomendación</p>
                <p className="text-sm text-gray-700">{state.performanceSettings.recommendation || "—"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Problemas</p>
                <p className={`text-xl font-semibold ${state.performanceSettings.issues.length > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                  {state.performanceSettings.issues.length}
                </p>
              </div>
            </div>
            {state.performanceSettings.issues.length > 0 && (
              <ul className="mt-3 space-y-1">
                {state.performanceSettings.issues.map((issue, idx) => (
                  <li key={idx} className="text-sm text-amber-600">⚠ {issue}</li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">DB Outputs</h3>
            {state.dbOutputs.length === 0 ? (
              <p className="text-sm text-gray-500">No hay información de DB outputs</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tabla</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {state.dbOutputs.map((output, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-2 text-sm text-gray-900">{output.tableName}</td>
                        <td className="px-3 py-2">
                          <Badge variant={output.status === "ok" ? "success" : "warning"}>{output.status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <ProblemsTable problems={state.problems} />
          <SuggestedFixes fixes={state.suggestedFixes} />
        </>
      )}

      {!hasData && !isLoading && (
        <Card className="p-8 text-center">
          <p className="text-gray-500">Ingresa el nombre de un job y haz clic en "Validar" para comenzar</p>
        </Card>
      )}
    </div>
  );
}