import { test, expect, describe } from "bun:test";
import { getAllRuntimeTools } from "../../src/server/registered-tools.ts";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Escanea recursivamente un directorio buscando archivos que coincidan con la extensión.
 */
async function* walk(dir: string): AsyncGenerator<string> {
  const files = await readdir(dir, { withFileTypes: true });
  for (const file of files) {
    const res = join(dir, file.name);
    if (file.isDirectory()) {
      yield* walk(res);
    } else if (file.isFile() && (res.endsWith(".tsx") || res.endsWith(".ts"))) {
      yield res;
    }
  }
}

describe("Validación de llamadas a tools en React", () => {
  test("todas las llamadas a callTool usan nombres de tools registrados", async () => {
    const registeredTools = getAllRuntimeTools();
    const registeredNames = new Set(registeredTools.map((t) => t.name));
    
    // También incluimos los nombres que pueden ser alias o estar en el registro legacy
    // Aunque getAllRuntimeTools ya debería incluirlos si buildRuntimeToolCache se ejecutó correctamente.

    const errors: string[] = [];
    const rootDir = process.cwd();
    const appsUiSrc = join(rootDir, "apps-ui/src");
    
    // Regex para encontrar talend_... dentro de callTool("...") o callTool('...')
    // Captura el nombre de la tool
    const toolCallRegex = /callTool\s*\(\s*["'](talend_[^"']+)["']/g;

    for await (const filePath of walk(appsUiSrc)) {
      const content = await readFile(filePath, "utf-8");
      let match: RegExpExecArray | null;
      
      while ((match = toolCallRegex.exec(content)) !== null) {
        const toolName = match[1];
        if (toolName && !registeredNames.has(toolName)) {
          const relativePath = filePath.split(rootDir).pop() || filePath;
          errors.push(`Tool desconocida "${toolName}" llamada en ${relativePath}`);
        }
      }
    }

    expect(
      errors.length,
      `Se encontraron llamadas a tools no registradas:\n${errors.join("\n")}`
    ).toBe(0);
  });
});
