import type { McpToolDefinition } from "../../../server/adapt-tool";
import type { TalendResult } from "../../../shared/contracts/result.contract";
import type { GuideToolSummary } from "../domain/guide.types";
import { renderEnvironment } from "./build-guide/environment.renderer";
import { renderOverview } from "./build-guide/overview.renderer";
import { renderRules } from "./build-guide/rules.renderer";
import { renderSearch } from "./build-guide/search.renderer";
import { collectToolSummaries } from "./build-guide/state-collector";
import { renderTask } from "./build-guide/task.renderer";
import { renderDescribeTool } from "./build-guide/tool.renderer";

/**
 * Fachada de la guía para agentes: recolecta las tools expuestas y delega el
 * cálculo de cada modo en su renderizador.
 */
export class BuildGuideUseCase {
  constructor(private readonly listTools: () => McpToolDefinition[]) {}

  private tools(): GuideToolSummary[] {
    return collectToolSummaries(this.listTools);
  }

  overview(): TalendResult {
    return renderOverview(this.tools());
  }

  task(query: string): TalendResult {
    return renderTask(query, this.listTools);
  }

  search(query: string, limit = 15): TalendResult {
    return renderSearch(query, limit, this.tools());
  }

  describeTool(name: string, includeSchema = true): TalendResult {
    return renderDescribeTool(name, includeSchema, this.listTools);
  }

  rules(taskId?: string): TalendResult {
    return renderRules(taskId);
  }

  async environment(): Promise<TalendResult> {
    return renderEnvironment();
  }
}
