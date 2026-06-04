import * as z from "zod/v4";
import { bridgeOk, bridgeFail } from "./tools-base";
import { detectAvailableDbComponents, buildConnectionProfile, applyConnectionToJobSpec } from "../connections/database-connection";
import type { DatabaseConnection } from "../connections/database-connection";

export const connectionTools = [
  {
    name: "talend_connection_detect_available_db_components",
    description: "Detecta los componentes de base de datos disponibles para un tipo de conexión.",
    inputSchema: z.object({
      connectionType: z.enum(["postgresql", "mysql", "snowflake", "redshift", "sqlserver"]).describe("Tipo de base de datos"),
    }),
    handler: async ({ connectionType }: { connectionType: "postgresql" | "mysql" | "snowflake" | "redshift" | "sqlserver" }) => {
      const components = detectAvailableDbComponents(connectionType);
      return bridgeOk({
        ok: true,
        source: "database-connection",
        confidence: "high",
        endpoint: "/connection/detect-db-components",
        data: { connectionType, components },
      });
    },
  },
  {
    name: "talend_connection_build_profile",
    description: "Construye un perfil de conexión a base de datos.",
    inputSchema: z.object({
      connectionType: z.enum(["postgresql", "mysql", "snowflake", "redshift", "sqlserver"]).describe("Tipo de base de datos"),
      host: z.string().describe("Host de la base de datos"),
      port: z.number().describe("Puerto"),
      database: z.string().describe("Nombre de la base de datos"),
      user: z.string().describe("Usuario"),
      schema: z.string().optional().describe("Schema opcional"),
    }),
    handler: async (input: { connectionType: "postgresql" | "mysql" | "snowflake" | "redshift" | "sqlserver"; host: string; port: number; database: string; user: string; schema?: string }) => {
      const profile = buildConnectionProfile(input.connectionType, input.host, input.port, input.database, input.user, input.schema);
      return bridgeOk({
        ok: true,
        source: "database-connection",
        confidence: "high",
        endpoint: "/connection/build-profile",
        data: { profile },
      });
    },
  },
  {
    name: "talend_connection_apply_to_job",
    description: "Aplica un perfil de conexión a una especificación de job.",
    inputSchema: z.object({
      profile: z.record(z.string(), z.unknown()).describe("Perfil de conexión"),
      jobSpec: z.record(z.string(), z.unknown()).describe("Especificación del job"),
    }),
    handler: async (input: { profile: Record<string, unknown>; jobSpec: Record<string, unknown> }) => {
      const profileConn = input.profile as unknown as DatabaseConnection;
      const result = applyConnectionToJobSpec(profileConn, input.jobSpec);
      return bridgeOk({
        ok: true,
        source: "database-connection",
        confidence: "high",
        endpoint: "/connection/apply-to-job",
        data: { jobSpecWithConnection: result },
      });
    },
  },
];
