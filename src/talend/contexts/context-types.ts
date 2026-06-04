export interface ContextVariable {
  name: string;
  type: "string" | "number" | "password" | "boolean";
  defaultValue: string;
  description?: string;
}

export interface ContextProfile {
  name: string;
  description?: string;
  variables: ContextVariable[];
  applicableTo?: string[];
}

export interface ContextProfile {
  name: string;
  description?: string;
  variables: ContextVariable[];
  applicableTo?: string[];
}

export interface DatabaseConnection {
  name: string;
  type: "postgresql" | "mysql" | "oracle" | "sqlserver" | "snowflake" | "redshift" | "bigquery";
  host: string;
  port: number;
  database: string;
  user: string;
  password?: string;
  schema?: string;
  extraParams?: Record<string, string>;
}

export interface DbComponentInfo {
  componentFamily: string;
  componentName: string;
  supportsBulkLoad: boolean;
  supportsBatchInsert: boolean;
}

export interface DetectedDbComponents {
  database: DatabaseConnection;
  availableComponents: DbComponentInfo[];
}
