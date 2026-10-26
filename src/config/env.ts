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
