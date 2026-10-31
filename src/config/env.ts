import { z } from "zod/v4";

/**
 * Bandera de entorno textual.
 *
 * `z.coerce.boolean()` convierte cualquier cadena no vacia en `true`, asi que
 * `TALEND_BRIDGE_AUTO_INSTALL=0` quedaria activo. Aca solo `1` y `true` cuentan
 * como verdadero.
 */
const flag = z
  .enum(["0", "1", "true", "false"])
  .optional()
  .transform((value) => (value === undefined ? undefined : value === "1" || value === "true"));

/**
 * Contrato de variables de entorno del MCP.
 *
 * Las rutas se normalizan con `src/platform/path-bridge.ts`; aca solo se declara
 * que variables entiende el servidor.
 */
export const TalendMcpEnvSchema = z.object({
  TALEND_PROJECT: z.string().optional(),
  TALEND_WORKSPACE: z.string().optional(),
  TALEND_STUDIO_HOME: z.string().optional(),
  TALEND_STUDIO_PLUGINS_DIR: z.string().optional(),

  TALEND_HOST_OS: z.enum(["auto", "macos", "windows", "linux"]).default("auto"),
  TALEND_PATH_MODE: z.enum(["auto", "native", "wsl-windows"]).default("auto"),

  TALEND_MCP_MODE: z.enum(["http", "stdio"]).default("http"),
  TALEND_MCP_PORT: z.coerce.number().default(3927),
  TALEND_MCP_HOST: z.string().default("127.0.0.1"),
  TALEND_MCP_FILTER: z.string().optional(),
  TALEND_MCP_LOG: z.enum(["quiet", "normal", "verbose"]).default("normal"),
  /** Tope del cuerpo JSON-RPC. Sin tope, un POST grande tumba el proceso. */
  TALEND_MCP_MAX_BODY_BYTES: z.coerce.number().int().positive().default(1_048_576),
  /** Ejecuciones que se conservan en `.talend-mcp/runs`; las mas viejas se borran. */
  TALEND_MCP_MAX_RUNS: z.coerce.number().int().positive().default(200),
  /** Carpeta del historial de ejecuciones (por defecto `.talend-mcp/runs`). */
  TALEND_MCP_RUNS_DIR: z.string().optional(),
  /** Plazo de una tool antes de responder que no termino (por defecto 10 minutos). */
  TALEND_MCP_TOOL_TIMEOUT_MS: z.coerce.number().int().positive().default(600_000),
  /** Llamadas a tools que se atienden a la vez; el resto recibe error de servidor ocupado. */
  TALEND_MCP_MAX_CONCURRENT_CALLS: z.coerce.number().int().positive().default(4),
  /** Tope de una respuesta de tool; por encima se responde error y se pide paginar. */
  TALEND_MCP_MAX_RESPONSE_BYTES: z.coerce.number().int().positive().default(16 * 1024 * 1024),

  TALEND_BRIDGE_HOST: z.string().default("127.0.0.1"),
  TALEND_BRIDGE_PORT: z.coerce.number().default(3930),
  TALEND_BRIDGE_CONFIG: z.string().optional(),
  TALEND_BRIDGE_TOKEN: z.string().optional(),
  TALEND_BRIDGE_HOT_DIR: z.string().optional(),
  TALEND_BRIDGE_AUTO_INSTALL: flag,

  TALEND_BUILDS_DIR: z.string().optional(),
  TALEND_LOG_DIR: z.string().optional(),
  TALEND_DISABLE_AUTODETECT: flag,
});

export type TalendMcpEnv = z.infer<typeof TalendMcpEnvSchema>;

export function getTalendMcpEnv(): TalendMcpEnv {
  return TalendMcpEnvSchema.parse(process.env);
}
