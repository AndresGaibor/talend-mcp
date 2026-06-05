import type { IAppSessionRepository } from "../ports/app-session.repository.port";

export class ClearSessionUseCase {
  constructor(private readonly repository: IAppSessionRepository) {}

  async execute(sessionId: string): Promise<void> {
    await this.repository.delete(sessionId);
  }
}
