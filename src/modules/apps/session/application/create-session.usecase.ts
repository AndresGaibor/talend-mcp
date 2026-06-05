import type { TalendAppSession, CreateSessionOptions } from "../domain/app-session.types";
import type { IAppSessionRepository } from "../ports/app-session.repository.port";

export class CreateSessionUseCase {
  constructor(private readonly repository: IAppSessionRepository) {}

  async execute(options?: CreateSessionOptions): Promise<TalendAppSession> {
    const session: TalendAppSession = {
      id: options?.id ?? "default",
      projectPath: options?.projectPath,
    };
    return await this.repository.create(session);
  }
}
