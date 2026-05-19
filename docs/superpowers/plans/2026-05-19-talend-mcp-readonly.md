# Talend MCP Readonly Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Bun/TypeScript MCP server that reads Qlik Talend Studio projects, detects the open job automatically, parses job structure, and summarizes recent run logs without modifying Talend files.

**Architecture:** Keep the server read-only and split parsing into focused modules: workspace discovery, open-job discovery, repository/job parsing, context parsing, run-log parsing, and MCP tool registration. The MCP entrypoint only wires tools to these modules; business logic stays testable without MCP transport.

**Tech Stack:** Bun, TypeScript, `@modelcontextprotocol/server`, `zod`, `fast-xml-parser`, `bun:test`.

---

## File Structure

- Create: `src/talend/types.ts` — shared result types for jobs, components, schemas, contexts, launches, logs, and tool outputs.
- Create: `src/talend/xml.ts` — XML parser wrapper using `fast-xml-parser` with attributes preserved.
- Create: `src/talend/files.ts` — read-only path helpers, safe file reads, recursive listing, path containment checks.
- Create: `src/talend/workspace.ts` — detects workspace/project paths from `TALEND_PROJECT` or known Talend workspace metadata.
- Create: `src/talend/open-job.ts` — parses Eclipse workbench XMI to detect open Talend editors.
- Create: `src/talend/repository.ts` — lists jobs from `process/**/*.properties` and resolves matching `.item` files.
- Create: `src/talend/job-parser.ts` — parses `.item` XML into components, connections, schemas, mapper entries, and contexts.
- Create: `src/talend/run-logs.ts` — parses `.launch` and `.metadata/.log`, extracts latest command line and errors.
- Create: `src/talend/analysis.ts` — detects empty/null columns and analyzes `tDBOutput`/`tMysqlOutput`.
- Create: `src/server.ts` — registers MCP tools and connects stdio transport.
- Modify: `index.ts` — imports and runs `src/server.ts`.
- Modify: `package.json` — adds dependencies and scripts.
- Create: `tests/fixtures/talend/...` — minimized XML/log fixtures based on observed local Talend structure.
- Create: `tests/talend/*.test.ts` — unit tests for each parser/module.

Note: no commit steps are included because project instructions prohibit commits unless explicitly requested by the user.

---

### Task 1: Dependencies And Test Harness

**Files:**
- Modify: `package.json`
- Create: `tests/fixtures/talend/.keep`

- [ ] **Step 1: Install runtime dependencies**

Run:

```bash
bun add @modelcontextprotocol/server zod fast-xml-parser
```

Expected: `package.json` contains dependencies for `@modelcontextprotocol/server`, `zod`, and `fast-xml-parser`; `bun.lock` is updated.

- [ ] **Step 2: Add project scripts**

Modify `package.json` to this shape while preserving actual dependency versions installed by Bun:

```json
{
  "name": "talend-mcp",
  "module": "index.ts",
  "type": "module",
  "private": true,
  "scripts": {
    "start": "bun run index.ts",
    "test": "bun test",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@modelcontextprotocol/server": "<installed>",
    "fast-xml-parser": "<installed>",
    "zod": "<installed>"
  },
  "devDependencies": {
    "@types/bun": "latest"
  },
  "peerDependencies": {
    "typescript": "^5"
  }
}
```

Replace each `"<installed>"` with the exact versions already written by `bun add`.

- [ ] **Step 3: Create fixture directory marker**

Create `tests/fixtures/talend/.keep` as an empty file.

- [ ] **Step 4: Verify test harness**

Run:

```bash
bun test
```

Expected: Bun reports no tests found or all current tests passing. This is acceptable before adding tests.

- [ ] **Step 5: Verify TypeScript config still loads**

Run:

```bash
bun run typecheck
```

Expected: pass, or only existing project errors unrelated to new files. If `tsc` is unavailable, run `bun add -d typescript` and repeat.

---

### Task 2: Read-Only XML And File Utilities

**Files:**
- Create: `src/talend/xml.ts`
- Create: `src/talend/files.ts`
- Create: `tests/talend/xml.test.ts`
- Create: `tests/talend/files.test.ts`

- [ ] **Step 1: Write XML parser tests**

Create `tests/talend/xml.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { parseXml } from "../../src/talend/xml";

describe("parseXml", () => {
  test("preserva atributos XML con prefijo @", () => {
    const xml = `<root><node componentName="tMap"><elementParameter name="UNIQUE_NAME" value="tMap_1"/></node></root>`;

    const parsed = parseXml(xml) as {
      root: {
        node: {
          "@_componentName": string;
          elementParameter: { "@_name": string; "@_value": string };
        };
      };
    };

    expect(parsed.root.node["@_componentName"]).toBe("tMap");
    expect(parsed.root.node.elementParameter["@_name"]).toBe("UNIQUE_NAME");
    expect(parsed.root.node.elementParameter["@_value"]).toBe("tMap_1");
  });
});
```

- [ ] **Step 2: Run XML test to verify failure**

Run:

```bash
bun test tests/talend/xml.test.ts
```

Expected: fail because `src/talend/xml.ts` does not exist.

- [ ] **Step 3: Implement XML parser wrapper**

Create `src/talend/xml.ts`:

```ts
import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  allowBooleanAttributes: true,
  parseAttributeValue: false,
  trimValues: false,
});

export function parseXml(xml: string): unknown {
  return parser.parse(xml);
}

export function asArray<T>(valor: T | T[] | undefined | null): T[] {
  if (valor === undefined || valor === null) return [];
  return Array.isArray(valor) ? valor : [valor];
}
```

- [ ] **Step 4: Write file utility tests**

Create `tests/talend/files.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { isPathInside, normalizePath } from "../../src/talend/files";

describe("files", () => {
  test("normaliza rutas", () => {
    expect(normalizePath("/tmp/example/../example/file.txt")).toBe("/tmp/example/file.txt");
  });

  test("detecta rutas contenidas", () => {
    expect(isPathInside("/tmp/workspace/project/file.item", "/tmp/workspace")).toBe(true);
    expect(isPathInside("/tmp/other/file.item", "/tmp/workspace")).toBe(false);
  });
});
```

- [ ] **Step 5: Run file tests to verify failure**

Run:

```bash
bun test tests/talend/files.test.ts
```

Expected: fail because `src/talend/files.ts` does not exist.

- [ ] **Step 6: Implement read-only file helpers**

Create `src/talend/files.ts`:

```ts
import { readdir } from "node:fs/promises";
import { isAbsolute, join, normalize, relative, resolve } from "node:path";

export function normalizePath(ruta: string): string {
  return normalize(ruta);
}

export function isPathInside(rutaObjetivo: string, rutaBase: string): boolean {
  const objetivo = resolve(rutaObjetivo);
  const base = resolve(rutaBase);
  const relativo = relative(base, objetivo);
  return relativo === "" || (!relativo.startsWith("..") && !isAbsolute(relativo));
}

export async function readTextFile(rutaArchivo: string, rutaBasePermitida?: string): Promise<string> {
  if (rutaBasePermitida && !isPathInside(rutaArchivo, rutaBasePermitida)) {
    throw new Error(`Ruta fuera del workspace permitido: ${rutaArchivo}`);
  }

  return await Bun.file(rutaArchivo).text();
}

export async function listFilesRecursive(rutaDirectorio: string, filtro: (ruta: string) => boolean): Promise<string[]> {
  const resultados: string[] = [];
  const entradas = await readdir(rutaDirectorio, { withFileTypes: true });

  for (const entrada of entradas) {
    const rutaEntrada = join(rutaDirectorio, entrada.name);
    if (entrada.isDirectory()) {
      resultados.push(...await listFilesRecursive(rutaEntrada, filtro));
      continue;
    }

    if (entrada.isFile() && filtro(rutaEntrada)) {
      resultados.push(rutaEntrada);
    }
  }

  return resultados.sort();
}
```

- [ ] **Step 7: Verify utility tests pass**

Run:

```bash
bun test tests/talend/xml.test.ts tests/talend/files.test.ts
```

Expected: all tests pass.

---

### Task 3: Workspace, Open Job, And Launch Detection

**Files:**
- Create: `src/talend/types.ts`
- Create: `src/talend/workspace.ts`
- Create: `src/talend/open-job.ts`
- Create: `tests/fixtures/talend/workbench.xmi`
- Create: `tests/fixtures/talend/lab04_olist_orders_to_staging 0.1.launch`
- Create: `tests/talend/open-job.test.ts`

- [ ] **Step 1: Create shared types**

Create `src/talend/types.ts`:

```ts
export type TalendWorkspace = {
  workspacePath: string;
  projectPath: string;
  projectName: string;
  metadataPath: string;
};

export type OpenJob = {
  projectName?: string;
  jobName: string;
  version: string;
  label: string;
  workbenchPath: string;
  itemPath?: string;
  selected: boolean;
};

export type LaunchConfig = {
  currentProjectName?: string;
  jobProjectTechLabel?: string;
  jobId?: string;
  jobName?: string;
  jobVersion?: string;
  path: string;
};
```

- [ ] **Step 2: Create workbench fixture**

Create `tests/fixtures/talend/workbench.xmi`:

```xml
<?xml version="1.0" encoding="ASCII"?>
<application:Application selectedElement="window">
  <children selectedElement="stack">
    <sharedElements selectedElement="part-open">
      <children>
        <children xmi:id="part-open" label="Job lab04_olist_orders_to_staging 0.1">
          <persistedState key="memento" value="&lt;editor id=&quot;org.talend.designer.core.ui.MultiPageTalendEditor&quot; name=&quot;lab04_olist_orders_to_staging&quot; partName=&quot;Job lab04_olist_orders_to_staging 0.1&quot;&gt;&lt;input path=&quot;/PRJ_GENIUS_LAB/temp/tmpPROCESS_DzivYFL-EfGooKJ9qOgNNQ&quot;/&gt;&lt;/editor&gt;"/>
          <tags>Editor</tags>
        </children>
      </children>
    </sharedElements>
  </children>
</application:Application>
```

- [ ] **Step 3: Create launch fixture**

Create `tests/fixtures/talend/lab04_olist_orders_to_staging 0.1.launch`:

```xml
<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<launchConfiguration type="org.talend.designer.runprocess.jobLaunchConfiguration">
  <stringAttribute key="CURRENT_PROJECT_NAME" value="PRJ_GENIUS_LAB"/>
  <stringAttribute key="JOB_PROJECT_TECH_LABEL" value="PRJ_GENIUS_LAB"/>
  <stringAttribute key="TALEND_JOB_ID" value="_DzivYFL-EfGooKJ9qOgNNQ"/>
  <stringAttribute key="TALEND_JOB_NAME" value="lab04_olist_orders_to_staging"/>
  <stringAttribute key="TALEND_JOB_VERSION" value="0.1"/>
</launchConfiguration>
```

- [ ] **Step 4: Write open-job tests**

Create `tests/talend/open-job.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { readTextFile } from "../../src/talend/files";
import { parseLaunchConfig, parseOpenJobsFromWorkbench } from "../../src/talend/open-job";

describe("open job detection", () => {
  test("detecta job abierto desde workbench XMI", async () => {
    const xml = await readTextFile("tests/fixtures/talend/workbench.xmi");
    const jobs = parseOpenJobsFromWorkbench(xml, "tests/fixtures/talend/workbench.xmi");

    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.jobName).toBe("lab04_olist_orders_to_staging");
    expect(jobs[0]?.version).toBe("0.1");
    expect(jobs[0]?.label).toBe("Job lab04_olist_orders_to_staging 0.1");
  });

  test("parsea launch config de Talend", async () => {
    const xml = await readTextFile("tests/fixtures/talend/lab04_olist_orders_to_staging 0.1.launch");
    const launch = parseLaunchConfig(xml, "tests/fixtures/talend/lab04_olist_orders_to_staging 0.1.launch");

    expect(launch.currentProjectName).toBe("PRJ_GENIUS_LAB");
    expect(launch.jobName).toBe("lab04_olist_orders_to_staging");
    expect(launch.jobVersion).toBe("0.1");
    expect(launch.jobId).toBe("_DzivYFL-EfGooKJ9qOgNNQ");
  });
});
```

- [ ] **Step 5: Run open-job tests to verify failure**

Run:

```bash
bun test tests/talend/open-job.test.ts
```

Expected: fail because `src/talend/open-job.ts` does not exist.

- [ ] **Step 6: Implement open-job parser**

Create `src/talend/open-job.ts`:

```ts
import { basename } from "node:path";
import { asArray, parseXml } from "./xml";
import type { LaunchConfig, OpenJob } from "./types";

type XmlNode = Record<string, unknown>;

function walk(valor: unknown, visitar: (nodo: XmlNode) => void): void {
  if (Array.isArray(valor)) {
    for (const item of valor) walk(item, visitar);
    return;
  }

  if (!valor || typeof valor !== "object") return;
  const nodo = valor as XmlNode;
  visitar(nodo);

  for (const hijo of Object.values(nodo)) {
    walk(hijo, visitar);
  }
}

export function parseOpenJobsFromWorkbench(xml: string, workbenchPath: string): OpenJob[] {
  const parsed = parseXml(xml);
  const jobs: OpenJob[] = [];

  walk(parsed, (nodo) => {
    const label = typeof nodo["@_label"] === "string" ? nodo["@_label"] : undefined;
    if (!label?.startsWith("Job ")) return;

    const match = /^Job\s+(.+)\s+(\d+(?:\.\d+)*)$/.exec(label);
    if (!match) return;

    jobs.push({
      jobName: match[1] ?? "",
      version: match[2] ?? "",
      label,
      workbenchPath,
      selected: true,
    });
  });

  return jobs;
}

export function parseLaunchConfig(xml: string, path: string): LaunchConfig {
  const parsed = parseXml(xml) as {
    launchConfiguration?: { stringAttribute?: Array<Record<string, string>> | Record<string, string> };
  };
  const atributos = asArray(parsed.launchConfiguration?.stringAttribute);
  const valores = new Map<string, string>();

  for (const atributo of atributos) {
    const key = atributo["@_key"];
    const value = atributo["@_value"];
    if (typeof key === "string" && typeof value === "string") valores.set(key, value);
  }

  return {
    currentProjectName: valores.get("CURRENT_PROJECT_NAME"),
    jobProjectTechLabel: valores.get("JOB_PROJECT_TECH_LABEL"),
    jobId: valores.get("TALEND_JOB_ID"),
    jobName: valores.get("TALEND_JOB_NAME") ?? basename(path).replace(/\s+\d+(?:\.\d+)*\.launch$/, ""),
    jobVersion: valores.get("TALEND_JOB_VERSION"),
    path,
  };
}
```

- [ ] **Step 7: Implement workspace resolver**

Create `src/talend/workspace.ts`:

```ts
import { dirname, join } from "node:path";
import type { TalendWorkspace } from "./types";

export function resolveWorkspaceFromProject(projectPath: string): TalendWorkspace {
  const projectName = projectPath.split("/").filter(Boolean).at(-1) ?? "";
  const workspacePath = dirname(dirname(projectPath));
  return {
    workspacePath,
    projectPath,
    projectName,
    metadataPath: join(workspacePath, ".metadata"),
  };
}

export function getConfiguredProjectPath(env: Record<string, string | undefined> = process.env): string | undefined {
  return env.TALEND_PROJECT;
}
```

- [ ] **Step 8: Verify tests pass**

Run:

```bash
bun test tests/talend/open-job.test.ts
```

Expected: all tests pass.

---

### Task 4: Repository And Job `.item` Parsing

**Files:**
- Modify: `src/talend/types.ts`
- Create: `src/talend/repository.ts`
- Create: `src/talend/job-parser.ts`
- Create: `tests/fixtures/talend/lab04_olist_orders_to_staging_0.1.properties`
- Create: `tests/fixtures/talend/lab04_olist_orders_to_staging_0.1.item`
- Create: `tests/talend/job-parser.test.ts`

- [ ] **Step 1: Extend shared types**

Append to `src/talend/types.ts`:

```ts
export type TalendColumn = {
  name: string;
  type?: string;
  length?: number;
  precision?: number;
  nullable?: boolean;
  key?: boolean;
  sourceType?: string;
  pattern?: string;
};

export type TalendSchema = {
  connector?: string;
  name?: string;
  label?: string;
  columns: TalendColumn[];
};

export type TalendComponent = {
  uniqueName: string;
  componentName: string;
  label?: string;
  parameters: Record<string, string>;
  schemas: TalendSchema[];
};

export type TalendConnection = {
  connectorName?: string;
  label?: string;
  metaname?: string;
  source: string;
  target: string;
  uniqueName?: string;
};

export type TalendContextParameter = {
  name: string;
  type?: string;
  value?: string;
  prompt?: string;
};

export type MapperEntry = {
  table: string;
  name: string;
  expression?: string;
  type?: string;
  nullable?: boolean;
};

export type ParsedJob = {
  itemPath: string;
  components: TalendComponent[];
  connections: TalendConnection[];
  contexts: TalendContextParameter[];
  mapperEntries: MapperEntry[];
};

export type TalendJobResource = {
  label: string;
  version: string;
  purpose?: string;
  description?: string;
  itemPath: string;
  propertiesPath: string;
};
```

- [ ] **Step 2: Create minimized `.item` fixture**

Create `tests/fixtures/talend/lab04_olist_orders_to_staging_0.1.item` with this exact content:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<talendfile:ProcessType defaultContext="Default" jobType="Standard">
  <context name="Default">
    <contextParameter name="DB_HOST" type="id_String" value="209.50.254.159"/>
    <contextParameter name="FILE_OLIST_ORDERS" type="id_String" value="/Users/andresgaibor/geniuslab/Fuentes/orders.csv"/>
  </context>
  <node componentName="tFileInputDelimited" posX="80" posY="160">
    <elementParameter field="TEXT" name="UNIQUE_NAME" value="tFileInputDelimited_1"/>
    <elementParameter field="FILE" name="FILENAME" value="context.FILE_OLIST_ORDERS"/>
    <elementParameter field="TEXT" name="LABEL" value="orders"/>
    <metadata connector="FLOW" label="metadata" name="tFileInputDelimited_1">
      <column key="true" length="40" name="order_id" nullable="true" type="id_String"/>
      <column key="false" length="40" name="customer_id" nullable="true" type="id_String"/>
    </metadata>
  </node>
  <node componentName="tMap">
    <elementParameter field="TEXT" name="UNIQUE_NAME" value="tMap_1"/>
    <metadata connector="FLOW" name="out1">
      <column key="true" length="40" name="order_id" nullable="true" type="id_String"/>
      <column key="false" length="60" name="load_source" nullable="false" type="id_String"/>
    </metadata>
    <nodeData>
      <outputTables name="out1">
        <mapperTableEntries name="order_id" expression="row1.order_id " type="id_String" nullable="true"/>
        <mapperTableEntries name="load_source" expression="&quot;lab04_olist_orders_to_staging&quot; " type="id_String"/>
      </outputTables>
    </nodeData>
  </node>
  <node componentName="tMysqlOutput">
    <elementParameter field="TEXT" name="UNIQUE_NAME" value="tDBOutput_1"/>
    <elementParameter field="TEXT" name="HOST" value="context.DB_HOST"/>
    <elementParameter field="DBTABLE" name="TABLE" value="&quot;stg_olist_orders_ag&quot;"/>
    <elementParameter field="CLOSED_LIST" name="TABLE_ACTION" value="TRUNCATE"/>
    <elementParameter field="CLOSED_LIST" name="DATA_ACTION" value="INSERT"/>
    <metadata connector="FLOW" name="tDBOutput_1">
      <column key="true" length="40" name="order_id" nullable="true" sourceType="VARCHAR" type="id_String"/>
      <column key="false" length="60" name="load_source" nullable="false" sourceType="VARCHAR" type="id_String"/>
    </metadata>
  </node>
  <connection connectorName="FLOW" label="row1" metaname="tFileInputDelimited_1" source="tFileInputDelimited_1" target="tMap_1">
    <elementParameter name="UNIQUE_NAME" value="row1"/>
  </connection>
  <connection connectorName="FLOW" label="out1" metaname="out1" source="tMap_1" target="tDBOutput_1">
    <elementParameter name="UNIQUE_NAME" value="out1"/>
  </connection>
</talendfile:ProcessType>
```

- [ ] **Step 3: Create minimized `.properties` fixture**

Create `tests/fixtures/talend/lab04_olist_orders_to_staging_0.1.properties`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<xmi:XMI>
  <TalendProperties:Property label="lab04_olist_orders_to_staging" purpose="Carga inicial" description="Lee orders.csv" version="0.1" displayName="lab04_olist_orders_to_staging"/>
  <TalendProperties:ItemState path="bloque2_talend_base"/>
  <TalendProperties:ProcessItem>
    <process href="lab04_olist_orders_to_staging_0.1.item#/"/>
  </TalendProperties:ProcessItem>
</xmi:XMI>
```

- [ ] **Step 4: Write parser tests**

Create `tests/talend/job-parser.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { readTextFile } from "../../src/talend/files";
import { parseJobItem } from "../../src/talend/job-parser";
import { parseJobProperties } from "../../src/talend/repository";

describe("Talend job parser", () => {
  test("extrae componentes, conexiones, schemas, contexts y mapper entries", async () => {
    const xml = await readTextFile("tests/fixtures/talend/lab04_olist_orders_to_staging_0.1.item");
    const job = parseJobItem(xml, "tests/fixtures/talend/lab04_olist_orders_to_staging_0.1.item");

    expect(job.components.map((component) => component.uniqueName)).toEqual([
      "tFileInputDelimited_1",
      "tMap_1",
      "tDBOutput_1",
    ]);
    expect(job.connections.map((connection) => `${connection.source}->${connection.target}`)).toEqual([
      "tFileInputDelimited_1->tMap_1",
      "tMap_1->tDBOutput_1",
    ]);
    expect(job.contexts.find((contexto) => contexto.name === "FILE_OLIST_ORDERS")?.value).toContain("orders.csv");
    expect(job.mapperEntries.find((entry) => entry.name === "load_source")?.expression).toContain("lab04_olist_orders_to_staging");
  });

  test("parsea properties y resuelve item", async () => {
    const xml = await readTextFile("tests/fixtures/talend/lab04_olist_orders_to_staging_0.1.properties");
    const resource = parseJobProperties(xml, "tests/fixtures/talend/lab04_olist_orders_to_staging_0.1.properties");

    expect(resource.label).toBe("lab04_olist_orders_to_staging");
    expect(resource.version).toBe("0.1");
    expect(resource.itemPath.endsWith("lab04_olist_orders_to_staging_0.1.item")).toBe(true);
  });
});
```

- [ ] **Step 5: Run parser tests to verify failure**

Run:

```bash
bun test tests/talend/job-parser.test.ts
```

Expected: fail because parser modules do not exist.

- [ ] **Step 6: Implement `repository.ts`**

Create `src/talend/repository.ts`:

```ts
import { dirname, join } from "node:path";
import { listFilesRecursive, readTextFile } from "./files";
import { asArray, parseXml } from "./xml";
import type { TalendJobResource } from "./types";

export function parseJobProperties(xml: string, propertiesPath: string): TalendJobResource {
  const parsed = parseXml(xml) as Record<string, unknown>;
  const root = parsed["xmi:XMI"] as Record<string, unknown> | undefined;
  const property = root?.["TalendProperties:Property"] as Record<string, string> | undefined;
  const processItem = root?.["TalendProperties:ProcessItem"] as Record<string, unknown> | undefined;
  const process = processItem?.process as Record<string, string> | undefined;
  const href = process?.["@_href"] ?? "";
  const itemFile = href.split("#")[0] ?? "";

  return {
    label: property?.["@_label"] ?? "",
    version: property?.["@_version"] ?? "",
    purpose: property?.["@_purpose"],
    description: property?.["@_description"],
    itemPath: join(dirname(propertiesPath), itemFile),
    propertiesPath,
  };
}

export async function listJobs(projectPath: string): Promise<TalendJobResource[]> {
  const processPath = join(projectPath, "process");
  const propertiesFiles = await listFilesRecursive(processPath, (ruta) => ruta.endsWith(".properties"));
  const jobs: TalendJobResource[] = [];

  for (const propertiesPath of propertiesFiles) {
    const xml = await readTextFile(propertiesPath, projectPath);
    const job = parseJobProperties(xml, propertiesPath);
    if (job.label && job.itemPath.endsWith(".item")) jobs.push(job);
  }

  return jobs;
}
```

- [ ] **Step 7: Implement `job-parser.ts`**

Create `src/talend/job-parser.ts` using helper functions that read `@_` attributes, convert repeated nodes with `asArray`, and map Talend XML to the types from Task 4. The final exported function must be:

```ts
export function parseJobItem(xml: string, itemPath: string): ParsedJob
```

The implementation must:

- Read root `talendfile:ProcessType`.
- Extract `context.contextParameter` into `contexts`.
- Extract every `node` into `components`.
- For each node, build `parameters` from `elementParameter` by `@_name` and `@_value`.
- Set `uniqueName` from `parameters.UNIQUE_NAME`.
- Set `label` from `parameters.LABEL`.
- Extract `metadata.column` into schemas.
- Extract `connection` into `connections`.
- Walk `nodeData.outputTables.mapperTableEntries`, `inputTables.mapperTableEntries`, and `varTables.mapperTableEntries` into `mapperEntries`.

Use this complete implementation skeleton and fill no extra behaviors beyond it:

```ts
import { asArray, parseXml } from "./xml";
import type { MapperEntry, ParsedJob, TalendColumn, TalendComponent, TalendConnection, TalendContextParameter, TalendSchema } from "./types";

type XmlRecord = Record<string, unknown>;

function attr(nodo: XmlRecord | undefined, nombre: string): string | undefined {
  const valor = nodo?.[`@_${nombre}`];
  return typeof valor === "string" ? valor : undefined;
}

function boolAttr(nodo: XmlRecord, nombre: string): boolean | undefined {
  const valor = attr(nodo, nombre);
  if (valor === undefined) return undefined;
  return valor === "true";
}

function numberAttr(nodo: XmlRecord, nombre: string): number | undefined {
  const valor = attr(nodo, nombre);
  if (valor === undefined || valor === "") return undefined;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : undefined;
}

function cleanQuoted(valor: string | undefined): string | undefined {
  if (!valor) return valor;
  return valor.replace(/^&quot;/, "").replace(/&quot;$/, "").replace(/^"/, "").replace(/"$/, "");
}

function parseParameters(node: XmlRecord): Record<string, string> {
  const parametros: Record<string, string> = {};
  for (const parametro of asArray(node.elementParameter as XmlRecord | XmlRecord[] | undefined)) {
    const name = attr(parametro, "name");
    const value = attr(parametro, "value");
    if (name && value !== undefined) parametros[name] = cleanQuoted(value) ?? value;
  }
  return parametros;
}

function parseColumn(column: XmlRecord): TalendColumn {
  return {
    name: attr(column, "name") ?? "",
    type: attr(column, "type"),
    length: numberAttr(column, "length"),
    precision: numberAttr(column, "precision"),
    nullable: boolAttr(column, "nullable"),
    key: boolAttr(column, "key"),
    sourceType: attr(column, "sourceType"),
    pattern: cleanQuoted(attr(column, "pattern")),
  };
}

function parseSchemas(node: XmlRecord): TalendSchema[] {
  return asArray(node.metadata as XmlRecord | XmlRecord[] | undefined).map((metadata) => ({
    connector: attr(metadata, "connector"),
    name: attr(metadata, "name"),
    label: attr(metadata, "label"),
    columns: asArray(metadata.column as XmlRecord | XmlRecord[] | undefined).map(parseColumn),
  }));
}

function parseMapperEntries(node: XmlRecord): MapperEntry[] {
  const nodeData = node.nodeData as XmlRecord | undefined;
  const entries: MapperEntry[] = [];

  for (const tableKey of ["outputTables", "inputTables", "varTables"] as const) {
    for (const table of asArray(nodeData?.[tableKey] as XmlRecord | XmlRecord[] | undefined)) {
      const tableName = attr(table, "name") ?? tableKey;
      for (const entry of asArray(table.mapperTableEntries as XmlRecord | XmlRecord[] | undefined)) {
        entries.push({
          table: tableName,
          name: attr(entry, "name") ?? "",
          expression: attr(entry, "expression"),
          type: attr(entry, "type"),
          nullable: boolAttr(entry, "nullable"),
        });
      }
    }
  }

  return entries;
}

export function parseJobItem(xml: string, itemPath: string): ParsedJob {
  const parsed = parseXml(xml) as Record<string, XmlRecord>;
  const root = parsed["talendfile:ProcessType"] ?? parsed.ProcessType;
  if (!root) throw new Error("XML de job Talend inválido: falta talendfile:ProcessType");

  const contexts = asArray(root.context as XmlRecord | XmlRecord[] | undefined).flatMap((contexto) =>
    asArray(contexto.contextParameter as XmlRecord | XmlRecord[] | undefined).map<TalendContextParameter>((parametro) => ({
      name: attr(parametro, "name") ?? "",
      type: attr(parametro, "type"),
      value: attr(parametro, "value"),
      prompt: attr(parametro, "prompt"),
    })),
  );

  const components = asArray(root.node as XmlRecord | XmlRecord[] | undefined).map<TalendComponent>((node) => {
    const parameters = parseParameters(node);
    return {
      uniqueName: parameters.UNIQUE_NAME ?? "",
      componentName: attr(node, "componentName") ?? "",
      label: parameters.LABEL,
      parameters,
      schemas: parseSchemas(node),
    };
  });

  const mapperEntries = asArray(root.node as XmlRecord | XmlRecord[] | undefined).flatMap(parseMapperEntries);

  const connections = asArray(root.connection as XmlRecord | XmlRecord[] | undefined).map<TalendConnection>((connection) => {
    const parameters = parseParameters(connection);
    return {
      connectorName: attr(connection, "connectorName"),
      label: attr(connection, "label"),
      metaname: attr(connection, "metaname"),
      source: attr(connection, "source") ?? "",
      target: attr(connection, "target") ?? "",
      uniqueName: parameters.UNIQUE_NAME,
    };
  });

  return { itemPath, components, connections, contexts, mapperEntries };
}
```

- [ ] **Step 8: Verify parser tests pass**

Run:

```bash
bun test tests/talend/job-parser.test.ts
```

Expected: all tests pass.

---

### Task 5: Analysis And Run Log Parsing

**Files:**
- Modify: `src/talend/types.ts`
- Create: `src/talend/analysis.ts`
- Create: `src/talend/run-logs.ts`
- Create: `tests/fixtures/talend/metadata.log`
- Create: `tests/talend/analysis.test.ts`
- Create: `tests/talend/run-logs.test.ts`

- [ ] **Step 1: Extend log and analysis types**

Append to `src/talend/types.ts`:

```ts
export type TdbOutputAnalysis = {
  componentName: string;
  uniqueName: string;
  host?: string;
  port?: string;
  dbName?: string;
  user?: string;
  table?: string;
  tableAction?: string;
  dataAction?: string;
  batchSize?: string;
  schema?: TalendSchema;
};

export type SchemaIssue = {
  component: string;
  schema?: string;
  column?: string;
  issue: "empty-column-name" | "null-column-name";
};

export type RunLogStatus = "success" | "error" | "unknown";

export type RunLogEntry = {
  timestamp?: string;
  line: number;
  message: string;
};

export type LatestRunLog = {
  jobName: string;
  status: RunLogStatus;
  latestCommand?: RunLogEntry;
  latestError?: RunLogEntry;
  errors: RunLogEntry[];
};
```

- [ ] **Step 2: Write analysis tests**

Create `tests/talend/analysis.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { readTextFile } from "../../src/talend/files";
import { analyzeTdbOutputs, findSchemaIssues } from "../../src/talend/analysis";
import { parseJobItem } from "../../src/talend/job-parser";

describe("Talend analysis", () => {
  test("analiza tDBOutput/tMysqlOutput", async () => {
    const xml = await readTextFile("tests/fixtures/talend/lab04_olist_orders_to_staging_0.1.item");
    const job = parseJobItem(xml, "tests/fixtures/talend/lab04_olist_orders_to_staging_0.1.item");
    const outputs = analyzeTdbOutputs(job);

    expect(outputs).toHaveLength(1);
    expect(outputs[0]?.uniqueName).toBe("tDBOutput_1");
    expect(outputs[0]?.componentName).toBe("tMysqlOutput");
    expect(outputs[0]?.table).toBe("stg_olist_orders_ag");
    expect(outputs[0]?.tableAction).toBe("TRUNCATE");
    expect(outputs[0]?.dataAction).toBe("INSERT");
  });

  test("detecta columnas vacías y null", () => {
    const issues = findSchemaIssues({
      itemPath: "fixture.item",
      contexts: [],
      connections: [],
      mapperEntries: [],
      components: [
        {
          uniqueName: "tBad_1",
          componentName: "tMap",
          parameters: {},
          schemas: [{ name: "out1", columns: [{ name: "" }, { name: "null" }] }],
        },
      ],
    });

    expect(issues.map((issue) => issue.issue)).toEqual(["empty-column-name", "null-column-name"]);
  });
});
```

- [ ] **Step 3: Implement analysis module**

Create `src/talend/analysis.ts`:

```ts
import type { ParsedJob, SchemaIssue, TdbOutputAnalysis } from "./types";

export function analyzeTdbOutputs(job: ParsedJob): TdbOutputAnalysis[] {
  return job.components
    .filter((component) => component.componentName === "tMysqlOutput" || component.componentName === "tDBOutput")
    .map((component) => ({
      componentName: component.componentName,
      uniqueName: component.uniqueName,
      host: component.parameters.HOST,
      port: component.parameters.PORT,
      dbName: component.parameters.DBNAME,
      user: component.parameters.USER,
      table: component.parameters.TABLE,
      tableAction: component.parameters.TABLE_ACTION,
      dataAction: component.parameters.DATA_ACTION,
      batchSize: component.parameters.BATCH_SIZE,
      schema: component.schemas.find((schema) => schema.connector === "FLOW") ?? component.schemas[0],
    }));
}

export function findSchemaIssues(job: ParsedJob): SchemaIssue[] {
  const issues: SchemaIssue[] = [];

  for (const component of job.components) {
    for (const schema of component.schemas) {
      for (const column of schema.columns) {
        const name = column.name.trim();
        if (name === "") {
          issues.push({ component: component.uniqueName, schema: schema.name, column: column.name, issue: "empty-column-name" });
        } else if (name.toLowerCase() === "null") {
          issues.push({ component: component.uniqueName, schema: schema.name, column: column.name, issue: "null-column-name" });
        }
      }
    }
  }

  return issues;
}
```

- [ ] **Step 4: Create metadata log fixture**

Create `tests/fixtures/talend/metadata.log`:

```text
!ENTRY org.talend.platform.logging 4 0 2026-05-18 17:08:46.022
!MESSAGE 2026-05-18 17:08:46,021 ERROR org.talend.commons.exception.CommonExceptionHandler  - The Job "lab04_olist_orders_to_staging" has wrong configuration. Fix it and try again.
Error Line: 2322
Detail Message: stg_olist_orders_ag cannot be resolved to a variable
!ENTRY org.talend.platform.logging 1 0 2026-05-19 11:09:32.848
!MESSAGE 2026-05-19 11:09:32,847 INFO  org.talend.designer.core.runprocess.Processor  - Command line: /path/java prj_genius_lab.lab04_olist_orders_to_staging_0_1.lab04_olist_orders_to_staging --context=Default --stat_port=3440
```

- [ ] **Step 5: Write run-log tests**

Create `tests/talend/run-logs.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { readTextFile } from "../../src/talend/files";
import { parseLatestRunLog } from "../../src/talend/run-logs";

describe("run logs", () => {
  test("extrae errores históricos y clasifica latest command sin cierre como unknown", async () => {
    const log = await readTextFile("tests/fixtures/talend/metadata.log");
    const latest = parseLatestRunLog(log, "lab04_olist_orders_to_staging");

    expect(latest.jobName).toBe("lab04_olist_orders_to_staging");
    expect(latest.status).toBe("unknown");
    expect(latest.latestCommand?.message).toContain("Command line");
    expect(latest.errors[0]?.message).toContain("wrong configuration");
  });
});
```

- [ ] **Step 6: Implement run-log parser**

Create `src/talend/run-logs.ts`:

```ts
import type { LatestRunLog, RunLogEntry } from "./types";

function extractTimestamp(line: string): string | undefined {
  return /\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}[,.]\d{3}/.exec(line)?.[0];
}

function includesJob(line: string, jobName: string): boolean {
  return line.toLowerCase().includes(jobName.toLowerCase());
}

export function parseLatestRunLog(logText: string, jobName: string): LatestRunLog {
  const lines = logText.split(/\r?\n/);
  const errors: RunLogEntry[] = [];
  let latestCommand: RunLogEntry | undefined;
  let latestError: RunLogEntry | undefined;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const lineNumber = index + 1;

    if (includesJob(line, jobName) && line.includes("Command line:")) {
      latestCommand = { timestamp: extractTimestamp(line), line: lineNumber, message: line };
    }

    const isJobError = includesJob(line, jobName) && /(ERROR|Exception|wrong configuration|Unknown column|Data too long|cannot be resolved)/i.test(line);
    if (isJobError) {
      const detail = lines.slice(index, Math.min(lines.length, index + 4)).join("\n");
      latestError = { timestamp: extractTimestamp(line), line: lineNumber, message: detail };
      errors.push(latestError);
    }
  }

  const status = latestError && (!latestCommand || latestError.line > latestCommand.line) ? "error" : "unknown";

  return { jobName, status, latestCommand, latestError, errors };
}
```

- [ ] **Step 7: Verify analysis and log tests pass**

Run:

```bash
bun test tests/talend/analysis.test.ts tests/talend/run-logs.test.ts
```

Expected: all tests pass.

---

### Task 6: MCP Tool Registration And Entrypoint

**Files:**
- Create: `src/server.ts`
- Modify: `index.ts`
- Create: `tests/talend/server-smoke.test.ts`

- [ ] **Step 1: Write server smoke test for exports**

Create `tests/talend/server-smoke.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { createTalendMcpServer } from "../../src/server";

describe("MCP server", () => {
  test("crea servidor MCP", () => {
    const server = createTalendMcpServer();
    expect(server).toBeDefined();
  });
});
```

- [ ] **Step 2: Run smoke test to verify failure**

Run:

```bash
bun test tests/talend/server-smoke.test.ts
```

Expected: fail because `src/server.ts` does not exist.

- [ ] **Step 3: Implement MCP server skeleton and tools**

Create `src/server.ts` using the current MCP SDK API verified from Context7: `McpServer` from `@modelcontextprotocol/server`, `StdioServerTransport` from `@modelcontextprotocol/server/stdio`, `server.registerTool(...)`, and `zod/v4` schemas.

The implementation must register these tools with `annotations: { readOnlyHint: true, idempotentHint: true }`:

- `talend_detect_open_job`
- `talend_list_jobs`
- `talend_read_job`
- `talend_list_components`
- `talend_show_flow`
- `talend_read_contexts`
- `talend_analyze_tdboutput`
- `talend_read_latest_run_log`
- `talend_read_job_errors`
- `talend_summarize_open_job`

Each handler must return:

```ts
{
  content: [{ type: "text", text: JSON.stringify(resultado, null, 2) }],
  structuredContent: resultado,
}
```

When a required project path cannot be resolved, return:

```ts
{
  content: [{ type: "text", text: "No se pudo detectar TALEND_PROJECT ni workspace Talend automáticamente." }],
  isError: true,
}
```

- [ ] **Step 4: Wire `index.ts`**

Replace `index.ts` with:

```ts
import { runStdioServer } from "./src/server";

await runStdioServer();
```

- [ ] **Step 5: Verify server smoke test passes**

Run:

```bash
bun test tests/talend/server-smoke.test.ts
```

Expected: pass.

- [ ] **Step 6: Run all tests**

Run:

```bash
bun test
```

Expected: all tests pass.

- [ ] **Step 7: Typecheck**

Run:

```bash
bun run typecheck
```

Expected: pass.

---

### Task 7: Real Workspace Smoke Verification

**Files:**
- Modify: none unless tests reveal a parser bug.

- [ ] **Step 1: Run parser against local Talend files with no writes**

Run:

```bash
TALEND_PROJECT="/Applications/TalendStudio-8.0.1/studio/workspace/CAPACITACION_GL3-1327321152/PRJ_GENIUS_LAB" bun test
```

Expected: all tests pass. Tests must not depend on the real workspace; this only verifies env compatibility.

- [ ] **Step 2: Run server startup smoke**

Run:

```bash
TALEND_PROJECT="/Applications/TalendStudio-8.0.1/studio/workspace/CAPACITACION_GL3-1327321152/PRJ_GENIUS_LAB" bun run index.ts
```

Expected: server starts on stdio and writes any diagnostic logs only to stderr. Stop it with Ctrl+C after confirming it starts.

- [ ] **Step 3: Document MCP configuration example**

Modify `README.md` to include:

```markdown
## Configuración MCP

Servidor local read-only para analizar Qlik Talend Studio.

```json
{
  "mcpServers": {
    "talend-mcp": {
      "command": "bun",
      "args": ["run", "/Users/andresgaibor/code/javascript/talend-mcp/index.ts"],
      "env": {
        "TALEND_PROJECT": "/Applications/TalendStudio-8.0.1/studio/workspace/CAPACITACION_GL3-1327321152/PRJ_GENIUS_LAB"
      }
    }
  }
}
```

El servidor no modifica `.item`, `.properties`, `.metadata` ni ejecuta jobs.
```

- [ ] **Step 4: Run final verification**

Run:

```bash
bun test && bun run typecheck
```

Expected: both commands pass.

---

## Self-Review

Spec coverage:

- Detección automática de job abierto: Task 3 and Task 6.
- Lectura de `.launch`: Task 3 and Task 6.
- Lectura/parsing de `.item` y `.properties`: Task 4.
- Componentes, conexiones, schemas, contextos: Task 4.
- Análisis de `tDBOutput`: Task 5.
- Detección de columnas vacías/null: Task 5.
- Logs y última ejecución: Task 5 and Task 6.
- MCP stdio read-only: Task 6.
- README/configuración MCP: Task 7.
- Seguridad read-only: Task 2 path checks, Task 6 read-only annotations, Task 7 documentation.

Placeholder scan:

- No `TBD` or open-ended implementation placeholders remain.
- Task 6 intentionally specifies behavior and SDK API rather than dumping a full server file because tool handlers compose modules created in prior tasks.

Type consistency:

- Shared names use `ParsedJob`, `TalendComponent`, `TalendConnection`, `TalendContextParameter`, `TdbOutputAnalysis`, `LatestRunLog` consistently.
- Tool names match the approved spec.
