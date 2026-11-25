import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * El instalador es la primera impresion del proyecto y solo se prueba a mano: estos tests
 * comprueban que los scripts que se publican son los que documenta el README y que siguen
 * haciendo los pasos que el usuario espera (clientes, bridge, PATH y datos locales).
 */

const ROOT = join(import.meta.dir, "..", "..");
const read = (path: string): string => readFileSync(join(ROOT, path), "utf8");

describe("instaladores y desinstaladores", () => {
  test("el release publica los cuatro scripts", () => {
    const workflow = read(".github/workflows/release.yml");
    for (const name of ["install.ps1", "install.sh", "uninstall.ps1", "uninstall.sh"]) {
      expect(workflow).toContain(`scripts/install/${name}`);
    }
  });

  test("los instaladores configuran clientes e intentan el Bridge", () => {
    for (const path of ["scripts/install/install.ps1", "scripts/install/install.sh"]) {
      const script = read(path);
      expect(script).toContain("setup");
      expect(script).toContain("bridge install");
    }
  });

  test("los desinstaladores quitan clientes, datos locales y PATH", () => {
    const ps1 = read("scripts/install/uninstall.ps1");
    expect(ps1).toContain("& $exe remove");
    expect(ps1).toContain("'.talend-bridge'");
    expect(ps1).toContain("SetEnvironmentVariable('Path'");

    const sh = read("scripts/install/uninstall.sh");
    expect(sh).toContain('"$EXE" remove');
    expect(sh).toContain('rm -rf "$ROOT"');
    expect(sh).toContain('rm -rf "$BRIDGE"');
  });

  test("el README muestra como desactivar y como desinstalar", () => {
    const readme = read("README.md");
    expect(readme).toContain("talend-mcp remove");
    expect(readme).toContain("releases/latest/download/uninstall.ps1");
    expect(readme).toContain("releases/latest/download/uninstall.sh");
  });
});
