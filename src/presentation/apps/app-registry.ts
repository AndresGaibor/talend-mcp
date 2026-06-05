import { McpServer } from "@modelcontextprotocol/server";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { z } from "zod/v4";

import { createPresentationAppShellHtml } from "./legacy-app-shell";
import { buildLauncherInitialStateForApp } from "./app-state";
import { registerReactAppResource } from "../../modules/apps/react-app-resource";
import {
  PRESENTATION_APP_IDS,
  type PresentationAppAction,
  type PresentationAppDefinition,
  type PresentationAppId,
  type PresentationAppLaunchResult,
} from "./app-types";

import { JOB_APP_DEFINITIONS } from "./definitions/app-definitions-jobs";
import { DATA_APP_DEFINITIONS } from "./definitions/app-definitions-data";
import { MONITORING_APP_DEFINITIONS } from "./definitions/app-definitions-monitoring";
import { VALIDATION_APP_DEFINITIONS } from "./definitions/app-definitions-validation";
import { TOOLS_APP_DEFINITIONS } from "./definitions/app-definitions-tools";

const APP_MIME_TYPE = "text/html;profile=mcp-app";

export const LAUNCHER_OUTPUT_SCHEMA = z.object({
  ok: z.literal(true),
  source: z.literal("launcher"),
  confidence: z.number(),
  summary: z.string(),
  warnings: z.array(z.string()),
  app: z.object({
    id: z.string(),
    title: z.string(),
    resourceUri: z.string(),
  }),
  initialState: z.record(z.string(), z.unknown()),
  seed: z.string().optional(),
}).passthrough();

export const PRESENTATION_APP_DEFINITIONS: PresentationAppDefinition[] = [
  ...JOB_APP_DEFINITIONS,
  ...DATA_APP_DEFINITIONS,
  ...MONITORING_APP_DEFINITIONS,
  ...VALIDATION_APP_DEFINITIONS,
  ...TOOLS_APP_DEFINITIONS,
];

const APP_BY_ID = new Map<PresentationAppId, PresentationAppDefinition>(
  PRESENTATION_APP_DEFINITIONS.map((app) => [app.id, app]),
);

function buildLauncherToolResult(app: PresentationAppDefinition, initialState: Record<string, unknown>, seed?: string): CallToolResult {
  const warnings = Array.isArray((initialState as { warnings?: unknown }).warnings)
    ? ((initialState as { warnings?: string[] }).warnings ?? [])
    : [];

  const structuredContent: PresentationAppLaunchResult = {
    ok: true,
    source: "launcher",
    confidence: warnings.length > 0 ? 0.82 : 0.94,
    summary: app.launchMessage,
    warnings,
    app: {
      id: app.id,
      title: app.title,
      resourceUri: app.resourceUri,
    },
    initialState,
    ...(seed ? { seed } : {}),
  };

  return {
    content: [{ type: "text", text: app.launchMessage }],
    structuredContent,
  };
}

export function getPresentationAppDefinition(appId: PresentationAppId): PresentationAppDefinition {
  const app = APP_BY_ID.get(appId);
  if (!app) {
    throw new Error(`App no registrada: ${appId}`);
  }
  return app;
}

export function registerPresentationAppResources(server: McpServer): void {
  for (const app of PRESENTATION_APP_DEFINITIONS) {
    if (app.uiMode === "react") {
      registerReactAppResource(server, app.id, app.title, app.description);
    } else {
      server.registerResource(app.id, app.resourceUri, {
        title: app.title,
        description: app.description,
        mimeType: APP_MIME_TYPE,
      }, async () => ({
        contents: [{
          uri: app.resourceUri,
          mimeType: APP_MIME_TYPE,
          text: createPresentationAppShellHtml(app),
          _meta: {
            ui: {
              prefersBorder: true,
              csp: {
                connectDomains: [],
                resourceDomains: [],
              },
            },
            "openai/widgetDescription": app.description,
            "openai/widgetPrefersBorder": true,
          },
        }],
      }));
    }
  }
}

export function getPresentationAppLauncherTools() {
  return PRESENTATION_APP_DEFINITIONS.map((app) => ({
    definition: {
      name: app.launcherToolName,
      description: app.launchMessage,
      inputSchema: z.object({
        seed: z.string().optional().describe("Contexto opcional para abrir la app"),
      }),
      outputSchema: LAUNCHER_OUTPUT_SCHEMA,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
      _meta: {
        ui: {
          resourceUri: app.resourceUri,
          visibility: ["model", "app"],
        },
        "openai/outputTemplate": app.resourceUri,
        "openai/widgetAccessible": true,
        "openai/toolInvocation/invoking": app.launchMessage,
        "openai/toolInvocation/invoked": `${app.title} lista`,
      },
    },
    handler: async (input: { seed?: string }) => {
      const initialState = await buildLauncherInitialStateForApp(app.id);
      return buildLauncherToolResult(app, initialState, input.seed);
    },
  }));
}

export function registerPresentationAppLaunchers(server: McpServer): void {
  const launchers = getPresentationAppLauncherTools();
  for (const launcher of launchers) {
    server.registerTool(
      launcher.definition.name,
      {
        description: launcher.definition.description,
        inputSchema: launcher.definition.inputSchema as any,
        outputSchema: launcher.definition.outputSchema as any,
        annotations: launcher.definition.annotations as any,
      },
      launcher.handler as any,
    );
  }
}

export function registerPresentationApps(server: McpServer): void {
  registerPresentationAppResources(server);
  registerPresentationAppLaunchers(server);
}

export function listPresentationAppIds(): readonly PresentationAppId[] {
  return PRESENTATION_APP_IDS;
}
