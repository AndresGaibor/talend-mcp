import { useState, useEffect, useCallback } from "react";
import { useCallTool } from "../../openai/useCallTool";
import { Card } from "../../components/Card";
import { SecretsTable, type SecretFinding } from "./SecretsTable";
import { ContextMigrationPanel } from "./ContextMigrationPanel";

interface ScanResult {
  projectPath: string;
  scannedFiles: number;
  secretsFound: number;
  secrets: SecretFinding[];
}

interface ContextSuggestion {
  originalContext: string;
  recommendedContext: string;
  reason: string;
}

export function SecretSafetyApp() {
  const { execute: callTool, isLoading } = useCallTool();

  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [contextSuggestions, setContextSuggestions] = useState<ContextSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"secrets" | "context">("secrets");

  const runScan = useCallback(async () => {
    setError(null);
    setScanResult(null);
    setContextSuggestions([]);

    const result = await callTool("talend_secrets_scan_project", {});
    if (result.success && result.result) {
      try {
        const data = JSON.parse(result.result);
        setScanResult({
          projectPath: data.projectPath ?? "",
          scannedFiles: data.scannedFiles ?? 0,
          secretsFound: data.secretsFound ?? 0,
          secrets: data.secrets ?? [],
        });

        if (data.secrets?.length > 0) {
          const contextResult = await callTool("talend_secrets_suggest_context_migration", {
            secrets: data.secrets,
          });
          if (contextResult.success && contextResult.result) {
            try {
              const contextData = JSON.parse(contextResult.result);
              setContextSuggestions(contextData.suggestions ?? []);
            } catch {
              setContextSuggestions([]);
            }
          }
        }
      } catch {
        setError("Failed to parse scan results");
      }
    } else {
      setError(result.error ?? "Scan failed");
    }
  }, [callTool]);

  useEffect(() => {
    runScan();
  }, [runScan]);

  const getSummaryStats = () => {
    if (!scanResult) return null;
    const { secrets } = scanResult;
    return {
      total: secrets.length,
      critical: secrets.filter((s) => s.riskLevel === "critical").length,
      high: secrets.filter((s) => s.riskLevel === "high").length,
      medium: secrets.filter((s) => s.riskLevel === "medium").length,
      low: secrets.filter((s) => s.riskLevel === "low").length,
    };
  };

  const stats = getSummaryStats();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Secret Safety</h2>
          <p className="text-gray-500 mt-1">Detect and migrate exposed secrets</p>
        </div>
        <button
          onClick={runScan}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isLoading ? "Scanning..." : "Run Scan"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {scanResult && stats && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4 text-center">
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
              <div className="text-xs text-gray-500">Total Found</div>
            </Card>
            <Card className="p-4 text-center border-red-200">
              <div className="text-2xl font-bold text-red-600">{stats.critical + stats.high}</div>
              <div className="text-xs text-gray-500">Critical + High</div>
            </Card>
            <Card className="p-4 text-center">
              <div className="text-2xl font-bold text-yellow-600">{stats.medium}</div>
              <div className="text-xs text-gray-500">Medium</div>
            </Card>
            <Card className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{stats.low}</div>
              <div className="text-xs text-gray-500">Low</div>
            </Card>
          </div>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-700">Scan Summary</h3>
              <div className="text-xs text-gray-500">
                {scanResult.scannedFiles} files scanned in {scanResult.projectPath}
              </div>
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => setActiveTab("secrets")}
                className={`px-3 py-2 text-sm rounded-md transition-colors ${
                  activeTab === "secrets"
                    ? "bg-blue-100 text-blue-700"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                Secrets ({scanResult.secretsFound})
              </button>
              <button
                onClick={() => setActiveTab("context")}
                className={`px-3 py-2 text-sm rounded-md transition-colors ${
                  activeTab === "context"
                    ? "bg-blue-100 text-blue-700"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                Context Migration ({contextSuggestions.length})
              </button>
            </div>
          </Card>

          {activeTab === "secrets" && (
            <SecretsTable secrets={scanResult.secrets} />
          )}
          {activeTab === "context" && (
            <ContextMigrationPanel suggestions={contextSuggestions} />
          )}
        </>
      )}

      {scanResult === null && !isLoading && !error && (
        <Card className="p-6 text-center text-gray-500">
          Click "Run Scan" to detect secrets in your project.
        </Card>
      )}

      {isLoading && (
        <Card className="p-6 text-center">
          <div className="flex items-center justify-center gap-3">
            <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
            <span className="text-gray-500">Scanning for secrets...</span>
          </div>
        </Card>
      )}
    </div>
  );
}