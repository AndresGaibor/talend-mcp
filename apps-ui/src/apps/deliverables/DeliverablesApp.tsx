import { useState, useCallback } from "react";
import { useCallTool } from "../../openai/useCallTool";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { Badge } from "../../components/Badge";
import { EvidenceFilesTable } from "./EvidenceFilesTable";
import { DeliverableChecklist } from "./DeliverableChecklist";
import { PackageBuilder } from "./PackageBuilder";

interface DeliverableFile {
  path: string;
  name: string;
  sizeBytes: number;
  type: string;
  modifiedAt: Date;
}

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  required: boolean;
  checked: boolean;
  severity: "error" | "warning" | "info";
}

interface DeliverablePackage {
  id: string;
  name: string;
  version: string;
  files: DeliverableFile[];
  totalSizeBytes: number;
  createdAt: Date;
  checksum: string;
}

interface ExportJob {
  id: string;
  name: string;
  status: "pending" | "running" | "completed" | "failed";
  startedAt: Date;
  completedAt?: Date;
  destination: string;
  packageId?: string;
  progress: number;
}

type Step = "collect" | "validate" | "create" | "export";

const DEFAULT_CHECKLIST_ITEMS: Omit<ChecklistItem, "checked">[] = [
  {
    id: "files-present",
    label: "Archivos presentes",
    description: "Verificar que todos los archivos de evidencia existan",
    required: true,
    severity: "error",
  },
  {
    id: "files-readable",
    label: "Archivos legibles",
    description: "Verificar que los archivos se puedan leer",
    required: true,
    severity: "error",
  },
  {
    id: "metadata-complete",
    label: "Metadatos completos",
    description: "Verificar que los metadatos estén completos",
    required: true,
    severity: "warning",
  },
  {
    id: "naming-convention",
    label: "Convención de nombres",
    description: "Verificar que los archivos sigan la convención de nombres",
    required: false,
    severity: "info",
  },
];

export function DeliverablesApp() {
  const { execute: callTool, isLoading } = useCallTool();

  const [step, setStep] = useState<Step>("collect");
  const [files, setFiles] = useState<DeliverableFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>(
    DEFAULT_CHECKLIST_ITEMS.map((item) => ({ ...item, checked: false }))
  );
  const [validationResult, setValidationResult] = useState<{ passed: boolean; errors: string[] } | null>(null);
  const [packageResult, setPackageResult] = useState<DeliverablePackage | null>(null);
  const [exportJob, setExportJob] = useState<ExportJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const [jobId, setJobId] = useState("");
  const [sourcePath, setSourcePath] = useState("");

  const handleCollectFiles = useCallback(async () => {
    if (!jobId.trim() || !sourcePath.trim()) {
      setError("Job ID y Source Path son requeridos");
      return;
    }
    setError(null);
    const result = await callTool("talend_deliverables_collect", {
      jobId: jobId.trim(),
      sourcePath: sourcePath.trim(),
      includeMetadata: true,
    });
    if (result.success && result.result) {
      try {
        const data = JSON.parse(result.result);
        const collectedFiles = Array.isArray(data) ? data : [];
        setFiles(collectedFiles);
        setSelectedFiles(new Set(collectedFiles.map((f: DeliverableFile) => f.path)));
        setStep("validate");
      } catch {
        setError("Error parseando archivos recolectados");
      }
    } else {
      setError(result.error ?? "Error recolectando archivos");
    }
  }, [callTool, jobId, sourcePath]);

  const handleToggleFile = useCallback((path: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const handleToggleChecklistItem = useCallback((id: string) => {
    setChecklistItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item))
    );
  }, []);

  const handleValidate = useCallback(async () => {
    setError(null);
    const result = await callTool("talend_deliverables_validate", {
      checklistId: "deliverable-checklist",
      items: checklistItems,
    });
    if (result.success && result.result) {
      try {
        const data = JSON.parse(result.result);
        setValidationResult({
          passed: data.passed ?? false,
          errors: data.errors ?? [],
        });
        if (data.passed) {
          setStep("create");
        }
      } catch {
        setValidationResult({ passed: false, errors: ["Error parseando resultado"] });
      }
    } else {
      setValidationResult({ passed: false, errors: [result.error ?? "Validación fallida"] });
    }
  }, [callTool, checklistItems]);

  const handleCreatePackage = useCallback(
    async (name: string, version: string) => {
      if (!showConfirmation) {
        setShowConfirmation(true);
        return;
      }
      setShowConfirmation(false);
      setError(null);
      const selectedFilesList = files.filter((f) => selectedFiles.has(f.path));
      const result = await callTool("talend_deliverables_create_package", {
        name,
        version,
        files: selectedFilesList,
        requiresConfirmation: true,
      });
      if (result.success && result.result) {
        try {
          const data = JSON.parse(result.result);
          setPackageResult(data);
          setStep("export");
        } catch {
          setError("Error parseando resultado del paquete");
        }
      } else {
        setError(result.error ?? "Error creando paquete");
      }
    },
    [callTool, files, selectedFiles, showConfirmation]
  );

  const handleCancelConfirmation = useCallback(() => {
    setShowConfirmation(false);
  }, []);

  const handleExport = useCallback(async () => {
    if (!packageResult) return;
    setError(null);
    const result = await callTool("talend_deliverables_export_job", {
      jobId,
      packageId: packageResult.id,
      destination: `./exports/${packageResult.name}`,
      format: "zip",
    });
    if (result.success && result.result) {
      try {
        const data = JSON.parse(result.result);
        setExportJob(data);
      } catch {
        setError("Error parseando resultado de exportación");
      }
    } else {
      setError(result.error ?? "Error iniciando exportación");
    }
  }, [callTool, jobId, packageResult]);

  const handleBack = useCallback(
    (targetStep: Step) => {
      setStep(targetStep);
      setValidationResult(null);
      if (targetStep === "collect") {
        setFiles([]);
        setSelectedFiles(new Set());
        setChecklistItems(DEFAULT_CHECKLIST_ITEMS.map((item) => ({ ...item, checked: false })));
        setPackageResult(null);
        setExportJob(null);
      }
    },
    []
  );

  const getStepStatus = (s: Step) => {
    const steps: Step[] = ["collect", "validate", "create", "export"];
    const currentIndex = steps.indexOf(step);
    const targetIndex = steps.indexOf(s);
    if (targetIndex < currentIndex) return "success";
    if (targetIndex === currentIndex) return "default";
    return "muted";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Deliverables</h2>
          <p className="text-gray-500 mt-1">
            {step === "collect" && "Recolectar archivos de evidencia"}
            {step === "validate" && "Validar checklist de deliverable"}
            {step === "create" && "Crear paquete"}
            {step === "export" && "Exportar job"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={getStepStatus("collect") === "success" ? "success" : "default"}>1. Collect</Badge>
          <span className="text-gray-400">→</span>
          <Badge variant={getStepStatus("validate") === "success" ? "success" : step === "validate" ? "default" : "muted"}>2. Validate</Badge>
          <span className="text-gray-400">→</span>
          <Badge variant={getStepStatus("create") === "success" ? "success" : step === "create" ? "default" : "muted"}>3. Create</Badge>
          <span className="text-gray-400">→</span>
          <Badge variant={step === "export" ? "default" : "muted"}>4. Export</Badge>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {step === "collect" && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recolectar Archivos</h3>
          <div className="space-y-4">
            <div>
              <label htmlFor="job-id" className="block text-sm font-medium text-gray-700 mb-1">
                Job ID *
              </label>
              <input
                id="job-id"
                type="text"
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
                placeholder="job_12345"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="source-path" className="block text-sm font-medium text-gray-700 mb-1">
                Source Path *
              </label>
              <input
                id="source-path"
                type="text"
                value={sourcePath}
                onChange={(e) => setSourcePath(e.target.value)}
                placeholder="/path/to/job/files"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button onClick={handleCollectFiles} disabled={isLoading || !jobId.trim() || !sourcePath.trim()}>
              {isLoading ? "Recolectando..." : "Recolectar archivos"}
            </Button>
          </div>
        </Card>
      )}

      {step === "validate" && (
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Archivos recolectados</h3>
            <p className="text-sm text-gray-500">
              {selectedFiles.size} de {files.length} archivos seleccionados
            </p>
          </Card>
          <EvidenceFilesTable
            files={files}
            selectedFiles={selectedFiles}
            onToggleFile={handleToggleFile}
          />
          <DeliverableChecklist
            items={checklistItems}
            onToggleItem={handleToggleChecklistItem}
            validationResult={validationResult}
            isValidating={isLoading}
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => handleBack("collect")}>
              Back
            </Button>
            <Button onClick={handleValidate} disabled={isLoading}>
              {isLoading ? "Validando..." : "Validar checklist"}
            </Button>
          </div>
        </div>
      )}

      {step === "create" && packageResult && (
        <Card className="p-6">
          <div className="text-center">
            <span className="text-5xl">📦</span>
            <h3 className="text-xl font-semibold text-gray-900 mt-4">Paquete creado exitosamente</h3>
            <div className="mt-4 p-4 bg-gray-50 rounded-lg inline-block text-left">
              <p><span className="text-gray-500">Nombre:</span> <span className="font-medium">{packageResult.name}</span></p>
              <p><span className="text-gray-500">Versión:</span> <span className="font-medium">{packageResult.version}</span></p>
              <p><span className="text-gray-500">Archivos:</span> <span className="font-medium">{packageResult.files.length}</span></p>
              <p><span className="text-gray-500">Checksum:</span> <span className="font-mono text-sm">{packageResult.checksum}</span></p>
            </div>
            <div className="mt-6">
              <Button onClick={() => setStep("export")}>Continuar a exportación</Button>
            </div>
          </div>
        </Card>
      )}

      {step === "create" && !packageResult && (
        <PackageBuilder
          files={files.filter((f) => selectedFiles.has(f.path))}
          onCreatePackage={handleCreatePackage}
          onCancel={() => handleBack("validate")}
          isCreating={isLoading}
          showConfirmation={showConfirmation}
          onConfirm={() => handleCreatePackage("", "")}
          onCancelConfirmation={handleCancelConfirmation}
        />
      )}

      {step === "export" && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Exportar Job</h3>
          {packageResult && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Paquete a exportar</p>
                <p className="font-medium text-gray-900">{packageResult.name} v{packageResult.version}</p>
              </div>
              {exportJob ? (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">Estado de exportación</p>
                  <Badge
                    variant={
                      exportJob.status === "completed"
                        ? "success"
                        : exportJob.status === "failed"
                        ? "error"
                        : "warning"
                    }
                  >
                    {exportJob.status}
                  </Badge>
                  {exportJob.status === "running" && (
                    <div className="mt-2">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${exportJob.progress}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{exportJob.progress}% completado</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm">
                  La exportación creará un archivo ZIP en ./exports/{packageResult.name}.zip
                </div>
              )}
            </div>
          )}
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => handleBack("create")}>
              Back
            </Button>
            <Button onClick={handleExport} disabled={isLoading || !!exportJob}>
              {isLoading ? "Exportando..." : "Iniciar exportación"}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
