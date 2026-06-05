import type { TalendAppSession, UpdateSessionOptions } from "../domain/app-session.types";
import type { IAppSessionRepository } from "../ports/app-session.repository.port";

export class UpdateSessionUseCase {
  constructor(private readonly repository: IAppSessionRepository) {}

  async execute(sessionId: string, options: UpdateSessionOptions): Promise<TalendAppSession | null> {
    const existing = await this.repository.findById(sessionId);
    if (!existing) {
      return null;
    }
    const updated: TalendAppSession = {
      ...existing,
      ...options,
    };
    return await this.repository.update(updated);
  }
}
