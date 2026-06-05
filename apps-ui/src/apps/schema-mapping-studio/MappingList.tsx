import { Card } from "../../components/Card";
import { DataTable } from "../../components/DataTable";
import type { MappingSuggestion } from "./types";

interface MappingListProps {
  mappings: MappingSuggestion[];
}

export function MappingList({ mappings }: MappingListProps) {
  if (!mappings || mappings.length === 0) {
    return (
      <Card className="p-4">
        <p className="text-sm text-gray-500">No mapping suggestions available</p>
      </Card>
    );
  }

  const columns = [
    { key: "sourceColumn", header: "Source Column" },
    { key: "targetColumn", header: "Target Column" },
    {
      key: "confidence",
      header: "Confidence",
      render: (row: MappingSuggestion) => `${(row.confidence * 100).toFixed(0)}%`,
    },
    { key: "reason", header: "Reason" },
  ];

  return (
    <Card className="p-4">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Mapping Suggestions</h3>
        <p className="text-sm text-gray-500">{mappings.length} suggested mappings</p>
      </div>
      <DataTable data={mappings} columns={columns} />
    </Card>
  );
}
