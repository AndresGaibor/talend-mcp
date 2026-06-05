import { Card } from "../../components/Card";
import { DataTable } from "../../components/DataTable";
import type { BatchRawMappingsResult } from "./types";

interface RawMappingsTableProps {
  mappings: BatchRawMappingsResult;
}

export function RawMappingsTable({ mappings }: RawMappingsTableProps) {
  const columnColumns = [
    { key: "source", header: "Source Column" },
    { key: "target", header: "Target Column" },
    { key: "talendType", header: "Talend Type" },
    {
      key: "nullable",
      header: "Nullable",
      render: (row: { nullable: boolean }) => (row.nullable ? "Yes" : "No"),
    },
  ];

  return (
    <div className="space-y-4">
      {mappings.mappings.map((mapping, idx) => (
        <Card key={idx} className="p-4">
          <div className="mb-4">
            <h4 className="font-semibold text-gray-900">
              {mapping.csvFile} → {mapping.targetTable}
            </h4>
          </div>
          <DataTable data={mapping.columns} columns={columnColumns} />
        </Card>
      ))}
    </div>
  );
}
