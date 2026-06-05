import { TalendStudioBridgeClient } from "../studio/bridge-client";

let uiDriverInstance: UiDriver | undefined;

export class UiDriver {
  private bridge: TalendStudioBridgeClient | null = null;

  async getBridge(): Promise<TalendStudioBridgeClient> {
    if (!this.bridge) {
      this.bridge = await TalendStudioBridgeClient.create();
    }
    return this.bridge;
  }

  async selectComponent(componentId: string): Promise<void> {
    const bridge = await this.getBridge();
    await bridge.selectComponent(componentId);
  }

  async openComponentSettings(componentId: string): Promise<void> {
    const bridge = await this.getBridge();
    const result = await bridge.executeCommand("org.talend.studio.open.component.settings", false);
    if (!result.ok) {
      throw new Error(result.error?.message ?? "Failed to open component settings");
    }
  }

  async showView(viewName: "Problems" | "Run" | "Console"): Promise<void> {
    const bridge = await this.getBridge();
    const viewId = this.getViewId(viewName);
    await bridge.showView(viewId);
  }

  async activateEditor(editorId: string): Promise<void> {
    const bridge = await this.getBridge();
    await bridge.activateEditor(editorId);
  }

  async saveActiveEditor(): Promise<void> {
    const bridge = await this.getBridge();
    await bridge.saveActiveEditor();
  }

  async refreshWorkspace(): Promise<void> {
    const bridge = await this.getBridge();
    await bridge.refreshWorkspace();
  }

  private getViewId(viewName: "Problems" | "Run" | "Console"): string {
    const viewIds: Record<string, string> = {
      Problems: "org.eclipse.ui.views.ProblemView",
      Run: "org.eclipse.debug.ui.DebugView",
      Console: "org.eclipse.ui.console.ConsoleView",
    };
    return viewIds[viewName] ?? viewName;
  }
}

export function getUiDriver(): UiDriver {
  if (!uiDriverInstance) {
    uiDriverInstance = new UiDriver();
  }
  return uiDriverInstance;
}