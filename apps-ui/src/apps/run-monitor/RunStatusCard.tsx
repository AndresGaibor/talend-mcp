interface RunStatus {
  runId: string;
  status: "STARTING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "UNKNOWN";
  startTime?: string;
  endTime?: string;
  duration?: number;
  errorCount?: number;
  warningCount?: number;
}

interface RunStatusCardProps {
  status: RunStatus;
}

export function RunStatusCard({ status }: RunStatusCardProps) {
  const statusConfig = {
    STARTING: { bg: "bg-amber-50 border-amber-200", dotColor: "bg-amber-400", label: "Iniciando" },
    RUNNING: { bg: "bg-blue-50 border-blue-200", dotColor: "bg-blue-400", label: "Ejecutando" },
    SUCCEEDED: { bg: "bg-emerald-50 border-emerald-200", dotColor: "bg-emerald-400", label: "Exitoso" },
    FAILED: { bg: "bg-red-50 border-red-200", dotColor: "bg-red-400", label: "Fallido" },
    UNKNOWN: { bg: "bg-gray-50 border-gray-200", dotColor: "bg-gray-400", label: "Desconocido" },
  };

  const config = statusConfig[status.status] || statusConfig.UNKNOWN;

  return (
    <div className={`inline-flex items-center gap-3 px-4 py-3 rounded-lg border ${config.bg}`}>
      <span className={`w-3 h-3 rounded-full ${config.dotColor}`} />
      <div>
        <p className="font-semibold text-gray-900">{config.label}</p>
        <p className="text-sm text-gray-500">Run ID: {status.runId}</p>
      </div>
    </div>
  );
}
