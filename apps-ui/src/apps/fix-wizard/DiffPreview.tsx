interface DiffLine {
  type: "add" | "remove" | "context";
  content: string;
  lineNumber?: number;
}

interface DiffPreviewProps {
  diffContent: string | null;
  changes: Record<string, unknown>;
  isLoading: boolean;
}

function parseSimpleDiff(diffContent: string): DiffLine[] {
  if (!diffContent) return [];
  const lines = diffContent.split("\n");
  return lines.map((line) => {
    if (line.startsWith("+") && !line.startsWith("+++")) {
      return { type: "add" as const, content: line.substring(1) };
    }
    if (line.startsWith("-") && !line.startsWith("---")) {
      return { type: "remove" as const, content: line.substring(1) };
    }
    return { type: "context" as const, content: line };
  });
}

export function DiffPreview({ diffContent, changes, isLoading }: DiffPreviewProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!diffContent && Object.keys(changes).length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No changes to preview
      </div>
    );
  }

  const diffLines = parseSimpleDiff(diffContent ?? "");

  return (
    <div className="space-y-4">
      {Object.keys(changes).length > 0 && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Parameter Changes</h4>
          <div className="space-y-2">
            {Object.entries(changes).map(([key, value]) => (
              <div key={key} className="flex items-center gap-3 text-sm">
                <span className="font-mono text-gray-600">{key}</span>
                <span className="text-gray-400">→</span>
                <span className="font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                  {typeof value === "object" ? JSON.stringify(value) : String(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {diffLines.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-gray-100 px-4 py-2 border-b">
            <span className="text-sm font-medium text-gray-700">Code Diff</span>
          </div>
          <div className="bg-gray-900 p-3 max-h-64 overflow-auto">
            <pre className="text-xs font-mono whitespace-pre-wrap">
              {diffLines.map((line, i) => (
                <div
                  key={i}
                  className={
                    line.type === "add"
                      ? "text-green-400"
                      : line.type === "remove"
                      ? "text-red-400"
                      : "text-gray-400"
                  }
                >
                  <span className="select-none mr-3">
                    {line.type === "add" ? "+" : line.type === "remove" ? "-" : " "}
                  </span>
                  {line.content}
                </div>
              ))}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}