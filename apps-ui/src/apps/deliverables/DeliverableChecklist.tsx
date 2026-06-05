import { Card } from "../../components/Card";

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  required: boolean;
  checked: boolean;
  severity: "error" | "warning" | "info";
}

interface DeliverableChecklistProps {
  items: ChecklistItem[];
  onToggleItem: (id: string) => void;
  validationResult?: { passed: boolean; errors: string[] } | null;
  isValidating: boolean;
}

export function DeliverableChecklist({
  items,
  onToggleItem,
  validationResult,
  isValidating,
}: DeliverableChecklistProps) {
  const getSeverityIcon = (severity: "error" | "warning" | "info") => {
    switch (severity) {
      case "error":
        return "❌";
      case "warning":
        return "⚠️";
      case "info":
        return "ℹ️";
    }
  };

  const getSeverityColor = (severity: "error" | "warning" | "info") => {
    switch (severity) {
      case "error":
        return "border-red-200 bg-red-50";
      case "warning":
        return "border-yellow-200 bg-yellow-50";
      case "info":
        return "border-blue-200 bg-blue-50";
    }
  };

  const requiredItems = items.filter((item) => item.required);
  const optionalItems = items.filter((item) => !item.required);
  const checkedRequiredCount = requiredItems.filter((item) => item.checked).length;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Checklist de Validación</h3>
        <div className="text-sm text-gray-500">
          {checkedRequiredCount}/{requiredItems.length} required completados
        </div>
      </div>

      {isValidating && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm">
          Validando archivos...
        </div>
      )}

      {validationResult && !validationResult.passed && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="font-medium text-red-700">Validación fallida</p>
          <ul className="mt-2 text-sm text-red-600 list-disc list-inside">
            {validationResult.errors.map((error, idx) => (
              <li key={idx}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {validationResult?.passed && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          ✓ Todos los items requeridos han sido validados correctamente
        </div>
      )}

      <div className="space-y-3">
        {requiredItems.length > 0 && (
          <>
            <p className="text-sm font-medium text-gray-700 uppercase tracking-wide">
              Requeridos
            </p>
            {requiredItems.map((item) => (
              <div
                key={item.id}
                className={`p-3 rounded-lg border ${getSeverityColor(item.severity)} ${
                  item.checked ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={() => onToggleItem(item.id)}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span>{getSeverityIcon(item.severity)}</span>
                      <p className="font-medium text-gray-900">{item.label}</p>
                      {item.required && (
                        <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                          Requerido
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {optionalItems.length > 0 && (
          <>
            <p className="text-sm font-medium text-gray-700 uppercase tracking-wide mt-6">
              Opcionales
            </p>
            {optionalItems.map((item) => (
              <div
                key={item.id}
                className={`p-3 rounded-lg border ${getSeverityColor(item.severity)} ${
                  item.checked ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={() => onToggleItem(item.id)}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span>{getSeverityIcon(item.severity)}</span>
                      <p className="font-medium text-gray-900">{item.label}</p>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </Card>
  );
}
