# Talend MCP - Plan de Implementación Completo

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir el MCP de Talend en un Talend Copilot visual capaz de aprender cientos de componentes, inspeccionar jobs activos, editar componentes con seguridad y generar recomendaciones.

**Architecture:** Sistema modular con Component Knowledge Layer separado del resto. Cada módulo tiene domain/, application/, infrastructure/, tools/. UI apps independientes en apps-ui/src/apps/.

**Tech Stack:** TypeScript, React, Tailwind, Bun, MCP protocol, SQLite para caché local.

---

## Estructura de Archivos a Crear/Modificar

### Component Knowledge Layer (nuevo)
```
src/modules/component-knowledge/
  domain/
    component-definition.ts      # Tipos principales
    component-parameter.ts
    component-schema.ts
    component-connector.ts
    component-mastery.ts
    component-use-case.ts
  application/
    scan-installed-components.use-case.ts
    parse-component-descriptors.use-case.ts
    build-component-catalog.use-case.ts
    enrich-component-knowledge.use-case.ts
    compare-components.use-case.ts
    recommend-components.use-case.ts
    validate-component-usage.use-case.ts
  infrastructure/
    talend-plugin-scanner.ts
    component-xml-parser.ts
    jar-metadata-reader.ts
    component-cache.repository.ts
    component-catalog.repository.ts
  tools/
    components-scan-installed.tool.ts
    components-catalog-status.tool.ts
    components-search.tool.ts
    components-inspect.tool.ts
    components-compare.tool.ts
    components-recommend.tool.ts
    components-explain.tool.ts
    components-mastery-all.tool.ts
```

### UI Apps nuevas
```
apps-ui/src/apps/component-atlas/
apps-ui/src/apps/component-mastery-center/
apps-ui/src/apps/schema-mapping-studio/
apps-ui/src/apps/recipe-builder/
apps-ui/src/apps/job-quality-center/
apps-ui/src/apps/execution-center/
apps-ui/src/apps/error-solver-pro/
```

---

## Sprint 1: Base Estable

### Task 1.1: Corregir defaults requeridos en schemas

**Files:**
- Modify: `src/talend/studio/tools-bridge.ts`
- Modify: `src/talend/jobs/tools-jobs.ts`
- Modify: `src/presentation/tools/report-snippets.ts`

- [ ] **Step 1: Examinar schemas con defaults requeridos**

Run: `grep -r "required.*true" src/talend --include="*.ts" | head -50`
Identificar dónde los schemas declaran required: true pero no tienen defaultValue.

- [ ] **Step 2: Agregar defaultValue a parámetros requeridos sin default**

En `talend_jobs_list` schema, agregar `defaultValue: {}` al argumento `options`.
En `talend_snapshots_list` schema, agregar `defaultValue: {}` al argumento `options`.
En `talend_report_snippets_generate`, asegurar que `mode` tenga `defaultValue: "single"`.

```typescript
// En tools-jobs.ts - talend_jobs_list
inputSchema: {
  type: "object",
  properties: {
    options: {
      type: "object",
      defaultValue: {}
    }
  }
}
```

- [ ] **Step 3: Verificar que las tools aceptan {} sin error**

Run: `bun test tests/tools/jobs.test.ts`
Expected: PASS con talend_jobs_list {}

---

### Task 1.2: Corregir normalizeToolResult

**Files:**
- Modify: `src/presentation/tools/normalize-tool-result.ts`

- [ ] **Step 1: Leer normalizeToolResult actual**

```typescript
// Buscar la función y entender su lógica actual
```

- [ ] **Step 2: Si structuredContent.data existe, retornar data directamente**

```typescript
export function normalizeToolResult(result: ToolResult): ToolResult {
  if (result.structuredContent?.data !== undefined) {
    return { ...result, data: result.structuredContent.data };
  }
  return result;
}
```

- [ ] **Step 3: Verificar que la UI recibe data directamente**

Test con ComponentCatalogApp.

---

### Task 1.3: Registrar launcher faltante

**Files:**
- Modify: `src/talend/apps/app-launcher.ts`
- Create: `src/talend/apps/tools/app-launchers.ts`

- [ ] **Step 1: Agregar talend_app_job_component_studio**

```typescript
export const APP_LAUNCHERS = {
  'talend_app_job_component_studio': {
    appId: 'job-component-studio',
    label: 'Job Component Studio',
    icon: '🔧'
  },
  'talend_app_component_inspector': {
    appId: 'component-inspector', 
    label: 'Component Inspector',
    icon: '🔍'
  }
}
```

- [ ] **Step 2: Actualizar appRegistry.ts**

Agregar los launchers registrados.

---

### Task 1.4: Manejar bridge outdated

**Files:**
- Modify: `src/talend/studio/tools-bridge.ts`
- Create: `src/talend/studio/bridge-health.ts`

- [ ] **Step 1: Crear función para detectar endpoint 404**

```typescript
export function isBridgeOutdated(error: any): boolean {
  return error?.message?.includes('404') || 
         error?.status === 404 ||
         error?.code === 'ENDPOINT_NOT_FOUND';
}
```

- [ ] **Step 2: En cada tool de bridge, agregar check post-llamada**

Si la respuesta es 404, marcar bridge como outdated y mostrar mensaje de reinstall.

- [ ] **Step 3: Mostrar banner en UI cuando bridge outdated**

En StudioBridgeApp, mostrar banner con botón de reinstall.

---

## Sprint 2: Component Catalog v1

### Task 2.1: Crear Component Knowledge Layer

**Files:**
- Create: `src/modules/component-knowledge/domain/component-definition.ts`
- Create: `src/modules/component-knowledge/domain/component-parameter.ts`
- Create: `src/modules/component-knowledge/domain/component-connector.ts`
- Create: `src/modules/component-knowledge/domain/component-schema.ts`
- Create: `src/modules/component-knowledge/domain/component-mastery.ts`
- Create: `src/modules/component-knowledge/domain/component-use-case.ts`

- [ ] **Step 1: Crear component-definition.ts**

```typescript
export type TalendComponentDefinition = {
  id: string;
  name: string;
  family: string;
  paletteCategory?: string;
  version?: string;
  source: {
    pluginId?: string;
    pluginPath?: string;
    descriptorPath?: string;
    scannedAt: string;
  };
  description?: string;
  icon?: string;
  connectors: ComponentConnector[];
  parameters: ComponentParameter[];
  schemas: ComponentSchemaDefinition[];
  examples: ComponentExample[];
  commonUseCases: ComponentUseCase[];
  relatedComponents: string[];
  warnings: string[];
  confidence: "high" | "medium" | "low";
};
```

- [ ] **Step 2: Crear component-parameter.ts**

```typescript
export type ComponentParameter = {
  name: string;
  displayName?: string;
  type:
    | "string"
    | "number"
    | "boolean"
    | "enum"
    | "file"
    | "directory"
    | "schema"
    | "table"
    | "connection"
    | "password"
    | "unknown";
  required: boolean;
  defaultValue?: string;
  possibleValues?: string[];
  category?: "basic" | "advanced" | "dynamic" | "hidden";
  description?: string;
  safeToEdit: boolean;
  riskLevel: "low" | "medium" | "high";
};
```

- [ ] **Step 3: Crear component-connector.ts**

```typescript
export type ComponentConnector = {
  name: string;
  type:
    | "FLOW_MAIN"
    | "ITERATE"
    | "ON_COMPONENT_OK"
    | "ON_COMPONENT_ERROR"
    | "RUN_IF"
    | "LOOKUP"
    | "REJECT"
    | "UNKNOWN";
  direction: "input" | "output";
  required?: boolean;
  maxConnections?: number;
};
```

- [ ] **Step 4: Crear component-mastery.ts**

```typescript
export type ComponentMastery = {
  componentName: string;
  whatItDoes: string;
  whenToUse: string[];
  whenNotToUse: string[];
  requiredParameters: string[];
  commonParameters: string[];
  commonErrors: Array<{
    symptom: string;
    cause: string;
    fix: string;
  }>;
  bestPractices: string[];
  examplePipelines: Array<{
    title: string;
    flow: string[];
    explanation: string;
  }>;
};
```

- [ ] **Step 5: Crear component-use-case.ts**

```typescript
export type ComponentUseCase = {
  id: string;
  description: string;
  inputTypes: string[];
  outputTypes: string[];
  typicalPattern: string;
  components: string[];
};
```

---

### Task 2.2: Mejorar talend_components_scan_installed

**Files:**
- Modify: `src/talend/studio/tools-components.ts`
- Create: `src/modules/component-knowledge/infrastructure/talend-plugin-scanner.ts`
- Create: `src/modules/component-knowledge/infrastructure/component-xml-parser.ts`

- [ ] **Step 1: Crear talend-plugin-scanner.ts**

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { TalendComponentDefinition } from '../domain/component-definition';

export class TalendPluginScanner {
  async scanStudioPlugins(talendStudioPath: string): Promise<TalendComponentDefinition[]> {
    const pluginsPath = path.join(talendStudioPath, 'plugins');
    if (!fs.existsSync(pluginsPath)) return [];
    
    const components: TalendComponentDefinition[] = [];
    const pluginDirs = fs.readdirSync(pluginsPath).filter(d => d.startsWith('org.talend'));
    
    for (const pluginDir of pluginDirs) {
      const descriptorPath = path.join(pluginsPath, pluginDir, 'descriptor.xml');
      if (fs.existsSync(descriptorPath)) {
        const parsed = await this.parseDescriptor(descriptorPath);
        components.push(...parsed);
      }
    }
    
    return components;
  }

  private async parseDescriptor(xmlPath: string): Promise<TalendComponentDefinition[]> {
    const xml = fs.readFileSync(xmlPath, 'utf-8');
    return this.extractComponents(xml);
  }
}
```

- [ ] **Step 2: Actualizar talend_components_scan_installed para usar el scanner**

```typescript
export const talend_components_scan_installed = {
  name: 'talend_components_scan_installed',
  description: 'Escanea todos los componentes instalados en Talend Studio',
  inputSchema: {
    type: 'object',
    properties: {
      forceRefresh: { type: 'boolean', defaultValue: false }
    }
  },
  async execute(input: { forceRefresh?: boolean }) {
    const scanner = new TalendPluginScanner();
    const components = await scanner.scanStudioPlugins(detectedStudioPath);
    await saveToCatalog(components);
    return { count: components.length, components };
  }
};
```

---

### Task 2.3: Crear Component Atlas UI

**Files:**
- Create: `apps-ui/src/apps/component-atlas/types.ts`
- Create: `apps-ui/src/apps/component-atlas/hooks.ts`
- Create: `apps-ui/src/apps/component-atlas/ComponentAtlasApp.tsx`
- Modify: `apps-ui/src/apps/appRegistry.ts`

- [ ] **Step 1: Crear types.ts**

```typescript
export interface ComponentAtlasState {
  catalogStatus: 'empty' | 'scanning' | 'ready' | 'error';
  totalComponents: number;
  families: string[];
  components: Map<string, TalendComponentDefinition>;
  searchQuery: string;
  selectedFamily: string | null;
}
```

- [ ] **Step 2: Crear ComponentAtlasApp.tsx**

```tsx
export function ComponentAtlasApp() {
  const { catalogStatus, totalComponents, families } = useCatalogStatus();
  
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Component Atlas</h1>
        <p className="text-gray-600">Componentes aprendidos: {totalComponents}</p>
      </div>
      
      <div className="mb-4 flex gap-4">
        <input 
          type="text" 
          placeholder="Buscar componente..."
          className="border p-2 rounded w-64"
        />
        <button className="bg-blue-500 text-white px-4 py-2 rounded">
          Scan
        </button>
        <button className="bg-green-500 text-white px-4 py-2 rounded">
          Rebuild
        </button>
      </div>
      
      <div className="grid grid-cols-3 gap-4">
        {families.map(family => (
          <div key={family} className="border p-4 rounded">
            <h3 className="font-semibold">{family}</h3>
            <p className="text-sm text-gray-500">X componentes</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## Sprint 3: Component Mastery v1

### Task 3.1: Sistema de mastery por lotes

**Files:**
- Create: `src/modules/component-knowledge/application/learn-component-batch.use-case.ts`
- Create: `src/modules/component-knowledge/infrastructure/component-mastery-cache.repository.ts`
- Modify: `src/talend/studio/tools-mastery.ts`

- [ ] **Step 1: Crear learn-component-batch.use-case.ts**

```typescript
export class LearnComponentBatchUseCase {
  private batchSize = 25;
  private processedComponents: Set<string> = new Set();
  
  async start(sessionId: string): Promise<{ batchToken: string; components: string[] }> {
    const unprocessed = await this.getUnprocessedComponents();
    const batch = unprocessed.slice(0, this.batchSize);
    return {
      batchToken: crypto.randomUUID(),
      components: batch
    };
  }
  
  async continue(batchToken: string, fromIndex: number): Promise<{ components: string[]; hasMore: boolean }> {
    const unprocessed = await this.getUnprocessedComponents();
    const batch = unprocessed.slice(fromIndex, fromIndex + this.batchSize);
    return {
      components: batch,
      hasMore: fromIndex + this.batchSize < unprocessed.length
    };
  }
  
  private async getUnprocessedComponents(): Promise<string[]> {
    const allComponents = await this.getAllComponents();
    return allComponents.filter(c => !this.processedComponents.has(c.name));
  }
}
```

- [ ] **Step 2: Crear tools de mastery**

```typescript
export const talend_mastery_component = {
  name: 'talend_mastery_component',
  description: 'Aprende un componente específico',
  async execute({ componentName }: { componentName: string }) {
    const mastery = await learnComponent(componentName);
    await saveMastery(componentName, mastery);
    return { componentName, mastery };
  }
};

export const talend_mastery_all_components = {
  name: 'talend_mastery_all_components',
  description: 'Aprende todos los componentes en lotes',
  async execute({ batchSize = 25 }: { batchSize?: number }) {
    const runner = new ComponentMasteryRunner();
    return runner.runAll(batchSize);
  }
};
```

---

### Task 3.2: Component Mastery Center UI

**Files:**
- Create: `apps-ui/src/apps/component-mastery-center/types.ts`
- Create: `apps-ui/src/apps/component-mastery-center/hooks.ts`
- Create: `apps-ui/src/apps/component-mastery-center/ComponentMasteryCenterApp.tsx`

- [ ] **Step 1: Crear ComponentMasteryCenterApp.tsx**

```tsx
export function ComponentMasteryCenterApp() {
  const { masteredCount, totalCount, inProgress } = useMasteryStatus();
  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Component Mastery Center</h1>
      
      <div className="grid grid-cols-3 gap-4 mt-6">
        <div className="border p-4 rounded">
          <h3>Dominados</h3>
          <p className="text-3xl font-bold">{masteredCount}</p>
        </div>
        <div className="border p-4 rounded">
          <h3>En progreso</h3>
          <p className="text-3xl font-bold">{inProgress}</p>
        </div>
        <div className="border p-4 rounded">
          <h3>Sin aprender</h3>
          <p className="text-3xl font-bold">{totalCount - masteredCount}</p>
        </div>
      </div>
      
      <div className="mt-6">
        <button className="bg-blue-500 text-white px-4 py-2 rounded mr-2">
          Learn All
        </button>
        <button className="bg-green-500 text-white px-4 py-2 rounded">
          Learn Selected
        </button>
      </div>
    </div>
  );
}
```

---

## Sprint 4: Job Component Studio v1

### Task 4.1: Mejorar active_job_details y active_component_details

**Files:**
- Modify: `src/talend/studio/tools-bridge.ts`
- Create: `src/talend/studio/job-inspector.service.ts`

- [ ] **Step 1: Mejorar talend_bridge_active_job_details**

```typescript
export const talend_bridge_active_job_details = {
  name: 'talend_bridge_active_job_details',
  description: 'Obtiene detalles completos del job activo',
  async execute() {
    const jobModel = await bridgeClient.getActiveJobModel();
    const components = await bridgeClient.getComponents(jobModel.uniqueName);
    const connections = await bridgeClient.getConnections(jobModel.uniqueName);
    
    return {
      jobName: jobModel.label,
      uniqueName: jobModel.uniqueName,
      components: components.map(c => ({
        id: c.id,
        label: c.label,
        componentName: c.componentName,
        x: c.x,
        y: c.y,
        parameters: c.parameters,
        schema: c.schema,
        connectors: c.connectors
      })),
      connections: connections.map(conn => ({
        from: conn.fromComponentId,
        to: conn.toComponentId,
        connectorType: conn.connectorType
      }))
    };
  }
};
```

- [ ] **Step 2: Mejorar talend_bridge_active_component_details**

Incluir parameters, schemas, y connections completas.

---

### Task 4.2: Job Component Studio UI

**Files:**
- Create: `apps-ui/src/apps/job-component-studio/types.ts`
- Create: `apps-ui/src/apps/job-component-studio/hooks.ts`
- Create: `apps-ui/src/apps/job-component-studio/components/ActiveJobHeader.tsx`
- Create: `apps-ui/src/apps/job-component-studio/components/ComponentList.tsx`
- Create: `apps-ui/src/apps/job-component-studio/components/ComponentDetailsPanel.tsx`
- Create: `apps-ui/src/apps/job-component-studio/JobComponentStudioApp.tsx`

- [ ] **Step 1: Crear JobComponentStudioApp.tsx**

```tsx
export function JobComponentStudioApp() {
  const { jobDetails, loading } = useActiveJobDetails();
  
  if (loading) return <div>Cargando job...</div>;
  
  return (
    <div className="flex h-screen">
      <div className="w-1/4 border-r">
        <ComponentList components={jobDetails.components} />
      </div>
      <div className="w-3/4 p-4">
        <ActiveJobHeader job={jobDetails} />
        <ComponentDetailsPanel />
      </div>
    </div>
  );
}
```

---

## Sprint 5: Edición Segura

### Task 5.1: Rename label y update position

**Files:**
- Modify: `src/talend/studio/tools-components.ts`
- Create: `src/talend/studio/component-edit.service.ts`

- [ ] **Step 1: Implementar talend_components_rename_label**

```typescript
export const talend_components_rename_label = {
  name: 'talend_components_rename_label',
  description: 'Renombra el label de un componente',
  inputSchema: {
    type: 'object',
    properties: {
      componentId: { type: 'string' },
      newLabel: { type: 'string' }
    },
    required: ['componentId', 'newLabel']
  },
  async execute(input) {
    const snapshot = await createSnapshot(input.componentId);
    const result = await applyComponentChange(input.componentId, {
      type: 'rename_label',
      newLabel: input.newLabel
    });
    return { snapshotId: snapshot.id, result };
  }
};
```

- [ ] **Step 2: Implementar talend_components_update_position**

```typescript
export const talend_components_update_position = {
  name: 'talend_components_update_position',
  description: 'Actualiza la posición de un componente',
  async execute({ componentId, x, y }: { componentId: string; x: number; y: number }) {
    const snapshot = await createSnapshot(componentId);
    await applyComponentChange(componentId, { type: 'update_position', x, y });
    return { snapshotId: snapshot.id, x, y };
  }
};
```

---

### Task 5.2: Preview y Apply Patch

**Files:**
- Modify: `src/talend/studio/tools-components.ts`
- Create: `src/talend/studio/patch-preview.service.ts`

- [ ] **Step 1: Implementar talend_components_preview_patch**

```typescript
export const talend_components_preview_patch = {
  name: 'talend_components_preview_patch',
  description: 'Previsualiza los cambios de un patch sin aplicar',
  async execute({ componentId, patch }: { componentId: string; patch: any }) {
    const current = await getComponentState(componentId);
    const proposed = applyPatch(current, patch);
    return {
      componentId,
      current,
      proposed,
      diff: computeDiff(current, proposed)
    };
  }
};
```

- [ ] **Step 2: Implementar talend_components_apply_patch**

```typescript
export const talend_components_apply_patch = {
  name: 'talend_components_apply_patch',
  description: 'Aplica un patch con snapshot automático',
  async execute({ componentId, patch, confirmationToken }: { componentId: string; patch: any; confirmationToken: string }) {
    if (!confirmationToken) {
      return { requiresConfirmation: true, diff: await preview(componentId, patch) };
    }
    const snapshot = await createSnapshot(componentId);
    await applyPatch(componentId, patch);
    await validateAfterChange(componentId);
    return { snapshotId: snapshot.id, success: true };
  }
};
```

---

## Sprint 6: Schema Mapping Studio

### Task 6.1: Tools de schema

**Files:**
- Create: `src/modules/component-knowledge/application/schema-mapping.use-case.ts`
- Create: `src/talend/studio/tools-schema.ts`

- [ ] **Step 1: Crear schema-mapping.use-case.ts**

```typescript
export class SchemaMappingUseCase {
  extractSchema(componentId: string): ComponentSchemaDefinition {
    // Extraer schema desde componente
  }
  
  compareSchemas(schema1: ComponentSchema, schema2: ComponentSchema): SchemaComparison {
    // Comparar schemas input/output
  }
  
  suggestMappings(schemaFrom: ComponentSchema, schemaTo: ComponentSchema): MappingSuggestion[] {
    // Sugerir mappings automáticos
  }
}
```

- [ ] **Step 2: Crear tools de schema**

```typescript
export const talend_schema_extract_from_component = {
  name: 'talend_schema_extract_from_component',
  async execute({ componentId }: { componentId: string }) {
    const schema = await extractSchema(componentId);
    return { componentId, schema };
  }
};

export const talend_schema_compare = {
  name: 'talend_schema_compare',
  async execute({ schemaFromId, schemaToId }: { schemaFromId: string; schemaToId: string }) {
    const comparison = await compareSchemas(schemaFromId, schemaToId);
    return comparison;
  }
};
```

---

### Task 6.2: Schema Mapping Studio UI

**Files:**
- Create: `apps-ui/src/apps/schema-mapping-studio/SchemaMappingStudioApp.tsx`

```tsx
export function SchemaMappingStudioApp() {
  const { inputSchema, outputSchema } = useSelectedComponents();
  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Schema Mapping Studio</h1>
      
      <div className="grid grid-cols-2 gap-4 mt-6">
        <div>
          <h3>Input Schema</h3>
          <SchemaTable schema={inputSchema} />
        </div>
        <div>
          <h3>Output Schema</h3>
          <SchemaTable schema={outputSchema} />
        </div>
      </div>
      
      <div className="mt-4">
        <h3>Mappings sugeridos</h3>
        <MappingList />
      </div>
    </div>
  );
}
```

---

## Sprint 7: Recipe Builder

### Task 7.1: Recommend components

**Files:**
- Create: `src/modules/component-knowledge/application/recipe-generator.use-case.ts`
- Create: `src/talend/studio/tools-recipe.ts`

- [ ] **Step 1: Crear recipe-generator.use-case.ts**

```typescript
export class RecipeGeneratorUseCase {
  generateRecipe(objective: string): Recipe {
    // Analizar objetivo y recomendar componentes
    // Generar flujo: [tFileInputDelimited, tMap, tFilterRow, tDBOutput]
  }
  
  explainRecipe(recipe: Recipe): string {
    // Explicar por qué se recomiendan estos componentes
  }
  
  toPipelineSpec(recipe: Recipe): PipelineSpec {
    // Convertir receta a pipeline spec
  }
}
```

- [ ] **Step 2: Crear tools de recipe**

```typescript
export const talend_recipe_generate = {
  name: 'talend_recipe_generate',
  async execute({ objective }: { objective: string }) {
    const recipe = await generateRecipe(objective);
    return { recipe, explanation: explainRecipe(recipe) };
  }
};
```

---

### Task 7.2: Recipe Builder UI

**Files:**
- Create: `apps-ui/src/apps/recipe-builder/RecipeBuilderApp.tsx`

```tsx
export function RecipeBuilderApp() {
  const [objective, setObjective] = useState('');
  const { recipe, loading } = useRecipe(objective);
  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Recipe Builder</h1>
      
      <textarea 
        className="w-full border p-4 mt-4"
        placeholder="Describe tu objetivo: leer CSV, limpiar nulos, cargar a SingleStore"
        value={objective}
        onChange={e => setObjective(e.target.value)}
      />
      
      <button className="bg-blue-500 text-white px-4 py-2 rounded mt-4">
        Generar Receta
      </button>
      
      {recipe && (
        <div className="mt-6">
          <h3>Componentes recomendados:</h3>
          <RecipeFlow components={recipe.components} />
          <p className="mt-4">{recipe.explanation}</p>
        </div>
      )}
    </div>
  );
}
```

---

## Sprint 8: Quality Center

### Task 8.1: Quality rules y detection

**Files:**
- Create: `src/modules/component-knowledge/application/quality-analyzer.use-case.ts`
- Create: `src/talend/studio/tools-quality.ts`

- [ ] **Step 1: Crear quality-analyzer.use-case.ts**

```typescript
export class QualityAnalyzerUseCase {
  analyzeJob(jobId: string): QualityReport {
    return {
      score: this.calculateScore(jobId),
      issues: this.detectIssues(jobId),
      suggestions: this.suggestFixes(jobId)
    };
  }
  
  detectHardcodedPaths(jobId: string): Issue[] {
    // Detectar rutas hardcodeadas
  }
  
  detectHardcodedSecrets(jobId: string): Issue[] {
    // Detectar credenciales hardcodeadas
  }
  
  detectUnlabeledComponents(jobId: string): Issue[] {
    // Componentes sin label descriptivo
  }
}
```

- [ ] **Step 2: Crear tools de quality**

```typescript
export const talend_quality_analyze_job = {
  name: 'talend_quality_analyze_job',
  async execute({ jobId }: { jobId: string }) {
    return analyzer.analyzeJob(jobId);
  }
};
```

---

### Task 8.2: Job Quality Center UI

**Files:**
- Create: `apps-ui/src/apps/job-quality-center/JobQualityCenterApp.tsx`

```tsx
export function JobQualityCenterApp() {
  const { report, loading } = useQualityReport(jobId);
  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Job Quality Center</h1>
      
      <div className="mt-6">
        <div className="text-4xl font-bold">{report.score}/100</div>
        <p>Quality Score</p>
      </div>
      
      <div className="mt-6">
        {report.issues.map(issue => (
          <div key={issue.id} className="border p-4 mb-2 rounded">
            <h4 className="font-semibold">{issue.title}</h4>
            <p className="text-gray-600">{issue.description}</p>
            <button className="text-blue-500 mt-2">Ver fix</button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## Sprint 9: Execution Center

### Task 9.1: Mejorar execution tools

**Files:**
- Modify: `src/talend/studio/tools-execution.ts`
- Create: `src/talend/studio/execution-tracker.service.ts`

- [ ] **Step 1: Mejorar talend_bridge_launch_runs**

```typescript
export const talend_bridge_launch_runs = {
  name: 'talend_bridge_launch_runs',
  async execute({ jobName }: { jobName?: string }) {
    const runs = await getLaunchRuns(jobName);
    return {
      runs: runs.map(r => ({
        id: r.id,
        jobName: r.jobName,
        status: r.status,
        startTime: r.startTime,
        endTime: r.endTime,
        duration: r.endTime - r.startTime,
        errorCount: r.errors?.length || 0
      }))
    };
  }
};
```

- [ ] **Step 2: Crear talend_evidence_pack_generate**

```typescript
export const talend_evidence_pack_generate = {
  name: 'talend_evidence_pack_generate',
  async execute({ runId }: { runId: string }) {
    const run = await getRunDetails(runId);
    const logs = await getRunLogs(runId);
    const outputs = await getGeneratedOutputs(runId);
    
    return {
      runId,
      summary: generateSummary(run),
      logs: logs,
      outputs: outputs,
      artifacts: await createEvidencePackage(run)
    };
  }
};
```

---

### Task 9.2: Execution Center UI

**Files:**
- Create: `apps-ui/src/apps/execution-center/ExecutionCenterApp.tsx`

```tsx
export function ExecutionCenterApp() {
  const { runs, selectedRun } = useExecutionData();
  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Execution Center</h1>
      
      <div className="grid grid-cols-2 gap-4 mt-6">
        <div>
          <h3>Launch Configs</h3>
          <LaunchConfigList />
        </div>
        <div>
          <h3>Recent Runs</h3>
          <RunList runs={runs} />
        </div>
      </div>
      
      {selectedRun && (
        <div className="mt-6">
          <RunDetails run={selectedRun} />
          <button className="bg-green-500 text-white px-4 py-2 rounded mt-4">
            Generate Evidence
          </button>
        </div>
      )}
    </div>
  );
}
```

---

## Sprint 10: UI Automation

### Task 10.1: Tools de UI Automation

**Files:**
- Create: `src/talend/ui/ui-driver.ts`
- Create: `src/talend/studio/tools-automation.ts`

- [ ] **Step 1: Crear ui-driver.ts**

```typescript
export class UiDriver {
  async selectComponent(componentId: string): Promise<void> {
    await bridgeClient.executeCommand('org.talend.studio.select.component', componentId);
  }
  
  async openComponentSettings(componentId: string): Promise<void> {
    await bridgeClient.executeCommand('org.talend.studio.open.component.settings', componentId);
  }
  
  async showView(viewName: 'Problems' | 'Run' | 'Console'): Promise<void> {
    await bridgeClient.showView(viewName);
  }
}
```

- [ ] **Step 2: Crear tools de automation**

```typescript
export const talend_bridge_select_component = {
  name: 'talend_bridge_select_component',
  async execute({ componentId }: { componentId: string }) {
    await uiDriver.selectComponent(componentId);
    return { success: true };
  }
};

export const talend_bridge_show_view = {
  name: 'talend_bridge_show_view',
  async execute({ viewName }: { viewName: string }) {
    await uiDriver.showView(viewName);
    return { success: true };
  }
};
```

---

## Criterios de Aceptación Finales

- [ ] `talend_jobs_list {}` funciona
- [ ] `talend_snapshots_list {}` funciona
- [ ] `talend_report_snippets_generate { section, jobName }` funciona
- [ ] `talend_app_job_component_studio` abre la UI
- [ ] `talend_bridge_active_job_details` funciona
- [ ] `talend_bridge_active_component_details` funciona
- [ ] Component Atlas muestra componentes escaneados
- [ ] Component Mastery procesa componentes en lotes
- [ ] Job Component Studio muestra job activo completo
- [ ] Edición de label funciona con snapshot
- [ ] Recipe Builder genera componentes por objetivo
- [ ] Quality Center detecta issues en jobs
- [ ] Execution Center muestra runs y genera evidencias
- [ ] UI Automation selecciona componentes en Studio

---

## Commit y Push

```bash
git add -A
git commit -m "feat: implementar Talend Copilot completo - Component Knowledge Layer, Mastery, Studio UI"
git push origin main
```