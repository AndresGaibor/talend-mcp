# MCP Apps UI Guide

Guía para construir interfaces de usuario servidas por el servidor MCP de Talend.

## 1. Arquitectura

El servidor expone cada app como un recurso MCP `ui://talend/<id>.html`. El contenido del
recurso es HTML autocontenido (sin build, sin bundler) generado en TypeScript.

```
┌─────────────────────────────────────────────────────────┐
│                  Cliente MCP (host)                     │
│           (escribe a window.openai para llamar tools)    │
└─────────────────────┬───────────────────────────────────┘
                      │ SSE / HTTP
┌─────────────────────▼───────────────────────────────────┐
│                  Talend MCP Server                       │
│                                                          │
│  - Tool handlers (talend_*)                              │
│  - Presentation App resources (ui://talend/*)           │
│  - Presentation App launchers (talend_app_*)            │
└─────────────────────┬───────────────────────────────────┘
                      │ HTML generado en el servidor
┌─────────────────────▼───────────────────────────────────┐
│              legacy-shells (HTML + JS inline)            │
│  src/presentation/apps/legacy-shells/*.shell.ts          │
└──────────────────────────────────────────────────────────┘
```

### Stack

No hay build step para las UIs. Cada shell es una función que devuelve una cadena HTML con
estilos y JavaScript en línea. El tipo MIME registrado es `text/html;profile=mcp-app`.

### Estructura de directorios

```
src/presentation/apps/
├── app-types.ts            # PresentationAppId, PresentationAppDefinition
├── app-registry.ts         # registro de recursos y launchers
├── app-state.ts            # estado inicial que recibe cada app
├── legacy-app-shell.ts     # dispatch app.id -> shell
├── definitions/            # definiciones por dominio (jobs, data, monitoring, ...)
└── legacy-shells/          # un archivo por app
    ├── home.shell.ts
    ├── environment-doctor.shell.ts
    └── ...
```

## 2. Cómo una app invoca tools

Los shells usan el bridge `window.openai` que expone el host MCP. Cada shell define su propio
helper `callTool` en el JavaScript embebido, siguiendo este patron:

```typescript
async function callTool(name: string, payload: Record<string, unknown>): Promise<unknown> {
  if (!window.openai || typeof window.openai.callTool !== "function") {
    throw new Error("window.openai.callTool no disponible");
  }
  return await window.openai.callTool(name, payload);
}
```

El resultado llega con la forma estandar de MCP (`content`, `structuredContent`, `isError`).
Para las tools del servidor, el payload util esta en `structuredContent.data`.

```typescript
const response = await callTool("talend_jobs_list", { limit: 20 });
const payload = response?.structuredContent?.data ?? [];
```

El estado inicial que el launcher entrega a la app se lee de `window.openai.toolOutput`
(o del evento `openai:set_globals`).

## 3. Cómo registrar una app nueva

**Paso 1: Agregar el ID en `app-types.ts`**

```typescript
// src/presentation/apps/app-types.ts
export const PRESENTATION_APP_IDS = [
  // ... ids existentes ...
  "mi-nueva-app",
] as const;
```

**Paso 2: Crear la definicion en `src/presentation/apps/definitions/`**

Cada definicion declara id, titulo, resourceUri, launcherToolName, launchMessage y actions.

```typescript
// src/presentation/apps/definitions/app-definitions-tools.ts
{
  id: "mi-nueva-app",
  title: "Mi Nueva App",
  description: "Descripción de lo que hace esta app.",
  resourceUri: "ui://talend/mi-nueva-app.html",
  launcherToolName: "talend_app_mi_nueva_app",
  launchMessage: "Abriendo mi nueva app.",
  actions: [
    createNoInputAction(
      "Abrir app",
      "talend_app_mi_nueva_app",
      "Abre la aplicación",
    ),
  ],
},
```

Las acciones usan los helpers de `definitions/action-helpers.ts`: `createNoInputAction`,
`createTextAction` y `createJsonAction`. El `toolName` debe existir en el registro del servidor.

**Paso 3: Crear el shell en `legacy-shells/`**

Un archivo por app, con una funcion `create<Nombre>Html(): string`. Registra el dispatch en
`legacy-app-shell.ts`:

```typescript
// src/presentation/apps/legacy-app-shell.ts
import { createMiNuevaAppHtml } from "./legacy-shells/mi-nueva-app.shell";

export function createPresentationAppShellHtml(app: PresentationAppDefinition): string {
  switch (app.id) {
    // ...
    case "mi-nueva-app":
      return createMiNuevaAppHtml();
    default:
      return createGenericShellHtml(app);
  }
}
```

Si no agregas un shell propio, `createGenericShellHtml` genera una app minima a partir de las
`actions` declaradas.

**Paso 4: Agregar el estado inicial en `app-state.ts`**

```typescript
// src/presentation/apps/app-state.ts
export async function buildLauncherInitialStateForApp(
  appId: PresentationAppId
): Promise<Record<string, unknown>> {
  switch (appId) {
    case "mi-nueva-app":
      return {
        projectPath: getConfiguredProjectPath(),
      };
    default:
      return baseState;
  }
}
```

## 4. Reglas

- Cada app nueva tiene su propio archivo en `legacy-shells/`; no agregues ramas al shell generico.
- Los `resourceUri` siguen el formato `ui://talend/<id>.html` y el `launcherToolName` el formato
  `talend_app_<id_snake_case>`.
- Las acciones peligrosas deben declarar `requiresConfirmation: true`.
- `tests/presentation/apps/app-registry.test.ts` valida el registro: revisa ese test cuando
  agregues una app.

## 5. Referencias

- `docs/tool-migration.md` - como migrar tools legacy a tools canonicas de modulo.
- `AGENTS.md` - convenciones generales del repositorio.
