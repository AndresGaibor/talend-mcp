import { useMemo } from "react";

interface PipelinePreviewProps {
  preview: string;
}

interface PreviewData {
  name?: string;
  components?: Array<{ id: string; type: string; label: string }>;
  connections?: Array<{ from: string; to: string; label?: string }>;
  [key: string]: unknown;
}

export function PipelinePreview({ preview }: PipelinePreviewProps) {
  const parsed = useMemo(() => {
    try {
      return JSON.parse(preview) as PreviewData;
    } catch {
      return null;
    }
  }, [preview]);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Pipeline Preview</h3>

      {parsed ? (
        <div className="space-y-6">
          {parsed.name && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-500">Pipeline name:</span>
              <span className="ml-2 font-medium text-gray-900">{parsed.name}</span>
            </div>
          )}

          {parsed.components && parsed.components.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Components</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {parsed.components.map((comp, i) => (
                  <div
                    key={comp.id ?? i}
                    className="p-3 border border-gray-200 rounded-lg bg-white"
                  >
                    <span className="text-xs text-gray-500">{comp.type}</span>
                    <p className="font-medium text-gray-900">{comp.label}</p>
                    {comp.id && (
                      <span className="text-xs text-gray-400">ID: {comp.id}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {parsed.connections && parsed.connections.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Connections</h4>
              <div className="space-y-2">
                {parsed.connections.map((conn, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg bg-white"
                  >
                    <span className="font-mono text-sm text-gray-600">{conn.from}</span>
                    <span className="text-gray-400">→</span>
                    <span className="font-mono text-sm text-gray-600">{conn.to}</span>
                    {conn.label && (
                      <span className="ml-auto text-xs text-gray-500">{conn.label}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <pre className="p-4 bg-gray-50 rounded-lg overflow-auto text-sm">
          {preview}
        </pre>
      )}
    </div>
  );
}
