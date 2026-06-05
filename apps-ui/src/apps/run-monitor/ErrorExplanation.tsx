import { Card } from "../../components/Card";
import { Button } from "../../components/Button";

interface ErrorInfo {
  errorCode?: string;
  errorMessage?: string;
  stackTrace?: string;
  possibleCauses?: string[];
  suggestedFixes?: string[];
}

interface ErrorExplanationProps {
  errorInfo: ErrorInfo | null;
  isLoading: boolean;
}

export function ErrorExplanation({ errorInfo, isLoading }: ErrorExplanationProps) {
  if (isLoading) {
    return (
      <Card className="p-6 text-center">
        <div className="animate-pulse">
          <div className="text-4xl mb-4">🔍</div>
          <p className="text-gray-500">Analizando error...</p>
        </div>
      </Card>
    );
  }

  if (!errorInfo) {
    return (
      <Card className="p-6">
        <p className="text-gray-500">No hay información del error disponible</p>
        <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
          ← Volver
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <span className="text-3xl">❌</span>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Análisis de Error</h3>
          {errorInfo.errorCode && (
            <p className="text-sm text-gray-500">Código: {errorInfo.errorCode}</p>
          )}
        </div>
      </div>

      {errorInfo.errorMessage && (
        <div className="mb-6">
          <h4 className="font-semibold text-gray-900 mb-2">Mensaje de Error</h4>
          <p className="text-red-600 bg-red-50 px-4 py-3 rounded-lg font-mono text-sm">
            {errorInfo.errorMessage}
          </p>
        </div>
      )}

      {errorInfo.stackTrace && (
        <div className="mb-6">
          <h4 className="font-semibold text-gray-900 mb-2">Stack Trace</h4>
          <pre className="text-xs text-gray-700 bg-gray-100 px-4 py-3 rounded-lg overflow-x-auto">
            {errorInfo.stackTrace}
          </pre>
        </div>
      )}

      {errorInfo.possibleCauses && errorInfo.possibleCauses.length > 0 && (
        <div className="mb-6">
          <h4 className="font-semibold text-gray-900 mb-2">Causas Posibles</h4>
          <ul className="list-disc list-inside space-y-1">
            {errorInfo.possibleCauses.map((cause, idx) => (
              <li key={idx} className="text-gray-700">{cause}</li>
            ))}
          </ul>
        </div>
      )}

      {errorInfo.suggestedFixes && errorInfo.suggestedFixes.length > 0 && (
        <div className="mb-6">
          <h4 className="font-semibold text-gray-900 mb-2">Soluciones Sugeridas</h4>
          <ul className="list-disc list-inside space-y-1">
            {errorInfo.suggestedFixes.map((fix, idx) => (
              <li key={idx} className="text-green-700">{fix}</li>
            ))}
          </ul>
        </div>
      )}

      <Button variant="outline" onClick={() => window.location.reload()}>
        ← Volver al Inicio
      </Button>
    </Card>
  );
}
