import type { TalendAppSession } from "../domain/app-session.types";

export interface IAppSessionRepository {
  findById(id: string): Promise<TalendAppSession | null>;
  create(session: TalendAppSession): Promise<TalendAppSession>;
  update(session: TalendAppSession): Promise<TalendAppSession>;
  delete(id: string): Promise<void>;
  exists(id: string): Promise<boolean>;
}
