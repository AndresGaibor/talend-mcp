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
    STARTING: { color: "bg-yellow-100 text-yellow-800", icon: "⏳", label: "Iniciando" },
    RUNNING: { color: "bg-blue-100 text-blue-800", icon: "🔄", label: "Ejecutando" },
    SUCCEEDED: { color: "bg-green-100 text-green-800", icon: "✅", label: "Exitoso" },
    FAILED: { color: "bg-red-100 text-red-800", icon: "❌", label: "Fallido" },
    UNKNOWN: { color: "bg-gray-100 text-gray-800", icon: "❓", label: "Desconocido" },
  };

  const config = statusConfig[status.status] || statusConfig.UNKNOWN;

  return (
    <div className={`inline-flex items-center gap-3 px-4 py-2 rounded-lg ${config.color}`}>
      <span className="text-2xl">{config.icon}</span>
      <div>
        <p className="font-semibold">{config.label}</p>
        <p className="text-sm opacity-75">Run ID: {status.runId}</p>
      </div>
    </div>
  );
}
