# MCP Apps UI Guide

Guía para construir interfaces de usuario integradas en Talend MCP usando el sistema de apps-ui.

## 1. Arquitectura de apps-ui

apps-ui es una aplicación Vite + React + Tailwind que corre en el navegador y se comunica con el servidor MCP mediante el bridge de window.openai.

```
┌─────────────────────────────────────────────────────────┐
│                    ChatGPT / Claude                     │
│                   (external clients)                     │
└─────────────────────┬───────────────────────────────────┘
                      │ SSE / HTTP
┌─────────────────────▼───────────────────────────────────┐
│                   Talend MCP Server                     │
│                (index.ts / new-server.ts)               │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  MCP Server (McpServer)                         │   │
│  │  - Tool handlers (talend_*)                    │   │
│  │  - Presentation App resources (ui://talend/*)   │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────┬───────────────────────────────────┘
                      │ file:// or bundled HTML
┌─────────────────────▼───────────────────────────────────┐
│                 apps-ui (Vite + React)                  │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Apps (src/apps/*/)                            │   │
│  │  - HomeApp, DatasetInspectorApp, etc.          │   │
│  │  - Cada app es un componente React independiente│   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Bridge (src/openai/)                           │   │
│  │  - useCallTool: hook para invocar tools         │   │
│  │  - openai-client: wrapper de window.openai      │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Stack tecnológico

- **Vite** (build tool): `apps-ui/package.json` — scripts `ui:dev`, `ui:build`
- **React 18**: componentes de UI
- **Tailwind CSS v3**: estilos (config en `tailwind.config.ts`)
- **TypeScript**: tipado completo
- **Vitest**: tests (config en `vitest.config.ts`)

### Estructura de directorios

```
apps-ui/
├── index.html                 # Entry HTML
├── src/
│   ├── main.tsx              # Entry React
│   ├── index.css             # Tailwind imports
│   ├── apps/                 # Aplicaciones individuales
│   │   ├── home/
│   │   │   └── HomeApp.tsx
│   │   ├── dataset-inspector/
│   │   │   ├── DatasetInspectorApp.tsx
│   │   │   ├── CsvFilesTable.tsx
│   │   │   ├── ColumnsTable.tsx
│   │   │   └── types.ts
│   │   └── ...
│   ├── components/           # Componentes shared (Card, Button, Badge, etc.)
│   │   ├── Card.tsx
│   │   ├── Button.tsx
│   │   ├── Badge.tsx
│   │   └── ...
│   └── openai/              # Bridge de comunicación
│       ├── index.ts
│       ├── openai-client.ts  # callTool, toolOutput, setGlobals
│       ├── openai-types.ts   # ToolResult, OpenAiGlobals
│       ├── useCallTool.ts    # React hook
│       ├── useToolOutput.ts
│       └── useOpenAiGlobals.ts
├── tailwind.config.ts
├── postcss.config.js
├── vite.config.ts
└── package.json
```

## 2. Cómo registrar una UI Resource en MCP

Las apps se registran en `src/presentation/apps/app-registry.ts`. Cada app tiene una definición que incluye id, título, resourceUri, y actions.

### Pasos para registrar una nueva app

**Paso 1: Agregar el ID en app-types.ts**

```typescript
// src/presentation/apps/app-types.ts
export const PRESENTATION_APP_IDS = [
  // ... existing ids ...
  "mi-nueva-app",  // agregar aquí
] as const;

export type PresentationAppId = (typeof PRESENTATION_APP_IDS)[number];
```

**Paso 2: Crear la definición en app-registry.ts**

```typescript
// src/presentation/apps/app-registry.ts
{
  id: "mi-nueva-app",
  title: "Mi Nueva App",
  description: "Descripción de lo que hace esta app.",
  resourceUri: "ui://talend/mi-nueva-app.html",
  launcherToolName: "talend_app_mi_nueva_app",
  launchMessage: "Abriendo mi nueva app.",
  actions: [
    // actions que aparecen como botones en el launcher
    createNoInputAction(
      "Abrir app",
      "talend_app_mi_nueva_app",
      "Abre la aplicación"
    ),
  ],
},
```

**Paso 3: Agregar el handler de initial state en app-state.ts**

```typescript
// src/presentation/apps/app-state.ts
export async function buildLauncherInitialStateForApp(
  appId: PresentationAppId
): Promise<Record<string, unknown>> {
  // ... casos existentes ...
  
  switch (appId) {
    // ...
    case "mi-nueva-app":
      return {
        projectPath: getConfiguredProjectPath(),
        // otros datos iniciales que la app necesita
      };
    default:
      return baseState;
  }
}
```

**Paso 4: Crear el archivo de la app en apps-ui/src/apps/**

El sistema carga las apps desde `apps-ui/dist/` — el build de Vite genera los archivos HTML que se sirven como `ui://talend/*.html`.

## 3. Cómo una app invoca tools mediante window.openai

### El bridge de openai

`apps-ui/src/openai/openai-client.ts` provee funciones que llaman a `window.openai`:

```typescript
// apps-ui/src/openai/openai-client.ts
export async function callTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  if (window.openai?.callTool) {
    return window.openai.callTool(toolName, args);
  }
  return { success: false, error: "ChatGPT API not available" };
}

export function toolOutput(toolUseId: string, output: string): void {
  if (window.openai?.toolOutput) {
    window.openai.toolOutput(toolUseId, output);
  }
}
```

### El hook useCallTool

La forma recomendada de usar tools en componentes React es mediante el hook `useCallTool`:

```typescript
// apps-ui/src/openai/useCallTool.ts
export function useCallTool() {
  const [state, setState] = useState<UseCallToolState>({
    isLoading: false,
    error: null,
    result: null,
  });

  const execute = useCallback(
    async (toolName: string, args: Record<string, unknown>) => {
      setState({ isLoading: true, error: null, result: null });
      try {
        const result = await callTool(toolName, args);
        setState({ isLoading: false, error: null, result });
        return result;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        setState({ isLoading: false, error: errorMessage, result: null });
        return { success: false, error: errorMessage };
      }
    },
    []
  );

  const reset = useCallback(() => {
    setState({ isLoading: false, error: null, result: null });
  }, []);

  return { ...state, execute, reset };
}
```

### Ejemplo de uso en una app

```typescript
// apps-ui/src/apps/home/HomeApp.tsx
import { useCallTool } from "../../openai/useCallTool";
import { Card } from "../../components/Card";

export function HomeApp() {
  const { execute: callTool, isLoading } = useCallTool();
  const [bridgeStatus, setBridgeStatus] = useState({ connected: false });

  const loadBridgeStatus = useCallback(async () => {
    const result = await callTool("talend_bridge_ping", {});
    if (result.success && result.result) {
      const data = JSON.parse(result.result);
      setBridgeStatus({ connected: true, studioRunning: data.studioRunning });
    }
  }, [callTool]);

  useEffect(() => {
    loadBridgeStatus();
  }, [loadBridgeStatus]);

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <h3>Bridge Status</h3>
        <p>{bridgeStatus.connected ? "Connected" : "Disconnected"}</p>
      </Card>
      <button onClick={loadBridgeStatus} disabled={isLoading}>
        {isLoading ? "Loading..." : "Refresh"}
      </button>
    </div>
  );
}
```

### Ejemplo multi-step: DatasetInspectorApp

```typescript
// apps-ui/src/apps/dataset-inspector/DatasetInspectorApp.tsx

export function DatasetInspectorApp() {
  const { execute: callTool, isLoading } = useCallTool();
  const [step, setStep] = useState<"input" | "files" | "columns">("input");
  const [inspection, setInspection] = useState<DatasetInspectionResult | null>(null);

  // Step 1: Inspect folder
  const inspectFolder = useCallback(async () => {
    const result = await callTool("talend_datasets_inspect_csv_folder", { folderPath });
    if (result.success && result.result) {
      const data = JSON.parse(result.result);
      if (data.ok) {
        setInspection(data.data);
        setStep("files");
      }
    }
  }, [callTool, folderPath]);

  // Step 2: Generate mappings (puede enviar output a otra app)
  const generateMappings = useCallback(async () => {
    const result = await callTool("talend_datasets_generate_raw_mappings", {
      folderPath: inspection.folderPath,
    });
    if (result.success) {
      const data = JSON.parse(result.result);
      // Enviar a otra app usando toolOutput
      window.openai?.toolOutput?.("dataset-inspector-output", JSON.stringify(data));
    }
  }, [inspection, callTool]);

  // Step 3: Enviar a Pipeline Spec Editor
  const sendToPipelineEditor = useCallback(() => {
    if (!mappings) return;
    window.openai?.toolOutput?.("dataset-inspector-output", JSON.stringify(mappings));
  }, [mappings]);
}
```

### Enviar datos entre apps con toolOutput

```typescript
// Envia output hacia otra app o hacia el chat
window.openai?.toolOutput?.(
  "my-tool-use-id",        // identificador del tool call
  JSON.stringify({ data: myData })  // datos a enviar
);
```

## 4. App Sessions para pasar datos entre apps

El sistema de App Sessions permite mantener estado entre invocaciones de una misma app. Se configura en `app-state.ts` mediante `buildLauncherInitialStateForApp`.

### Cómo funciona

Cada vez que se lanza una app, `buildLauncherInitialStateForApp` construye el estado inicial basado en:

1. **projectPath** del workspace configurado
2. **liveWatcher** status del sistema de archivos
3. **Datos del workspace**: jobs, runs, snapshots, profiles, errors

### Ejemplo: home app state

```typescript
// src/presentation/apps/app-state.ts
case "home": {
  const bundle = await loadWorkspaceBundle(projectPath);
  return {
    ...baseState,
    environment: {
      projectPath,
      projectDetected: Boolean(projectPath),
      watcherActive: Boolean(baseState.liveWatcher.ok && baseState.liveWatcher.data?.active),
    },
    quickStats: {
      jobCount: bundle.jobs.length,
      runCount: bundle.runs.length,
      snapshotCount: bundle.snapshots.length,
      profileCount: bundle.profiles.length,
      errorCount: bundle.errorStats.total,
    },
    recentJobs: bundle.jobs.slice(0, 5),
    recentRuns: bundle.runs.slice(0, 5),
  };
}
```

### Compartir datos entre apps

Para compartir datos entre apps, se usa `window.openai.toolOutput`:

```typescript
// En DatasetInspectorApp, cuando el usuario genera mappings:
const sendToPipelineEditor = useCallback(() => {
  if (!mappings) return;
  window.openai?.toolOutput?.("dataset-inspector-to-pipeline", JSON.stringify(mappings));
}, [mappings]);

// En PipelineSpecEditorApp, recibe el dato y lo procesa:
useEffect(() => {
  window.openai?.setGlobals({
    document: "", cursor: "", selection: "", clipboard: ""
  });
}, []);
```

### Patrón de inicialización de estado

```typescript
// En cada app,接收 initialState desde el launcher
export function MiApp() {
  // El estado inicial se pasa como props o mediante window
  const [data, setData] = useState<unknown>(null);

  useEffect(() => {
    // Cargar datos iniciales del workspace
    const loadInitialData = async () => {
      const result = await callTool("talend_workspace_state", {});
      if (result.success) {
        setData(JSON.parse(result.result));
      }
    };
    loadInitialData();
  }, []);

  return <div>{/* render UI */}</div>;
}
```

## 5. Cómo agregar una nueva app

### Paso 1: Crear directorio en apps-ui/src/apps/

```
apps-ui/src/apps/mi-nueva-app/
├── MiNuevaApp.tsx        # Componente principal
├── Tipos.ts              # Tipos TypeScript (si es necesario)
└── ComponentesAuxiliares.tsx  # Componentes adicionales (opcional)
```

### Paso 2: Implementar el componente

```typescript
// apps-ui/src/apps/mi-nueva-app/MiNuevaApp.tsx
import { useState, useCallback } from "react";
import { useCallTool } from "../../openai/useCallTool";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";

interface Props {
  // Datos iniciales que vienen del launcher
  projectPath?: string;
  initialData?: unknown;
}

export function MiNuevaApp({ projectPath, initialData }: Props) {
  const { execute: callTool, isLoading } = useCallTool();
  const [result, setResult] = useState<unknown>(null);

  const doSomething = useCallback(async () => {
    const res = await callTool("talend_mi_tool", { projectPath });
    if (res.success && res.result) {
      setResult(JSON.parse(res.result));
    }
  }, [callTool, projectPath]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Mi Nueva App</h2>
          <p className="text-gray-500 mt-1">Descripción de la app</p>
        </div>
        <Button variant="primary" onClick={doSomething} disabled={isLoading}>
          {isLoading ? "Cargando..." : "Ejecutar"}
        </Button>
      </div>

      {result && (
        <Card className="p-4">
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </Card>
      )}
    </div>
  );
}
```

### Paso 3: Registrar en MCP

**app-types.ts** — agregar ID:
```typescript
export const PRESENTATION_APP_IDS = [
  // ... existentes ...
  "mi-nueva-app",
] as const;
```

**app-registry.ts** — agregar definición:
```typescript
{
  id: "mi-nueva-app",
  title: "Mi Nueva App",
  description: "Descripción de lo que hace.",
  resourceUri: "ui://talend/mi-nueva-app.html",
  launcherToolName: "talend_app_mi_nueva_app",
  launchMessage: "Abriendo mi nueva app.",
  actions: [
    createNoInputAction("Abrir", "talend_app_mi_nueva_app", "Abre la app."),
  ],
},
```

**app-state.ts** — agregar initial state:
```typescript
case "mi-nueva-app":
  return {
    ...baseState,
    projectPath: getConfiguredProjectPath(),
    // otros datos necesarios
  };
```

### Paso 4: Build y test

```bash
cd apps-ui
bun run ui:build
# Verificar en dist/ que se generó mi-nueva-app.html
```

## Componentes disponibles

El sistema incluye componentes base en `apps-ui/src/components/`:

| Componente | Props | Descripción |
|------------|-------|-------------|
| `Card` | `children`, `className` | Contenedor con borde y padding |
| `Button` | `variant` (primary/ghost/danger), `size` (sm/md), `children`, `onClick`, `disabled` | Botón estilizado |
| `Badge` | `variant` (default/success/warning/error), `children`, `className` | Etiqueta de estado |
| `DataTable<T>` | `data`, `columns`, `className` | Tabla genérica con columnas configurables |
| `EmptyState` | `message` | Estado cuando no hay datos |
| `ErrorBanner` | `message` | Mensaje de error en rojo |
| `LoadingState` | `message` | Spinner con mensaje |
| `ResultPanel` | `result`, `onClear` | Panel para mostrar resultados de tools |

## Patrones comunes

### Llamar un tool y parsear JSON

```typescript
const result = await callTool("talend_some_tool", { arg: value });
if (result.success && result.result) {
  const data = JSON.parse(result.result);
  // usar data
}
```

### Loading states

```typescript
const { execute, isLoading, error, result } = useCallTool();

// en JSX
<Button disabled={isLoading} onClick={execute}>
  {isLoading ? "Cargando..." : "Acción"}
</Button>
```

### Navegación entre steps

```typescript
type Step = "input" | "processing" | "result";

const [step, setStep] = useState<Step>("input");

// transitions
const start = () => setStep("processing");
const done = (data: unknown) => {
  setResult(data);
  setStep("result");
};
```

## Herramientas de desarrollo

```bash
# Development server con hot reload
cd apps-ui && bun run ui:dev

# Build para producción
bun run ui:build

# TypeScript check
bun run ui:typecheck

# Tests
bun test
bun run test:run
```