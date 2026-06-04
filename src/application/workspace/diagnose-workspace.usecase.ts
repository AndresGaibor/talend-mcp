import type { TalendEnvironmentReport } from "../../domain/analysis/analysis.entity";
import type { TalendWorkspace } from "../../domain/workspace/workspace.entity";
import { DomainError } from "../../domain/common/errors";

export interface WorkspaceResolver {
  resolve(path: string): Promise<TalendWorkspace>;
  isStudioPath(path: string): Promise<boolean>;
  getJobCount(projectPath: string): Promise<number>;
}

export class DiagnoseWorkspaceUseCase {
  constructor(private workspaceResolver: WorkspaceResolver) {}

  async execute(path: string): Promise<TalendEnvironmentReport> {
    if (!path) {
      throw new DomainError("Ruta de workspace es requerida");
    }

    const workspace = await this.workspaceResolver.resolve(path);
    const studioDetected = await this.workspaceResolver.isStudioPath(path);
    const jobCount = await this.workspaceResolver.getJobCount(workspace.projectPath);

    const hasMetadata = await this.verificarMetadata(workspace.metadataPath);

    return {
      workspacePath: workspace.workspacePath,
      projectPath: workspace.projectPath,
      projectName: workspace.projectName,
      hasMetadata,
      jobCount,
      isRepoMode: this.detectarModoRepo(workspace),
      studioDetected,
    };
  }

  private async verificarMetadata(metadataPath: string): Promise<boolean> {
    try {
      const response = await fetch(`file://${metadataPath}`);
      return response.ok;
    } catch {
      return false;
    }
  }

  private detectarModoRepo(workspace: TalendWorkspace): boolean {
    return workspace.projectPath.includes("/runtime/") ||
           workspace.projectPath.includes("/metadata/");
  }
}