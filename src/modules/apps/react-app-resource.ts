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

export function registrarAppsReact(server: McpServer): void {
  registerReactAppResource(server, "apps-home", "Apps Home", "Aplicación principal de Talend MCP");
}