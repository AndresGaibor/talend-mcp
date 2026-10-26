/**
 * Workbench del IDE: editores, vistas, eventos y comandos.
 *
 * Todo lo que no toca el modelo del job vive aqui; las operaciones de job y
 * de nodos heredan de esta clase.
 */

import { BridgeTransportClient } from "./bridge-transport";
import type { BridgeCommand, BridgeLaunchConfig, BridgeResult, BridgeWorkbenchState } from "./bridge-types";

export class BridgeWorkbenchClient extends BridgeTransportClient {
  async workbenchState(): Promise<BridgeResult<BridgeWorkbenchState>> {
    return await this.request<BridgeWorkbenchState>("/workbench/state");
  }

  async selection(): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/workbench/selection");
  }

  async views(): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/workbench/views");
  }

  async commandsList(): Promise<BridgeResult<{ commands?: BridgeCommand[] }>> {
    return await this.request<{ commands?: BridgeCommand[] }>("/commands/list");
  }

  async executeCommand(commandId: string, dryRun: boolean): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/commands/execute", {
      method: "POST",
      body: { commandId, dryRun },
    });
  }

  async launchConfigs(): Promise<BridgeResult<{ configs?: BridgeLaunchConfig[] }>> {
    return await this.request<{ configs?: BridgeLaunchConfig[] }>("/launch/configs");
  }

  async runLaunchConfig(name: string, dryRun: boolean, mode = "run"): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/launch/run", {
      method: "POST",
      body: { name, mode, dryRun },
    });
  }

  async launchRuns(): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/launch/runs");
  }

  async launchRunStatus(launchId: string): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/launch/run-status", {
      method: "POST",
      body: { launchId },
    });
  }

  async launchWait(launchId: string, timeoutMs = 60000): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/launch/wait", {
      method: "POST",
      body: { launchId, timeoutMs },
    });
  }

  async openResource(path: string): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/workbench/open-resource", {
      method: "POST",
      body: { path },
    });
  }

  async workspaceState(): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/workspace/state");
  }

  async problemsMarkers(): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/problems/markers");
  }

  async probeClasses(): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/talend/probe/classes");
  }

  async activeEditorIntrospect(): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/talend/active-editor/introspect");
  }

  async eventsRecent(): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/events/recent");
  }

  async eventsClear(): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/events/clear");
  }

  async saveActiveEditor(): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/workbench/save-active");
  }

  async saveAllEditors(): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/workbench/save-all");
  }

  async findEditor(titleContains: string): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>(
      "/workbench/find-editor?titleContains=" + encodeURIComponent(titleContains),
    );
  }

  async activateEditor(title: string): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/workbench/activate-editor", {
      method: "POST",
      body: { title },
    });
  }

  async closeEditor(title: string, save = true): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/workbench/close-editor", {
      method: "POST",
      body: { title, save },
    });
  }

  async showView(viewId: string): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/workbench/show-view", {
      method: "POST",
      body: { viewId },
    });
  }

  async refreshWorkspace(): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/workspace/refresh");
  }

  /**
   * Lista los dialogos modales que bloquean Studio y cierra los conocidos.
   *
   * El guardian de modales del plugin hace esto solo cada poco; esto es para
   * forzarlo bajo demanda.
   */
  async dismissDialogs(): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/workbench/dialogs", {
      method: "POST",
      body: {},
    });
  }

  /**
   * Instala los modulos de terceros que Studio echa de menos.
   *
   * Necesario para los componentes cuyo runtime no esta descargado (los de
   * "processing": tMap, tJavaRow, tSortRow, tAggregateRow...).
   */
  async installModules(): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/workbench/modules/install", {
      method: "POST",
      body: {},
    });
  }
}
