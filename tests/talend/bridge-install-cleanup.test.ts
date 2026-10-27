import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

import { cleanLeftoverJars } from "../../scripts/lib/p2-install/cleanup";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("limpieza de bundles Talend anteriores", () => {
  test("elimina copias en plugins, dropins y dropins/plugins sin tocar otros plugins", () => {
    const studioDir = mkdtempSync(join(tmpdir(), "talend-bridge-install-"));
    temporaryDirectories.push(studioDir);

    const stalePaths = [
      join("plugins", "com.andres.talend.bridge_0.1.0.jar"),
      join("dropins", "com.andres.talend.bridge_0.1.0.jar"),
      join("dropins", "plugins", "com.andres.talend.bridge_0.1.0.jar"),
    ];
    for (const path of stalePaths) {
      const fullPath = join(studioDir, path);
      mkdirSync(dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, "bundle anterior");
    }

    const unrelatedPlugin = join(studioDir, "dropins", "plugins", "org.example.other.jar");
    writeFileSync(unrelatedPlugin, "otro bundle");

    const removed = cleanLeftoverJars({
      dir: studioDir,
      exe: "",
      jdk: "",
      studioDir,
    });

    expect(removed).toBe(3);
    for (const path of stalePaths) {
      expect(existsSync(join(studioDir, path))).toBe(false);
    }
    expect(existsSync(unrelatedPlugin)).toBe(true);
  });
});
