import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  listRepositoryContexts,
  readRepositoryContext,
  createRepositoryContext,
  upsertRepositoryContextParameter,
  deleteRepositoryContext,
  formatRepositoryContext,
  formatRepositoryContextList,
} from "../../src/talend/repository-contexts";

describe("repository contexts", () => {
  test("lista contextos vacíos cuando no hay ninguno", async () => {
    const tempRoot = join(tmpdir(), `talend-repo-ctx-${Date.now()}`);
    mkdirSync(tempRoot, { recursive: true });
    const projectPath = join(tempRoot, "project");
    mkdirSync(join(projectPath, "context"), { recursive: true });

    const contexts = await listRepositoryContexts(projectPath);
    expect(contexts).toEqual([]);
    rmSync(tempRoot, { recursive: true, force: true });
  });

  test("crea un contexto de repositorio y lo lista", async () => {
    const tempRoot = join(tmpdir(), `talend-repo-ctx-${Date.now()}`);
    mkdirSync(tempRoot, { recursive: true });
    const projectPath = join(tempRoot, "project");
    mkdirSync(join(projectPath, "context"), { recursive: true });

    const result = await createRepositoryContext(projectPath, {
      name: "mi_contexto",
      version: "0.1",
      purpose: "Contexto de prueba",
      description: "Descripción del contexto",
    });

    expect(existsSync(result.itemPath)).toBe(true);
    expect(existsSync(result.propertiesPath)).toBe(true);

    const list = await listRepositoryContexts(projectPath);
    expect(list.length).toBeGreaterThan(0);
    expect(list[0]!.name).toBe("mi_contexto");
    expect(list[0]!.purpose).toBe("Contexto de prueba");

    rmSync(tempRoot, { recursive: true, force: true });
  });

  test("lee un contexto de repositorio creado", async () => {
    const tempRoot = join(tmpdir(), `talend-repo-ctx-${Date.now()}`);
    mkdirSync(tempRoot, { recursive: true });
    const projectPath = join(tempRoot, "project");
    mkdirSync(join(projectPath, "context"), { recursive: true });

    await createRepositoryContext(projectPath, { name: "test_ctx" });

    const ctx = await readRepositoryContext(projectPath, "test_ctx");
    expect(ctx).not.toBeNull();
    expect(ctx!.name).toBe("test_ctx");
    expect(ctx!.contexts.length).toBeGreaterThan(0);
    expect(ctx!.contexts[0]!.contextName).toBe("Default");

    rmSync(tempRoot, { recursive: true, force: true });
  });

  test("inserta un parámetro en el contexto de repositorio", async () => {
    const tempRoot = join(tmpdir(), `talend-repo-ctx-${Date.now()}`);
    mkdirSync(tempRoot, { recursive: true });
    const projectPath = join(tempRoot, "project");
    mkdirSync(join(projectPath, "context"), { recursive: true });

    await createRepositoryContext(projectPath, { name: "ctx_param" });
    await upsertRepositoryContextParameter(projectPath, "ctx_param", "DB_HOST", "localhost", "Default", "id_String");

    const ctx = await readRepositoryContext(projectPath, "ctx_param");
    expect(ctx).not.toBeNull();
    const param = ctx!.contexts[0]!.parameters.find((p) => p.name === "DB_HOST");
    expect(param).toBeDefined();
    expect(param!.value).toBe("localhost");
    expect(param!.type).toBe("id_String");

    rmSync(tempRoot, { recursive: true, force: true });
  });

  test("elimina un contexto de repositorio", async () => {
    const tempRoot = join(tmpdir(), `talend-repo-ctx-${Date.now()}`);
    mkdirSync(tempRoot, { recursive: true });
    const projectPath = join(tempRoot, "project");
    mkdirSync(join(projectPath, "context"), { recursive: true });

    await createRepositoryContext(projectPath, { name: "ctx_to_delete" });

    const before = await listRepositoryContexts(projectPath);
    expect(before.some((c) => c.name === "ctx_to_delete")).toBe(true);

    await deleteRepositoryContext(projectPath, "ctx_to_delete");

    const after = await listRepositoryContexts(projectPath);
    expect(after.some((c) => c.name === "ctx_to_delete")).toBe(false);

    rmSync(tempRoot, { recursive: true, force: true });
  });

  test("formatea lista de contextos de repositorio", async () => {
    const tempRoot = join(tmpdir(), `talend-repo-ctx-${Date.now()}`);
    mkdirSync(tempRoot, { recursive: true });
    const projectPath = join(tempRoot, "project");
    mkdirSync(join(projectPath, "context"), { recursive: true });

    await createRepositoryContext(projectPath, { name: "olist_context", purpose: "Contexto Olist" });
    await upsertRepositoryContextParameter(projectPath, "olist_context", "ss_host", "localhost", "Default", "id_String");

    const list = await listRepositoryContexts(projectPath);
    const formatted = formatRepositoryContextList(list);

    expect(formatted).toContain("olist_context");
    expect(formatted).toContain("Contexto Olist");

    rmSync(tempRoot, { recursive: true, force: true });
  });
});