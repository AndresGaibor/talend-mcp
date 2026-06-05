import { Card } from "../../components/Card";
import { DataTable } from "../../components/DataTable";
import type { CsvFileInfo } from "./types";

interface ColumnsTableProps {
  file: CsvFileInfo;
}

export function ColumnsTable({ file }: ColumnsTableProps) {
  const columns = [
    { key: "name", header: "Column Name" },
    { key: "inferredType", header: "Type" },
    {
      key: "nullable",
      header: "Nullable",
      render: (row: { nullable: boolean }) => (row.nullable ? "Yes" : "No"),
    },
    {
      key: "sampleValues",
      header: "Sample Values",
      render: (row: { sampleValues: string[] }) =>
        row.sampleValues.slice(0, 3).join(", "),
    },
  ];

  return (
    <Card className="p-4">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Columns: {file.relativePath}</h3>
        <p className="text-sm text-gray-500">{file.rowCount} rows</p>
      </div>
      <DataTable data={file.columns} columns={columns} />
    </Card>
  );
}
