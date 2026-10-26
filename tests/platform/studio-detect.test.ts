import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { isStudioDir, studioHomeCandidates } from "../../scripts/lib/studio-detect";

const roots: string[] = [];

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "talend-studio-detect-"));
  roots.push(dir);
  return dir;
}

afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

describe("deteccion de Talend Studio", () => {
  test("TALEND_STUDIO_HOME es la primera ruta revisada", () => {
    const candidates = studioHomeCandidates({ TALEND_STUDIO_HOME: "C:/Talend/8.0.1/studio" }, "win32");
    expect(candidates[0]).toBe("C:/Talend/8.0.1/studio");
    expect(candidates[1]).toBe(join("C:/Talend/8.0.1/studio", "studio"));
  });

  test("sin variable se revisan las ubicaciones habituales de Windows", () => {
    const candidates = studioHomeCandidates({ LOCALAPPDATA: "C:/Users/x/AppData/Local" }, "win32");
    expect(candidates.some((path) => path.includes("Talend Studio"))).toBe(true);
    expect(candidates.every((path) => typeof path === "string" && path.length > 0)).toBe(true);
  });

  test("en macOS y Linux no se mezclan rutas de Windows", () => {
    const mac = studioHomeCandidates({}, "darwin");
    const linux = studioHomeCandidates({}, "linux");
    expect(mac.every((path) => !path.includes("C:/Talend"))).toBe(true);
    expect(linux.every((path) => !path.includes("C:/Talend"))).toBe(true);
    expect(linux.some((path) => path.includes("/opt/"))).toBe(true);
  });

  test("una carpeta es de Studio si tiene plugins y features", () => {
    const dir = tempDir();
    expect(isStudioDir(dir)).toBe(false);
    mkdirSync(join(dir, "plugins"));
    expect(isStudioDir(dir)).toBe(false);
    mkdirSync(join(dir, "features"));
    expect(isStudioDir(dir)).toBe(true);
  });

  test("no repite rutas equivalentes con distinto separador", () => {
    const explicit = "C:\\Talend\\studio";
    const candidates = studioHomeCandidates({ TALEND_STUDIO_HOME: explicit }, "win32");
    const seen = new Set(candidates.map((path) => path.replace(/\\/g, "/").replace(/\/+$/, "")));
    expect(seen.size).toBe(candidates.length);
  });
});

test("la ruta explicita puede ser la raiz de la instalacion", () => {
  const root = tempDir();
  mkdirSync(join(root, "studio", "plugins"), { recursive: true });
  mkdirSync(join(root, "studio", "features"), { recursive: true });
  writeFileSync(join(root, "studio", "plugins", ".keep"), "");

  const candidates = studioHomeCandidates({ TALEND_STUDIO_HOME: root }, "win32");
  const studioDir = candidates.find((path) => isStudioDir(path));
  expect(studioDir).toBe(join(root, "studio"));
});
