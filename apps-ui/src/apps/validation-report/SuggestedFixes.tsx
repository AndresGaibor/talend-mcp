import { Card } from "../../components/Card";

export interface SuggestedFix {
  id: string;
  problemId: string;
  description: string;
  automated: boolean;
  effort?: "low" | "medium" | "high";
}

interface SuggestedFixesProps {
  fixes: SuggestedFix[];
}

export function SuggestedFixes({ fixes }: SuggestedFixesProps) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Soluciones Sugeridas</h3>
        {fixes.length > 0 && (
          <span className="text-sm text-gray-500">
            {fixes.filter((f) => f.automated).length} automáticas
          </span>
        )}
      </div>

      {fixes.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">No hay soluciones sugeridas</p>
      ) : (
        <ul className="space-y-3">
          {fixes.map((fix) => (
            <li
              key={fix.id}
              className="border border-gray-200 rounded-lg p-3 hover:border-blue-300 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-sm text-gray-900">{fix.description}</p>
                  <div className="flex items-center gap-2 mt-2">
                    {fix.automated && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        Automática
                      </span>
                    )}
                    {fix.effort && (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        fix.effort === "low" ? "bg-green-100 text-green-700" :
                        fix.effort === "medium" ? "bg-yellow-100 text-yellow-700" :
                        "bg-red-100 text-red-700"
                      }`}>
                        Esfuerzo: {fix.effort}
                      </span>
                    )}
                  </div>
                </div>
                {fix.automated && (
                  <button className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">
                    Aplicar
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}