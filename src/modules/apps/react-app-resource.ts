import { McpServer } from "@modelcontextprotocol/server";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const REACT_APP_MIME_TYPE = "text/html;profile=mcp-app";
const JS_MIME_TYPE = "application/javascript";
const CSS_MIME_TYPE = "text/css";

const APPS_UI_DIST = "apps-ui/dist";

function inyectarAppId(html: string, appId: string): string {
  return html.replace(
    /<title>(.*?)<\/title>/,
    `<title>$1 - ${appId}</title>`
  ).replace(
    /<meta name="viewport"/,
    `<meta name="app-id" content="${appId}" />\n    <meta name="viewport"`
  );
}

function detectarMimeType(ruta: string): string {
  if (ruta.endsWith(".js")) return JS_MIME_TYPE;
  if (ruta.endsWith(".css")) return CSS_MIME_TYPE;
  return "application/octet-stream";
}

export function registerReactAppResource(
  server: McpServer,
  appId: string,
  appTitle: string,
  appDescription: string
): void {
  const htmlPath = join(APPS_UI_DIST, "index.html");
  const resourceUri = `ui://talend/${appId}.html`;

  if (!existsSync(htmlPath)) {
    console.warn(`[react-app-resource] No se encontró: ${htmlPath}`);
    return;
  }

  const htmlContent = inyectarAppId(readFileSync(htmlPath, "utf-8"), appId);

  server.registerResource(appId, resourceUri, {
    title: appTitle,
    description: appDescription,
    mimeType: REACT_APP_MIME_TYPE,
  }, async () => {
    type ResourceContent =
      | { uri: string; mimeType: string; text: string; blob?: undefined; _meta?: Record<string, unknown> }
      | { uri: string; mimeType: string; text?: undefined; blob: string; _meta?: Record<string, unknown> };

    const contents: ResourceContent[] = [];

    const assetMatches = htmlContent.matchAll(/(?:src|href)=["']([^"']+)["']/g);

    for (const match of assetMatches) {
      const assetPath: string = match[1] ?? "";
      if (assetPath.startsWith("/assets/")) {
        const localPath = join(APPS_UI_DIST, assetPath.slice(1));
        if (existsSync(localPath)) {
          const mimeType = detectarMimeType(assetPath);
          const assetContent = readFileSync(localPath);

          contents.push({
            uri: `ui://talend${assetPath}`,
            mimeType,
            blob: assetContent.toString("base64"),
            _meta: {
              ui: {
                resourceUri: `ui://talend${assetPath}`,
              },
            },
          });
        }
      }
    }

    return {
      contents: [
        {
          uri: resourceUri,
          mimeType: REACT_APP_MIME_TYPE,
          text: htmlContent,
          _meta: {
            ui: {
              resourceUri,
              prefersBorder: true,
              csp: {
                connectDomains: [],
                resourceDomains: [],
              },
            },
            "openai/widgetDescription": appDescription,
            "openai/widgetPrefersBorder": true,
            "openai/outputTemplate": resourceUri,
          },
        },
        ...contents,
      ],
    };
  });

  console.log(`[react-app-resource] Registrado: ${resourceUri}`);
}

export interface ReactAppConfig {
  id: string;
  title: string;
  description: string;
}

export const REACT_APPS: ReactAppConfig[] = [
  { id: "home", title: "Talend Home", description: "Vista inicial con estado del entorno, actividad reciente y accesos rápidos." },
  { id: "environment-doctor", title: "Talend Environment Doctor", description: "Diagnóstico del entorno, salud del workspace y señales de riesgo." },
  { id: "dataset-inspector", title: "Talend Dataset Inspector", description: "Inspecciona datasets y revisa estructura, componentes y errores." },
  { id: "dataset-inspector-pro", title: "Talend Dataset Inspector Pro", description: "Inspección avanzada de datasets, tablas raw y esquemas." },
  { id: "pipeline-spec-editor", title: "Talend Pipeline Spec Editor", description: "Editor de especificaciones para jobs y pipelines generados." },
  { id: "validation-report", title: "Talend Validation Report", description: "Genera reportes de validación, análisis completo y logs." },
  { id: "run-monitor", title: "Talend Run Monitor", description: "Monitorea ejecuciones, logs y resultados recientes." },
  { id: "run-monitor-pro", title: "Talend Run Monitor Pro", description: "Monitor avanzado para ejecuciones, logs y comparaciones." },
  { id: "snapshot-manager", title: "Talend Snapshot Manager", description: "Administrador de snapshots, cambios y actividad reciente." },
  { id: "secret-safety", title: "Talend Secret Safety", description: "Escanea el proyecto en busca de secretos expuestos y sugiere migraciones a context profiles." },
  { id: "deliverables", title: "Talend Deliverables", description: "Prepara salidas, análisis y artefactos para entrega." },
  { id: "component-catalog", title: "Talend Component Catalog", description: "Catálogo visual para inspeccionar componentes y sus capacidades." },
];

export function registrarAppsReact(server: McpServer): void {
  for (const app of REACT_APPS) {
    registerReactAppResource(server, app.id, app.title, app.description);
  }
}