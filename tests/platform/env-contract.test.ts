import { describe, expect, test } from "bun:test";
import { TalendMcpEnvSchema } from "../../src/config/env";

describe("contrato de variables de entorno", () => {
  test("aplica los valores por defecto del servidor", () => {
    const env = TalendMcpEnvSchema.parse({});
    expect(env.TALEND_MCP_MODE).toBe("http");
    expect(env.TALEND_MCP_PORT).toBe(3927);
    expect(env.TALEND_MCP_HOST).toBe("127.0.0.1");
    expect(env.TALEND_MCP_LOG).toBe("normal");
    expect(env.TALEND_BRIDGE_PORT).toBe(3930);
  });

  test("las banderas solo aceptan 0, 1, true o false", () => {
    expect(TalendMcpEnvSchema.parse({ TALEND_BRIDGE_AUTO_INSTALL: "0" }).TALEND_BRIDGE_AUTO_INSTALL).toBe(false);
    expect(TalendMcpEnvSchema.parse({ TALEND_BRIDGE_AUTO_INSTALL: "false" }).TALEND_BRIDGE_AUTO_INSTALL).toBe(false);
    expect(TalendMcpEnvSchema.parse({ TALEND_BRIDGE_AUTO_INSTALL: "1" }).TALEND_BRIDGE_AUTO_INSTALL).toBe(true);
    expect(TalendMcpEnvSchema.parse({ TALEND_BRIDGE_AUTO_INSTALL: "true" }).TALEND_BRIDGE_AUTO_INSTALL).toBe(true);
    expect(TalendMcpEnvSchema.parse({}).TALEND_BRIDGE_AUTO_INSTALL).toBeUndefined();
    expect(() => TalendMcpEnvSchema.parse({ TALEND_BRIDGE_AUTO_INSTALL: "si" })).toThrow();
  });

  test("el nivel de log se valida", () => {
    expect(TalendMcpEnvSchema.parse({ TALEND_MCP_LOG: "verbose" }).TALEND_MCP_LOG).toBe("verbose");
    expect(() => TalendMcpEnvSchema.parse({ TALEND_MCP_LOG: "debug" })).toThrow();
  });
});
