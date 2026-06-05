import { Card } from "../../components/Card";

interface PathTripleProps {
  rawPath: string | null;
  mcpPath: string | null;
  talendHostPath: string | null;
}

export function PathTriple({ rawPath, mcpPath, talendHostPath }: PathTripleProps) {
  const paths = [
    { label: "Raw (env)", value: rawPath, color: "text-gray-600" },
    { label: "MCP", value: mcpPath, color: "text-blue-600" },
    { label: "Talend Host", value: talendHostPath, color: "text-green-600" },
  ];

  return (
    <Card className="p-4">
      <h4 className="text-sm font-medium text-gray-500 mb-3">Path Conversions</h4>
      <div className="space-y-2">
        {paths.map(({ label, value, color }) => (
          <div key={label} className="flex items-start gap-3">
            <span className="text-xs font-medium text-gray-400 w-20 shrink-0 pt-0.5">{label}</span>
            <code className={`text-sm font-mono break-all ${color}`}>
              {value ?? "—"}
            </code>
          </div>
        ))}
      </div>
    </Card>
  );
}