import { z } from "zod/v4";

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

  TALEND_BRIDGE_HOST: z.string().default("127.0.0.1"),
  TALEND_BRIDGE_PORT: z.coerce.number().default(3930),
  TALEND_BRIDGE_CONFIG: z.string().optional(),
  TALEND_BRIDGE_TOKEN: z.string().optional(),

  TALEND_BUILDS_DIR: z.string().optional(),
  TALEND_DISABLE_AUTODETECT: z.coerce.boolean().optional(),
});

export type TalendMcpEnv = z.infer<typeof TalendMcpEnvSchema>;

export function getTalendMcpEnv(): TalendMcpEnv {
  return TalendMcpEnvSchema.parse(process.env);
}
