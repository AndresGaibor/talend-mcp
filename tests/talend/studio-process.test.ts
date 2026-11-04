import { describe, expect, test } from "bun:test";
import { isStudioProcess } from "../../src/talend/studio/process";

describe("isStudioProcess", () => {
  test("reconoce el ejecutable de Talend Studio por su nombre", () => {
    expect(isStudioProcess("Talend-Studio-win-x86_64.exe")).toBe(true);
  });

  test("reconoce el JVM de Studio lanzado con el launcher de Equinox", () => {
    const commandLine =
      'C:\\Talend\\8.0.1\\jdk\\bin\\java.exe -jar C:\\Talend\\8.0.1\\studio\\plugins\\org.eclipse.equinox.launcher_1.7.0.jar';
    expect(isStudioProcess("java.exe", commandLine)).toBe(true);
  });

  test("no confunde un proceso ajeno cuya linea de comandos contiene 'tos'", () => {
    const commandLine =
      '"C:\\Program Files\\Google\\Drive File Stream\\133.0.2.0\\crashpad_handler.exe" --database=C:\\Users\\yo\\Photos\\Crashpad';
    expect(isStudioProcess("crashpad_handler.exe", commandLine)).toBe(false);
  });

  test("no confunde el propio servidor MCP con Studio", () => {
    expect(isStudioProcess("bun.exe", "bun run C:\\Users\\yo\\code\\talend-mcp\\index.ts")).toBe(false);
  });

  test("no toma cualquier java por Studio", () => {
    expect(isStudioProcess("java.exe", "java -jar C:\\tools\\otra-app.jar")).toBe(false);
  });
});
