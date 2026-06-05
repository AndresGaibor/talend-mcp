import { Card } from "../../components/Card";

interface LogEntry {
  timestamp: string;
  level: "INFO" | "WARN" | "ERROR" | "DEBUG";
  message: string;
}

interface RunLogsPanelProps {
  logs: LogEntry[];
}

export function RunLogsPanel({ logs }: RunLogsPanelProps) {
  const levelStyles = {
    INFO: "text-blue-600",
    WARN: "text-yellow-600",
    ERROR: "text-red-600",
    DEBUG: "text-gray-500",
  };

  const levelBg = {
    INFO: "bg-blue-50",
    WARN: "bg-yellow-50",
    ERROR: "bg-red-50",
    DEBUG: "bg-gray-50",
  };

  return (
    <Card className="p-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Logs</h3>
      {logs.length === 0 ? (
        <p className="text-gray-500">No hay logs disponibles</p>
      ) : (
        <div className="font-mono text-sm space-y-1 max-h-96 overflow-y-auto">
          {logs.map((log, idx) => (
            <div key={idx} className={`px-3 py-2 rounded ${levelBg[log.level]}`}>
              <span className="text-gray-400">
                [{log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : "N/A"}]
              </span>
              <span className={`ml-2 font-semibold ${levelStyles[log.level]}`}>
                [{log.level}]
              </span>
              <span className="ml-2 text-gray-800">{log.message}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
