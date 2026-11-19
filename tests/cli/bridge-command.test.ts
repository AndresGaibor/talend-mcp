import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { verifyChecksum } from "../../src/cli/bridge-command";
import { bridgeJarVersion } from "../../scripts/install-bridge";

const bytes = new TextEncoder().encode("contenido del zip");
const sha = createHash("sha256").update(bytes).digest("hex");

describe("verifyChecksum", () => {
  test("acepta el checksum correcto, con formato sha256sum", () => {
    expect(() => verifyChecksum(bytes, `${sha} *talend-bridge-p2.zip\n${"a".repeat(64)}  otro.exe\n`)).not.toThrow();
  });

  test("rechaza un checksum distinto", () => {
    expect(() => verifyChecksum(bytes, `${"0".repeat(64)}  talend-bridge-p2.zip\n`)).toThrow(/no coincide/);
  });

  test("rechaza si checksums.txt no lista el archivo", () => {
    expect(() => verifyChecksum(bytes, `${sha}  otro.exe\n`)).toThrow(/no lista/);
  });
});

describe("bridgeJarVersion", () => {
  test("extrae la version del nombre del jar del update site", () => {
    expect(bridgeJarVersion("/x/plugins/com.andres.talend.bridge_0.1.0.202611191543.jar")).toBe("0.1.0.202611191543");
    expect(bridgeJarVersion("/x/plugins/otro_1.0.0.jar")).toBeNull();
  });
});
