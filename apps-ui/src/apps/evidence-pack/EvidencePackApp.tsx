import { useState, useCallback } from "react";
import { useCallTool } from "../../openai/useCallTool";
import { AppHeader, ErrorBanner } from "../../design-system";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { Badge } from "../../components/Badge";

export function EvidencePackApp() {
  const [jobName, setJobName] = useState("");
  const [packId, setPackId] = useState<string | null>(null);
  const [evidenceFiles, setEvidenceFiles] = useState<string[]>([]);
  const { execute, isLoading, error } = useCallTool();

  const handleBuildPack = useCallback(async () => {
    if (!jobName.trim()) return;
    setPackId(null);
    setEvidenceFiles([]);

    const result = await execute("talend_evidence_pack_build", { jobName });
    if (result.success && result.result) {
      try {
        const data = JSON.parse(result.result);
        setPackId(data.packId || data.id || result.result);
        setEvidenceFiles(data.files || []);
      } catch {
        setPackId(result.result);
      }
    }
  }, [execute, jobName]);

  const handleExport = useCallback(async () => {
    if (!packId) return;
    await execute("talend_evidence_pack_build", { packId, export: true });
  }, [execute, packId]);

  return (
    <div className="space-y-6">
      <AppHeader
        title="Evidence Pack"
        subtitle="Generar paquetes de evidencia para auditorias"
        actions={<Badge variant="info">Evidence</Badge>}
      />

      <ErrorBanner message={error} />

      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Job</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={jobName}
                onChange={(e) => setJobName(e.target.value)}
                placeholder="myJob"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Button onClick={handleBuildPack} disabled={!jobName.trim() || isLoading}>
                {isLoading ? "Generando..." : "Generar Pack"}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {packId && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Paquete Generado</h3>
            <Button variant="secondary" onClick={handleExport} disabled={isLoading}>
              Exportar ZIP
            </Button>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-2">ID del Paquete: <span className="font-mono font-bold text-gray-900">{packId}</span></p>
            {evidenceFiles.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Archivos Incluidos:</p>
                <ul className="space-y-1">
                  {evidenceFiles.map((file, i) => (
                    <li key={i} className="text-sm text-gray-700 flex items-center gap-2">
                      <span className="text-gray-400">-</span> {file}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
