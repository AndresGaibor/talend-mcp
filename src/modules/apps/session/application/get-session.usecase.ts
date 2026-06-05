import type { TalendAppSession, GetSessionOptions } from "../domain/app-session.types";
import type { IAppSessionRepository } from "../ports/app-session.repository.port";

export class GetSessionUseCase {
  constructor(private readonly repository: IAppSessionRepository) {}

  async execute(sessionId: string, options?: GetSessionOptions): Promise<TalendAppSession | null> {
    return await this.repository.findById(sessionId);
  }
}
