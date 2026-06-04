import type { DatabaseConnection, DbComponentInfo } from "../contexts/context-types";

export type { DatabaseConnection, DbComponentInfo };

export const DB_COMPONENT_MAP: Record<string, DbComponentInfo[]> = {
  postgresql: [
    { componentFamily: "Databases", componentName: "tPostgresqlInput", supportsBulkLoad: false, supportsBatchInsert: true },
    { componentFamily: "Databases", componentName: "tPostgresqlOutput", supportsBulkLoad: false, supportsBatchInsert: true },
    { componentFamily: "Databases", componentName: "tPostgresqlRow", supportsBulkLoad: false, supportsBatchInsert: false },
  ],
  mysql: [
    { componentFamily: "Databases", componentName: "tMysqlInput", supportsBulkLoad: false, supportsBatchInsert: true },
    { componentFamily: "Databases", componentName: "tMysqlOutput", supportsBulkLoad: true, supportsBatchInsert: true },
    { componentFamily: "Databases", componentName: "tMysqlRow", supportsBulkLoad: false, supportsBatchInsert: false },
  ],
  snowflake: [
    { componentFamily: "Cloud", componentName: "tSnowflakeInput", supportsBulkLoad: true, supportsBatchInsert: true },
    { componentFamily: "Cloud", componentName: "tSnowflakeOutput", supportsBulkLoad: true, supportsBatchInsert: true },
    { componentFamily: "Cloud", componentName: "tSnowflakeRow", supportsBulkLoad: false, supportsBatchInsert: false },
  ],
  redshift: [
    { componentFamily: "Databases", componentName: "tRedshiftInput", supportsBulkLoad: true, supportsBatchInsert: true },
    { componentFamily: "Databases", componentName: "tRedshiftOutput", supportsBulkLoad: true, supportsBatchInsert: true },
  ],
  sqlserver: [
    { componentFamily: "Databases", componentName: "tSQLServerInput", supportsBulkLoad: false, supportsBatchInsert: true },
    { componentFamily: "Databases", componentName: "tSQLServerOutput", supportsBulkLoad: false, supportsBatchInsert: true },
  ],
};

export function detectAvailableDbComponents(connectionType: string): DbComponentInfo[] {
  return DB_COMPONENT_MAP[connectionType] ?? [];
}

export function buildConnectionProfile(
  type: DatabaseConnection["type"],
  host: string,
  port: number,
  database: string,
  user: string,
  schema?: string
): DatabaseConnection {
  return { name: `${type}_${database}`, type, host, port, database, user, schema };
}

export function applyConnectionToJobSpec(
  conn: DatabaseConnection,
  jobSpec: Record<string, unknown>
): Record<string, unknown> {
  return {
    ...jobSpec,
    databaseConnection: {
      type: conn.type,
      host: conn.host,
      port: conn.port,
      database: conn.database,
      schema: conn.schema,
    },
    contextAssignments: {
      db_host: conn.host,
      db_port: String(conn.port),
      db_name: conn.database,
      db_user: conn.user,
    },
  };
}
