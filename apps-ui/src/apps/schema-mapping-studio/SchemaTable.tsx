import { Card } from "../../components/Card";
import { DataTable } from "../../components/DataTable";
import type { ComponentSchema } from "./types";

interface SchemaTableProps {
  schema: ComponentSchema | null;
  title?: string;
}

export function SchemaTable({ schema, title }: SchemaTableProps) {
  if (!schema) {
    return (
      <Card className="p-4">
        <p className="text-sm text-gray-500">No schema selected</p>
      </Card>
    );
  }

  const columns = [
    { key: "name", header: "Column Name" },
    { key: "type", header: "Type" },
    { key: "length", header: "Length" },
    { key: "nullable", header: "Nullable" },
    { key: "key", header: "Key" },
  ];

  return (
    <Card className="p-4">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          {title || schema.label || "Schema"}
        </h3>
        {schema.connector && (
          <p className="text-sm text-gray-500">Connector: {schema.connector}</p>
        )}
        <p className="text-sm text-gray-500">{schema.columns.length} columns</p>
      </div>
      <DataTable
        data={schema.columns}
        columns={columns}
      />
    </Card>
  );
}
