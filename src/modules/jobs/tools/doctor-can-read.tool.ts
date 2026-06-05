import { okResult } from "../../../presentation/tools/common/result";
import { getConfiguredProjectPath, resolveWorkspaceFromProject } from "../../../talend/workspace";
import { existsSync } from "node:fs";

export const talendCanReadProjectTool = {
  name: "talend_can_read_project",
  description: "Verifica si se puede leer el proyecto actual.",
  inputSchema: { type: "object", properties: {} },
  handler: async () => {
    const projectPath = getConfiguredProjectPath();
    const exists = projectPath ? existsSync(projectPath) : false;
    return {
      content: [{ type: "text", text: JSON.stringify({ exists }) }],
      structuredContent: { exists },
      isError: false,
    };
  },
};

export const talendCanReadProcessTool = {
  name: "talend_can_read_process",
  description: "Verifica si se puede leer el directorio de procesos del proyecto.",
  inputSchema: { type: "object", properties: {} },
  handler: async () => {
    const projectPath = getConfiguredProjectPath();
    const exists = projectPath ? existsSync(`${projectPath}/process`) : false;
    return {
      content: [{ type: "text", text: JSON.stringify({ exists }) }],
      structuredContent: { exists },
      isError: false,
    };
  },
};

export const talendCanReadMetadataTool = {
  name: "talend_can_read_metadata",
  description: "Verifica si se puede leer el directorio .metadata del workspace.",
  inputSchema: { type: "object", properties: {} },
  handler: async () => {
    const projectPath = getConfiguredProjectPath();
    if (!projectPath) {
      return {
        content: [{ type: "text", text: JSON.stringify({ exists: false }) }],
        structuredContent: { exists: false },
        isError: false,
      };
    }
    const talendWorkspace = resolveWorkspaceFromProject(projectPath);
    const exists = existsSync(talendWorkspace.metadataPath);
    return {
      content: [{ type: "text", text: JSON.stringify({ exists }) }],
      structuredContent: { exists },
      isError: false,
    };
  },
};
