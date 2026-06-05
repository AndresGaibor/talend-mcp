import { loadBridge } from "./tools-base";
import type { TalendStudioBridgeClient } from "../studio/bridge-client";

export interface ActiveJobComponent {
  id: string;
  label: string;
  componentName: string;
  x: number;
  y: number;
  parameters: Record<string, unknown>;
  schema?: Record<string, unknown>;
  connectors?: Record<string, unknown>;
}

export interface ActiveJobConnection {
  from: string;
  to: string;
  connectorType: string;
}

export interface ActiveJobDetails {
  jobName: string;
  uniqueName: string;
  components: ActiveJobComponent[];
  connections: ActiveJobConnection[];
}

export interface ComponentDetails {
  id: string;
  label: string;
  componentName: string;
  uniqueName: string;
  x: number;
  y: number;
  parameters: Record<string, unknown>;
  schema?: Record<string, unknown>;
  schemas?: Record<string, unknown>;
  connectors?: Record<string, unknown>;
  incomingConnections?: ActiveJobConnection[];
  outgoingConnections?: ActiveJobConnection[];
  raw?: Record<string, unknown>;
}

export class JobInspectorService {
  private bridge: TalendStudioBridgeClient | null = null;

  private async getBridge(): Promise<TalendStudioBridgeClient> {
    if (!this.bridge) {
      this.bridge = await loadBridge();
    }
    return this.bridge;
  }

  async getActiveJobDetails(): Promise<ActiveJobDetails> {
    const bridge = await this.getBridge();
    const jobResult = await bridge.activeJobModel();

    if (!jobResult.ok || !jobResult.data?.job) {
      throw new Error("No se pudo obtener el job activo");
    }

    const jobModel = jobResult.data.job as Record<string, unknown>;
    const jobUniqueName = (jobModel.uniqueName as string) ?? (jobModel.label as string);

    const componentsResult = await bridge.activeJobDetails();
    const components: ActiveJobComponent[] = [];
    const connections: ActiveJobConnection[] = [];

    if (componentsResult.ok && componentsResult.data) {
      const data = componentsResult.data as Record<string, unknown>;

      if (Array.isArray(data.components)) {
        for (const comp of data.components as Record<string, unknown>[]) {
          components.push({
            id: (comp.id as string) ?? "",
            label: (comp.label as string) ?? "",
            componentName: (comp.componentName as string) ?? "",
            x: (comp.x as number) ?? 0,
            y: (comp.y as number) ?? 0,
            parameters: (comp.parameters as Record<string, unknown>) ?? {},
            schema: comp.schema as Record<string, unknown>,
            connectors: comp.connectors as Record<string, unknown>,
          });
        }
      }

      if (Array.isArray(data.connections)) {
        for (const conn of data.connections as Record<string, unknown>[]) {
          connections.push({
            from: (conn.from as string) ?? "",
            to: (conn.to as string) ?? "",
            connectorType: (conn.connectorType as string) ?? "",
          });
        }
      }
    }

    return {
      jobName: (jobModel.label as string) ?? "",
      uniqueName: jobUniqueName,
      components,
      connections,
    };
  }

  async getComponentDetails(uniqueName: string, includeRaw = false): Promise<ComponentDetails> {
    const bridge = await this.getBridge();
    const result = await bridge.activeComponentDetails(uniqueName, includeRaw);

    if (!result.ok || !result.data?.component) {
      throw new Error(`No se pudieron obtener detalles del componente: ${uniqueName}`);
    }

    const comp = result.data.component as Record<string, unknown>;

    return {
      id: (comp.id as string) ?? "",
      label: (comp.label as string) ?? "",
      componentName: (comp.componentName as string) ?? "",
      uniqueName: (comp.uniqueName as string) ?? uniqueName,
      x: (comp.x as number) ?? 0,
      y: (comp.y as number) ?? 0,
      parameters: (comp.parameters as Record<string, unknown>) ?? {},
      schema: comp.schema as Record<string, unknown>,
      schemas: comp.schemas as Record<string, unknown>,
      connectors: comp.connectors as Record<string, unknown>,
      incomingConnections: comp.incomingConnections as ActiveJobConnection[],
      outgoingConnections: comp.outgoingConnections as ActiveJobConnection[],
      raw: includeRaw ? (comp.raw as Record<string, unknown>) : undefined,
    };
  }

  async getComponentParameters(uniqueName: string): Promise<Record<string, unknown>> {
    const details = await this.getComponentDetails(uniqueName);
    return details.parameters;
  }

  async getComponentSchemas(uniqueName: string): Promise<Record<string, unknown> | undefined> {
    const details = await this.getComponentDetails(uniqueName);
    return details.schema ?? details.schemas;
  }

  async getComponentConnections(uniqueName: string): Promise<{
    incoming: ActiveJobConnection[];
    outgoing: ActiveJobConnection[];
  }> {
    const details = await this.getComponentDetails(uniqueName);
    return {
      incoming: details.incomingConnections ?? [],
      outgoing: details.outgoingConnections ?? [],
    };
  }
}

let inspectorInstance: JobInspectorService | null = null;

export function getJobInspector(): JobInspectorService {
  if (!inspectorInstance) {
    inspectorInstance = new JobInspectorService();
  }
  return inspectorInstance;
}
