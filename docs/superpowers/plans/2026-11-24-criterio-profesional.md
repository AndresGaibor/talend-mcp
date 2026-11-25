# Criterio profesional para el agente: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el agente que usa el MCP conozca el proyecto antes de crear, pregunte por los huecos y reutilice lo existente, con el criterio entregado por el propio MCP.

**Architecture:** Fase 1 añade reglas de criterio y la tarea `disenar-job` al catálogo de `talend_guide` (sin tools nuevas) y un puntero en la skill. Fase 2 añade la tool de solo lectura `talend_project_profile`, que lee las carpetas del proyecto en disco y alimenta el primer paso de `disenar-job`.

**Tech Stack:** Bun, TypeScript, `bun:test`, `node:fs`, zod (como `job-inspect.tool.ts`).

**Spec:** `docs/superpowers/specs/2026-11-24-criterio-profesional-design.md`

## Global Constraints

- Texto en español, sin tildes en código y mensajes de catálogo como el resto de `task-catalog/` (los archivos existentes usan "diseno", "orientacion").
- Bun, no Node. `bun run typecheck` y `bun test` deben pasar antes de cada commit.
- Una sola tool por capacidad, nombre `talend_<area>_<verbo>`; sin aliases.
- Offline: el perfil no puede depender de Studio ni del bridge.
- No se crean joblets a mano. La reutilización de lógica es un job hijo con `tRunJob`; los joblets que ya existan se listan y se usan.
- No hay caché, motor de reglas ni linting.
- Commits solo si el usuario lo pide; terminan con `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Proyecto vacío o con carpetas ausentes (sin `joblets/`, sin `context/`): el perfil no lanza, devuelve listas vacías y huecos.
2. `.gitkeep`, `.properties` y `.screenshot` no cuentan como items; un nombre con guiones bajos (`Carga_Datos_SS_0.1.item`) se separa en `name: "Carga_Datos_SS"`, `version: "0.1"`.
3. Nombres de un solo token (`prueba`) o sin prefijo común: no hay convención y no hay fallo.
4. Muchos items: cada categoría se recorta a `limit` pero `total` es el real.
5. Sin proyecto configurado o con `projectPath` inválido: `errorResult` con código `NO_PROJECT`, no excepción.

---

## Fase 1: ritual y reglas (sin tools nuevas)

### Task 1: Reglas de criterio

**Files:**
- Modify: `src/modules/guide/domain/task-catalog/rules.ts` (añadir al final de `GUIDE_RULES`)
- Test: `tests/tools/agent-guide.test.ts`

**Interfaces:**
- Consumes: `GuideRule` de `src/modules/guide/domain/guide.types.ts` (`{ id, rule, detail, appliesTo? }`).
- Produces: 14 reglas nuevas en `GUIDE_RULES`, todas con `appliesTo: ["disenar-job", "crear-job", "editar-job", "migracion-masiva"]`.

- [ ] **Step 1: Write the failing test** (en `describe("Guia para agentes")`)

```ts
test("las reglas de criterio profesional existen y aplican al diseno de jobs", () => {
  const ids = [
    "inventario-primero", "reutilizar-antes-de-crear", "contexto-de-proyecto",
    "conexion-de-repositorio", "nombres-del-proyecto", "un-job-una-responsabilidad",
    "logica-comun-en-hijo", "control-de-errores", "sin-componentes-huerfanos",
    "esquemas-explicitos", "preguntar-huecos", "contextos-por-entorno",
    "cambios-minimos-en-existentes", "etiquetas-con-sentido",
  ];
  for (const id of ids) {
    const rule = GUIDE_RULES.find((r) => r.id === id);
    expect(rule, `falta la regla ${id}`).toBeDefined();
    expect(rule!.detail.length).toBeGreaterThan(40);
    expect(rule!.appliesTo).toContain("disenar-job");
  }
});
```

Importa `GUIDE_RULES` desde `../../src/modules/guide/domain/task-catalog`.

- [ ] **Step 2: Run** `bun test tests/tools/agent-guide.test.ts -t "criterio profesional"` — Expected: FAIL ("falta la regla inventario-primero").

- [ ] **Step 3: Add the 14 rules to `rules.ts`**, con este `id` y esta `rule` (una frase); el `detail` (2 o 3 frases con el porqué y el caso concreto) lo redacta quien implementa, en el tono de las reglas existentes:

| id | rule |
|---|---|
| `inventario-primero` | Antes de crear o editar, mira que hay en el proyecto (`talend_project_profile`, o las tools de lectura si no esta disponible). |
| `reutilizar-antes-de-crear` | Si ya existe un job, joblet, contexto, conexion o esquema que sirve, usalo o extiendelo; no lo dupliques. |
| `contexto-de-proyecto` | Rutas, hosts, usuarios y credenciales van en variables de contexto, nunca como literales en un componente. |
| `conexion-de-repositorio` | Si el repositorio ya tiene la conexion o el esquema, referencialo (`talend_job_assign_repository_schema`) en vez de repetir su configuracion. |
| `nombres-del-proyecto` | Usa el prefijo, la carpeta y el formato de nombre que ya dominan en el proyecto; no inventes otro. |
| `un-job-una-responsabilidad` | Un job hace una cosa; separa extraer, transformar y cargar cuando la logica crece y orquesta con un padre. |
| `logica-comun-en-hijo` | Lo que se repite en dos o mas jobs va a un job hijo (`tRunJob`) o a un joblet que ya exista; no fabriques joblets a mano. |
| `control-de-errores` | Maneja errores como lo hace el proyecto (triggers `OnSubjobError`/`OnComponentError`, `tDie`, `tLogCatcher`); un job sin ruta de error no esta terminado. |
| `sin-componentes-huerfanos` | Todo componente queda conectado y los `tLogRow` de depuracion no se entregan. |
| `esquemas-explicitos` | Define los esquemas con tipos concretos; evita columnas dinamicas salvo necesidad real. |
| `preguntar-huecos` | Si falta un dato que cambia el resultado y no hay un valor razonable por defecto, pregunta al usuario, de una en una y con la opcion recomendada primero; no inventes rutas, credenciales ni nombres de base de datos. |
| `contextos-por-entorno` | Todos los entornos de un contexto tienen las mismas variables; cambian solo los valores. |
| `cambios-minimos-en-existentes` | Al editar un job existente haz `dryRun`, revisa el diff y no renombres ni reordenes lo que no se pidio. |
| `etiquetas-con-sentido` | Ponle a cada componente una etiqueta que diga que hace (no `tMap_1`) y al job un proposito en su descripcion. |

- [ ] **Step 4: Run** `bun test tests/tools/agent-guide.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit** — `git add tests/tools/agent-guide.test.ts src/modules/guide/domain/task-catalog/rules.ts && git commit -m "feat(guide): reglas de criterio profesional para disenar jobs"`

### Task 2: Tarea `disenar-job`

**Files:**
- Create: `src/modules/guide/domain/task-catalog/design.tasks.ts` (exporta `DESIGN_TASKS: GuideTask[]`)
- Modify: `src/modules/guide/domain/task-catalog/index.ts` (importar y añadir `...DESIGN_TASKS` justo despues de `...ORIENTATION_TASKS`)
- Test: `tests/tools/agent-guide.test.ts`

**Interfaces:**
- Consumes: `GuideTask` de `guide.types.ts`; las tools existentes `talend_jobs_list`, `talend_list_project_contexts`, `talend_job_inspect`, `talend_list_repository_contexts`, `talend_list_repository_connections`, `talend_job_plan`, `talend_job_verify`.
- Produces: tarea con `id: "disenar-job"`, `requires: ["project"]`, `aliases: ["disenar", "diseñar", "antes de crear", "reutilizar", "buenas practicas", "criterio", "convenciones"]`. Pasos en este orden:
  1. `talend_jobs_list` (`{ limit: 50 }`): jobs, carpetas y prefijos existentes.
  2. `talend_list_project_contexts` (`{ projectPath: "C:/ruta/al/proyecto" }`): contextos que ya usan los jobs.
  3. `talend_job_inspect` (optional, `{ job: "NOMBRE_DE_UN_JOB_PARECIDO" }`): copiar la estructura de un job parecido.
  4. `talend_list_repository_contexts` (optional): contextos de proyecto; requiere Studio.
  5. `talend_list_repository_connections` (optional): conexiones compartidas; requiere Studio.
  6. `talend_job_plan` (sin `input`): validar con `dryRun` antes de escribir.
  7. `talend_job_verify` (`{ job: "NOMBRE_DEL_JOB" }`): cerrar con la verificacion.

  `goal`, `whenToUse`, `pitfalls` y `doneWhen` los redacta quien implementa. `pitfalls` debe incluir: "No hagas una bateria de preguntas generica: pregunta solo por huecos del inventario" y "Sin joblets en el proyecto, la logica comun va en un job hijo con tRunJob". `doneWhen`: "Se sabe que se reutiliza, que se crea y que se le ha preguntado al usuario; `talend_job_verify` no devuelve error."

- [ ] **Step 1: Write the failing test**

```ts
test("disenar-job se encuentra por lenguaje natural y empieza por el inventario", async () => {
  process.env.TALEND_MCP_FILTER = "all";
  const tool = createAgentGuideTool({ listTools: getAllRuntimeTools });
  const result = await tool.handler({ mode: "task", task: "quiero diseñar un job reutilizando lo que hay" });
  const structured = result.structuredContent as { ok: boolean; data: { id: string; steps: Array<{ tool: string }> } };

  expect(structured.ok).toBe(true);
  expect(structured.data.id).toBe("disenar-job");
  expect(structured.data.steps[0]?.tool).toBe("talend_jobs_list");
  expect(structured.data.steps.at(-1)?.tool).toBe("talend_job_verify");
});
```

El primer test del archivo ya valida que cada `tool` y cada `input` de los pasos existen y respetan su schema; no hace falta otro.

- [ ] **Step 2: Run** `bun test tests/tools/agent-guide.test.ts -t "disenar-job"` — Expected: FAIL (la busqueda devuelve otra tarea o error).

- [ ] **Step 3: Create `design.tasks.ts` and register it in `index.ts`** segun el bloque Interfaces. Si el matching por lenguaje natural no cae en `disenar-job` con la frase del test, ajusta `aliases` (no el test).

- [ ] **Step 4: Run** `bun test tests/tools/agent-guide.test.ts && bun run typecheck` — Expected: PASS y sin errores.

- [ ] **Step 5: Commit** — `git add src/modules/guide tests/tools/agent-guide.test.ts && git commit -m "feat(guide): tarea disenar-job con inventario, preguntas y reutilizacion"`

### Task 3: Puntero en la skill y catálogo generado

**Files:**
- Modify: `.claude/skills/talend-mcp/SKILL.md` (nueva sección `## Antes de crear` justo antes de `## Estrategia mixta`)
- Modify (generado): `docs/CATALOGO-DE-TOOLS.md`

**Interfaces:**
- Consumes: la tarea `disenar-job` de Task 2.
- Produces: la sección de la skill y el catálogo regenerado.

- [ ] **Step 1: Escribe la sección `## Antes de crear`** (maximo 8 lineas): llamar `talend_guide { mode: "task", task: "disenar-job" }` antes de crear o editar; reutilizar lo que exista; preguntar solo por huecos reales; sin joblets creados a mano (job hijo con `tRunJob`). No copies las reglas: remite a `talend_guide { mode: "rules" }`.
- [ ] **Step 2: Regenera el catalogo** — Run: `bun run docs:tools` — Expected: `docs/CATALOGO-DE-TOOLS.md` incluye `disenar-job`.
- [ ] **Step 3: Verify** — Run: `bun run typecheck && bun test` — Expected: todo en verde. Comprueba tambien que `buildServerInstructions` (en `server-instructions.ts`) lista `disenar-job` en "Tareas:" (sale del catalogo; no hay que tocarlo).
- [ ] **Step 4: Commit** — `git add .claude/skills/talend-mcp/SKILL.md docs/CATALOGO-DE-TOOLS.md && git commit -m "docs(skill): puntero a disenar-job y catalogo regenerado"`

---

## Fase 2: `talend_project_profile`

### Task 4: Inventario del proyecto en disco

**Files:**
- Create: `src/modules/project-profile/application/project-inventory.ts`
- Test: `tests/tools/project-profile.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type InventoryItem = { name: string; version: string; folder: string };
  export type ProjectInventory = {
    jobs: InventoryItem[];
    joblets: InventoryItem[];
    contexts: InventoryItem[];
    routines: InventoryItem[];
    metadata: Record<string, InventoryItem[]>; // clave = subcarpeta de metadata/ (connections, fileDelimited, ...)
  };
  export function readProjectInventory(projectPath: string): ProjectInventory;
  ```
  Lee `process/`, `joblets/`, `context/`, `code/routines/` y cada subcarpeta de `metadata/` de forma recursiva. Un item es un archivo `<Nombre>_<version>.item` (la version es lo que va tras el ultimo `_`); `folder` es la ruta relativa del directorio dentro de la categoria, con `/`. Ignora todo lo que no acabe en `.item`. Una carpeta ausente da lista vacia, no excepcion. En `metadata` omite las subcarpetas sin items.

- [ ] **Step 1: Write the failing tests** — helper del test: `mkdtempSync` en `os.tmpdir()` y una funcion `touch(root, rel)` que crea el archivo con `mkdirSync(..., { recursive: true })`.

```ts
test("lee items de cada categoria e ignora lo que no es .item", () => {
  touch(root, "process/Carga/Carga_Datos_SS_0.1.item");
  touch(root, "process/Carga/Carga_Datos_SS_0.1.properties");
  touch(root, "process/.gitkeep");
  touch(root, "context/Azure/POC_RUNTIME_0.1.item");
  touch(root, "metadata/connections/DB_ORACLE_0.1.item");
  const inv = readProjectInventory(root);
  expect(inv.jobs).toEqual([{ name: "Carga_Datos_SS", version: "0.1", folder: "Carga" }]);
  expect(inv.contexts[0]).toEqual({ name: "POC_RUNTIME", version: "0.1", folder: "Azure" });
  expect(inv.metadata.connections?.[0]?.name).toBe("DB_ORACLE");
  expect(inv.joblets).toEqual([]);
});

test("un proyecto sin carpetas opcionales no falla", () => {
  mkdirSync(join(root, "process"), { recursive: true });
  const inv = readProjectInventory(root);
  expect(inv).toEqual({ jobs: [], joblets: [], contexts: [], routines: [], metadata: {} });
});
```

- [ ] **Step 2: Run** `bun test tests/tools/project-profile.test.ts` — Expected: FAIL (modulo inexistente).
- [ ] **Step 3: Implement `readProjectInventory`** con `readdirSync(dir, { recursive: true, withFileTypes: true })` de `node:fs`; normaliza `\` a `/`.
- [ ] **Step 4: Run** `bun test tests/tools/project-profile.test.ts` — Expected: PASS.
- [ ] **Step 5: Commit** — `git add src/modules/project-profile tests/tools/project-profile.test.ts && git commit -m "feat(project-profile): inventario del proyecto en disco"`

### Task 5: Convenciones, huecos y candidatos de reutilizacion

**Files:**
- Create: `src/modules/project-profile/application/project-analysis.ts`
- Test: `tests/tools/project-profile.test.ts`

**Interfaces:**
- Consumes: `ProjectInventory`, `InventoryItem` de Task 4.
- Produces:
  ```ts
  export type NamingConvention = { category: string; prefix: string; count: number; total: number };
  export function detectConventions(inventory: ProjectInventory): NamingConvention[];
  export function findGaps(inventory: ProjectInventory): string[];
  export function findReuseCandidates(inventory: ProjectInventory, purpose: string): Array<{ category: string; name: string; folder: string }>;
  ```
  - `detectConventions`: por categoria (`jobs`, `joblets`, `contexts`), el prefijo es el texto antes del primer `_`. Hay convencion si el prefijo lo comparten al menos 3 items y al menos el 50 % de la categoria (umbral `MIN_COUNT = 3`, `MIN_SHARE = 0.5`, constantes exportadas). Devuelve como maximo una por categoria, la mas frecuente.
  - `findGaps`: una frase por cada: `contexts` vacio ("No hay contextos de proyecto: pregunta que variables y entornos usar."), `metadata.connections` ausente o vacio ("No hay conexiones de base de datos en el repositorio: pregunta a que base de datos conectar."), `jobs` vacio ("El proyecto no tiene jobs: no hay convenciones que deducir; pregunta como nombrarlos."), `joblets` vacio ("No hay joblets: la logica comun va en un job hijo con tRunJob.").
  - `findReuseCandidates`: separa `purpose` en palabras de 3 o mas letras, en minusculas y sin tildes, y devuelve los items de `jobs`, `joblets`, `contexts` y `metadata.*` cuyo nombre contiene alguna. Orden estable por categoria y nombre; maximo 10.

- [ ] **Step 1: Write the failing tests**

```ts
test("detecta el prefijo dominante y no inventa convenciones", () => {
  const item = (name: string) => ({ name, version: "0.1", folder: "" });
  const inv = { jobs: ["EP_a", "EP_b", "EP_c", "x_d"].map(item), joblets: [], contexts: [], routines: [], metadata: {} };
  expect(detectConventions(inv)).toEqual([{ category: "jobs", prefix: "EP", count: 3, total: 4 }]);

  const sin = { ...inv, jobs: ["prueba", "otro", "mas"].map(item) };
  expect(detectConventions(sin)).toEqual([]);
});

test("un proyecto vacio devuelve todos los huecos", () => {
  const vacio = { jobs: [], joblets: [], contexts: [], routines: [], metadata: {} };
  expect(findGaps(vacio)).toHaveLength(4);
});

test("encuentra candidatos de reutilizacion por palabras del proposito", () => {
  const item = (name: string) => ({ name, version: "0.1", folder: "f" });
  const inv = { jobs: [item("Carga_Clientes"), item("Otro")], joblets: [], contexts: [item("CTX_clientes")], routines: [], metadata: {} };
  expect(findReuseCandidates(inv, "cargar Clientes a la base").map((c) => c.name)).toEqual(["Carga_Clientes", "CTX_clientes"]);
});
```

La ultima aserción exige que "cargar" y "carga" casen: busca por la raiz de 4 letras (`carg`) ademas de por la palabra completa; documenta la regla en un comentario de una linea (`shortcut: raiz de 4 letras, cambiar a stemming si hay falsos positivos`).

- [ ] **Step 2: Run** `bun test tests/tools/project-profile.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** las tres funciones segun el bloque Interfaces.
- [ ] **Step 4: Run** `bun test tests/tools/project-profile.test.ts` — Expected: PASS.
- [ ] **Step 5: Commit** — `git add src/modules/project-profile tests/tools/project-profile.test.ts && git commit -m "feat(project-profile): convenciones, huecos y candidatos de reutilizacion"`

### Task 6: La tool `talend_project_profile`

**Files:**
- Create: `src/modules/project-profile/tools/project-profile.tool.ts` (exporta `createProjectProfileTool()`)
- Modify: `src/server/registered-tools/module-tools.ts` (importar y añadir `createProjectProfileTool(),` junto a `createJobInspectTool(),` ~linea 114)
- Modify: `src/server/registered-tools/preset-sets.ts` (`"talend_project_profile"` en `PRESET_AGENT`, tras `"talend_jobs_list"`)
- Modify: `src/presentation/server/tool-safety.ts` (entrada en el mapa de hints, `readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false`, y `talend_project_profile: "read"` en `CANONICAL_RISKS`)
- Modify: `src/modules/guide/domain/task-catalog/design.tasks.ts` (nuevo primer paso)
- Test: `tests/tools/project-profile.test.ts`, `tests/tools/agent-guide.test.ts`

**Interfaces:**
- Consumes: `readProjectInventory`, `detectConventions`, `findGaps`, `findReuseCandidates`; `resolveProjectPath(candidate?: string): string` de `src/modules/jobs/adapters/talend-job/project-path.ts` (lanza si no hay proyecto); `okResult`/`errorResult` de `src/presentation/tools/common/result`.
- Produces: tool `talend_project_profile`, entrada `{ projectPath?: string; limit?: number (defecto 25); purpose?: string }`. `purpose` es el unico campo añadido respecto al spec y alimenta `reuseCandidates`. Salida de `data`:
  ```ts
  {
    projectPath: string;
    inventory: Record<string, { total: number; items: InventoryItem[] }>; // jobs, joblets, contexts, routines y una entrada por tipo de metadata ("metadata/connections", ...)
    conventions: NamingConvention[];
    gaps: string[];
    reuseCandidates: Array<{ category: string; name: string; folder: string }>; // [] sin purpose
  }
  ```
  Cada `items` se recorta a `limit` y `total` es el real. Sin proyecto: `errorResult("project-profile", "NO_PROJECT", ...)`.

- [ ] **Step 1: Write the failing tests**

```ts
test("la tool devuelve inventario recortado con el total real y los huecos", async () => {
  for (let i = 0; i < 5; i++) touch(root, `process/EP_job${i}_0.1.item`);
  const tool = createProjectProfileTool();
  const res = await tool.handler({ projectPath: root, limit: 2, purpose: "job" });
  const data = (res.structuredContent as any).data;
  expect(data.inventory.jobs.total).toBe(5);
  expect(data.inventory.jobs.items).toHaveLength(2);
  expect(data.conventions[0].prefix).toBe("EP");
  expect(data.gaps.length).toBeGreaterThan(0);
  expect(data.reuseCandidates.length).toBeGreaterThan(0);
});

test("sin proyecto responde NO_PROJECT y no lanza", async () => {
  const saved = process.env.TALEND_PROJECT; delete process.env.TALEND_PROJECT;
  const res = await createProjectProfileTool().handler({});
  expect((res.structuredContent as any).errors?.[0]?.code ?? (res.structuredContent as any).error?.code).toBe("NO_PROJECT");
  if (saved !== undefined) process.env.TALEND_PROJECT = saved;
});
```

(Ajusta el acceso a `errors`/`error` a la forma real de `errorResult` en `src/shared/contracts/result.contract.ts`. Si el entorno de test resuelve un proyecto por otro medio que `TALEND_PROJECT`, fuerza la ausencia como lo hacen los tests de `job-inspect`.)

En `agent-guide.test.ts`: el test de `disenar-job` de Task 2 cambia a `expect(steps[0]?.tool).toBe("talend_project_profile")`, y se añade en `tests/tools/tool-presets.test.ts` la comprobacion de que `PRESET_AGENT` contiene `talend_project_profile` (sigue el patron del archivo).

- [ ] **Step 2: Run** `bun test tests/tools` — Expected: FAIL (tool inexistente).
- [ ] **Step 3: Implement** la tool con schema zod como `job-inspect.tool.ts`, componiendo las funciones de Tasks 4 y 5; registra y clasifica segun la lista de Files. En `design.tasks.ts` inserta como paso 1 `talend_project_profile` (`{ limit: 25 }`) y deja `talend_jobs_list` como `optional: true`.
- [ ] **Step 4: Run** `bun run typecheck && bun test` — Expected: todo en verde (incluidos `tool-contracts`, `tool-conformance`, `output-schema-conformance`; si alguno exige declarar el schema de salida, siguelo como `talend_job_inspect`).
- [ ] **Step 5: Regenera el catalogo y comprueba contra el proyecto de ejemplo** — Run: `bun run docs:tools`; luego `bun run cli tools call talend_project_profile --input '{"projectPath":"workspace/talendbancolombia-963626413/PRJ_BANCOLOMBIA"}'` — Expected: JSON con `inventory.jobs.total` mayor que 0 y una lista `gaps`. (`workspace/` esta ignorado por git; es solo para la comprobacion manual.)
- [ ] **Step 6: Commit** — `git add src docs/CATALOGO-DE-TOOLS.md tests && git commit -m "feat(project-profile): talend_project_profile, primer paso de disenar-job"`

### Task 7: Documentar y cerrar

**Files:**
- Modify: `.claude/skills/talend-mcp/SKILL.md` (añadir `talend_project_profile` a la tabla de tools canonicas y una linea en `## Antes de crear`)
- Modify: `AGENTS.md` o `docs/GUIA-AGENTE.md` solo si ya enumeran las tools del preset `agent` (busca `talend_jobs_list` y actualiza donde aparezca la lista)

- [ ] **Step 1: Actualiza la skill** (la fila de la tabla: entrada `{ projectPath?, limit?, purpose? }`, "Inventario, convenciones y huecos del proyecto, sin Studio").
- [ ] **Step 2: Verify** — Run: `bun run typecheck && bun test` — Expected: verde. Si existe `bun run verify:directo`, no lo lances: ejecuta Studio.
- [ ] **Step 3: Commit** — `git add .claude AGENTS.md docs && git commit -m "docs: talend_project_profile en la skill y la guia"`
