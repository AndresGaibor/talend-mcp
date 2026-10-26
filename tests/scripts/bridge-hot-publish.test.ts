import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

import { hotJarPath, isJarFile, publishHotJar } from "../../scripts/lib/bridge-hot-reload";

const originalHotDir = process.env.TALEND_BRIDGE_HOT_DIR;
let hotDir: string;
let workDir: string;

/** Un "jar" minimo: lo que valida `isJarFile` es la cabecera zip y una cola de 22 bytes. */
function fakeJar(name: string, body: string): string {
  const path = join(workDir, name);
  writeFileSync(path, Buffer.concat([Buffer.from("PK\u0003\u0004"), Buffer.from(body), Buffer.alloc(22)]));
  return path;
}

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), "bridge-publish-src-"));
  hotDir = mkdtempSync(join(tmpdir(), "bridge-publish-hot-"));
  process.env.TALEND_BRIDGE_HOT_DIR = hotDir;
});

afterEach(() => {
  if (originalHotDir === undefined) delete process.env.TALEND_BRIDGE_HOT_DIR;
  else process.env.TALEND_BRIDGE_HOT_DIR = originalHotDir;
  rmSync(workDir, { recursive: true, force: true });
  rmSync(hotDir, { recursive: true, force: true });
});

describe("publicacion del jar para carga en caliente", () => {
  test("copia el jar a la carpeta que vigila el plugin y no deja temporales", () => {
    const source = fakeJar("build.jar", "primera version");

    const published = publishHotJar(source);

    expect(published).toBe(hotJarPath());
    expect(readFileSync(hotJarPath())).toEqual(readFileSync(source));
    expect(readdirSync(hotDir)).toEqual(["bridge.jar"]);
  });

  test("reemplaza la version anterior entera, sin mezclar contenidos", () => {
    publishHotJar(fakeJar("v1.jar", "x".repeat(4096)));
    const second = fakeJar("v2.jar", "segunda");

    publishHotJar(second);

    expect(readFileSync(hotJarPath())).toEqual(readFileSync(second));
    expect(readdirSync(hotDir)).toEqual(["bridge.jar"]);
  });

  test("rechaza un archivo que no es un jar y conserva el que ya estaba publicado", () => {
    const good = fakeJar("good.jar", "bueno");
    publishHotJar(good);
    const broken = join(workDir, "roto.jar");
    writeFileSync(broken, "esto no es un zip");

    const result = publishHotJar(broken);

    expect(result).toBeUndefined();
    expect(readFileSync(hotJarPath())).toEqual(readFileSync(good));
    expect(readdirSync(hotDir)).toEqual(["bridge.jar"]);
  });

  test("isJarFile exige la cabecera zip y un tamanio minimo", () => {
    expect(isJarFile(fakeJar("ok.jar", "algo"))).toBe(true);
    const short = join(workDir, "corto.jar");
    writeFileSync(short, "PK");
    expect(isJarFile(short)).toBe(false);
    expect(isJarFile(join(workDir, "no-existe.jar"))).toBe(false);
  });
});

describe("ruta de la carga en caliente", () => {
  test("usa TALEND_BRIDGE_HOT_DIR cuando esta definida", () => {
    expect(hotJarPath()).toBe(join(hotDir, "bridge.jar"));
  });

  test("una variable vacia usa la carpeta por defecto, igual que el plugin", () => {
    process.env.TALEND_BRIDGE_HOT_DIR = "   ";

    expect(hotJarPath()).toBe(join(homedir(), ".talend-bridge", "hot", "bridge.jar"));
  });
});
