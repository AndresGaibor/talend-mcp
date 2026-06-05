import { Card } from "../../components/Card";
import { SecretRiskBadge } from "./SecretRiskBadge";

export interface SecretFinding {
  id: string;
  type: string;
  file: string;
  line?: number;
  maskedValue?: string;
  riskLevel: "critical" | "high" | "medium" | "low";
  description: string;
}

interface SecretsTableProps {
  secrets: SecretFinding[];
  onSecretClick?: (secret: SecretFinding) => void;
}

function formatSecretType(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getMaskedPreview(maskedValue?: string): string {
  if (!maskedValue) return "—";
  if (maskedValue.length <= 8) return maskedValue;
  return maskedValue.slice(0, 4) + "..." + maskedValue.slice(-4);
}

export function SecretsTable({ secrets, onSecretClick }: SecretsTableProps) {
  if (secrets.length === 0) {
    return (
      <Card className="p-6 text-center text-gray-500">
        No secrets found. Run a scan to detect secrets in your project.
      </Card>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Risk
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Type
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Value
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Location
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Description
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {secrets.map((secret) => (
            <tr
              key={secret.id}
              onClick={() => onSecretClick?.(secret)}
              className="hover:bg-gray-50 cursor-pointer transition-colors"
            >
              <td className="px-4 py-3 whitespace-nowrap">
                <SecretRiskBadge level={secret.riskLevel} />
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <span className="text-sm font-medium text-gray-900">
                  {formatSecretType(secret.type)}
                </span>
              </td>
              <td className="px-4 py-3">
                <code className="text-xs font-mono text-gray-600 bg-gray-100 px-2 py-1 rounded">
                  {getMaskedPreview(secret.maskedValue)}
                </code>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <span className="text-sm text-gray-600">
                  {secret.file}
                  {secret.line ? `:${secret.line}` : ""}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className="text-sm text-gray-500">{secret.description}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}