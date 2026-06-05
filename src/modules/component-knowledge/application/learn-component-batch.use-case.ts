import { ComponentMasteryCacheRepository } from "../infrastructure/component-mastery-cache.repository";
import { inspectComponent, searchComponents } from "../../../talend/components/component-catalog-builder";
import { getComponentMastery, saveComponentMastery } from "../../../talend/mastery/component-mastery-runner";
import { createDefaultMastery } from "../../../talend/mastery/component-mastery-types";

export type BatchSession = {
  sessionId: string;
  batchToken: string;
  startedAt: number;
  totalComponents: number;
  processedCount: number;
  currentIndex: number;
  completed: boolean;
};

const BATCH_SIZE = 25;

export class LearnComponentBatchUseCase {
  private batchSize = BATCH_SIZE;
  private sessions: Map<string, BatchSession> = new Map();

  async start(sessionId: string): Promise<{ batchToken: string; components: string[]; total: number }> {
    const allComponents = await this.getAllComponents();
    const batchToken = crypto.randomUUID();
    const batch = allComponents.slice(0, this.batchSize);

    const session: BatchSession = {
      sessionId,
      batchToken,
      startedAt: Date.now(),
      totalComponents: allComponents.length,
      processedCount: 0,
      currentIndex: this.batchSize,
      completed: false,
    };
    this.sessions.set(sessionId, session);

    return {
      batchToken,
      components: batch,
      total: allComponents.length,
    };
  }

  async continue(sessionId: string, batchToken: string, fromIndex: number): Promise<{ components: string[]; hasMore: boolean; progress: number }> {
    const session = this.sessions.get(sessionId);
    if (!session || session.batchToken !== batchToken) {
      return { components: [], hasMore: false, progress: 0 };
    }

    const allComponents = await this.getAllComponents();
    const batch = allComponents.slice(fromIndex, fromIndex + this.batchSize);

    session.currentIndex = fromIndex + this.batchSize;
    session.processedCount = fromIndex;

    return {
      components: batch,
      hasMore: fromIndex + this.batchSize < allComponents.length,
      progress: Math.round((fromIndex / allComponents.length) * 100),
    };
  }

  async markProcessed(sessionId: string, componentName: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.processedCount++;
    }
  }

  async isSessionComplete(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    return session.currentIndex >= session.totalComponents;
  }

  async getSessionProgress(sessionId: string): Promise<{ processed: number; total: number; progress: number } | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    return {
      processed: session.processedCount,
      total: session.totalComponents,
      progress: Math.round((session.processedCount / session.totalComponents) * 100),
    };
  }

  async getUnprocessedComponents(): Promise<string[]> {
    const allComponents = await this.getAllComponents();
    const masteryRepo = new ComponentMasteryCacheRepository();
    const processed: string[] = [];

    for (const name of allComponents) {
      const mastery = await masteryRepo.getMastery(name);
      if (mastery && mastery.levels.discovered) {
        processed.push(name);
      }
    }

    return allComponents.filter(c => !processed.includes(c));
  }

  private async getAllComponents(): Promise<string[]> {
    const entries = await searchComponents("", 10000);
    return entries.map(e => e.componentName);
  }
}

export type LearnComponentResult = {
  componentName: string;
  mastery: Awaited<ReturnType<typeof getComponentMastery>>;
  templateGenerated: boolean;
  error?: string;
};

export async function learnSingleComponent(componentName: string): Promise<LearnComponentResult> {
  try {
    const entry = await inspectComponent(componentName);
    if (!entry) {
      return {
        componentName,
        mastery: createDefaultMastery(componentName),
        templateGenerated: false,
        error: "Componente no encontrado en catálogo",
      };
    }

    const mastery = await getComponentMastery(componentName);

    mastery.levels.discovered = true;
    mastery.levels.parametersParsed = entry.parameters.length > 0;

    await saveComponentMastery(mastery);

    return {
      componentName,
      mastery,
      templateGenerated: true,
    };
  } catch (e) {
    return {
      componentName,
      mastery: createDefaultMastery(componentName),
      templateGenerated: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
