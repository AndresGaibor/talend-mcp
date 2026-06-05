import { useState, useEffect, useCallback } from "react";
import { useCallTool } from "../../openai/useCallTool";
import { AppHeader, ErrorBanner, LoadingState } from "../../design-system";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { PatternsTable, type AntiPatternFinding } from "./PatternsTable";

interface ScanResult {
  projectPath: string;
  scannedJobs: number;
  patternsFound: number;
  patterns: AntiPatternFinding[];
}

export function AntiPatternDetectorApp() {
  const { execute: callTool, isLoading } = useCallTool();

  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedSeverity, setSelectedSeverity] = useState<string>("all");

  const runScan = useCallback(async () => {
    setError(null);
    setScanResult(null);

    const result = await callTool("talend_jobs_detect_antipatterns", {});
    if (result.ok && result.data) {
      const data = result.data as any;
      setScanResult({
        projectPath: data.projectPath ?? "",
        scannedJobs: data.scannedJobs ?? 0,
        patternsFound: data.patternsFound ?? 0,
        patterns: data.patterns ?? [],
      });
    } else {
      setError(result.error ?? "Scan failed");
    }
  }, [callTool]);

  useEffect(() => {
    runScan();
  }, [runScan]);

  const getSummaryStats = () => {
    if (!scanResult) return null;
    const { patterns } = scanResult;
    return {
      total: patterns.length,
      critical: patterns.filter((p) => p.severity === "critical").length,
      high: patterns.filter((p) => p.severity === "high").length,
      medium: patterns.filter((p) => p.severity === "medium").length,
      warning: patterns.filter((p) => p.severity === "warning").length,
      low: patterns.filter((p) => p.severity === "low").length,
    };
  };

  const stats = getSummaryStats();

  const filteredPatterns = scanResult
    ? selectedSeverity === "all"
      ? scanResult.patterns
      : scanResult.patterns.filter((p) => p.severity === selectedSeverity)
    : [];

  return (
    <div className="space-y-6">
      <AppHeader
        title="Anti-Pattern Detector"
        subtitle="Detect anti-patterns in Talend jobs"
        actions={
          <Button onClick={runScan} disabled={isLoading} size="sm">
            {isLoading ? "Scanning..." : "Run Scan"}
          </Button>
        }
      />

      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {isLoading && !scanResult && (
        <LoadingState message="Scanning for anti-patterns..." />
      )}

      {scanResult && stats && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card className="p-4 text-center">
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
              <div className="text-xs text-gray-500">Total Found</div>
            </Card>
            <Card className="p-4 text-center border-red-200">
              <div className="text-2xl font-bold text-red-600">{stats.critical}</div>
              <div className="text-xs text-gray-500">Critical</div>
            </Card>
            <Card className="p-4 text-center border-orange-200">
              <div className="text-2xl font-bold text-orange-600">{stats.high}</div>
              <div className="text-xs text-gray-500">High</div>
            </Card>
            <Card className="p-4 text-center border-yellow-200">
              <div className="text-2xl font-bold text-yellow-600">{stats.medium}</div>
              <div className="text-xs text-gray-500">Medium</div>
            </Card>
            <Card className="p-4 text-center border-blue-200">
              <div className="text-2xl font-bold text-blue-600">{stats.warning + stats.low}</div>
              <div className="text-xs text-gray-500">Warning + Low</div>
            </Card>
          </div>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-700">Scan Summary</h3>
              <div className="text-xs text-gray-500">
                {scanResult.scannedJobs} jobs scanned in {scanResult.projectPath}
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {["all", "critical", "high", "medium", "warning", "low"].map((sev) => (
                <button
                  key={sev}
                  onClick={() => setSelectedSeverity(sev)}
                  className={`px-3 py-2 text-sm rounded-md transition-colors ${
                    selectedSeverity === sev
                      ? "bg-blue-100 text-blue-700"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {sev.charAt(0).toUpperCase() + sev.slice(1)}
                  {sev !== "all" && scanResult
                    ? ` (${scanResult.patterns.filter((p) => p.severity === sev).length})`
                    : ` (${scanResult.patterns.length})`}
                </button>
              ))}
            </div>
          </Card>

          <PatternsTable patterns={filteredPatterns} />
        </>
      )}

      {scanResult === null && !isLoading && !error && (
        <Card className="p-6 text-center text-gray-500">
          Click "Run Scan" to detect anti-patterns in your Talend jobs.
        </Card>
      )}
    </div>
  );
}
