import type { TalendAppSession } from "../domain/app-session.types";
import type { IAppSessionRepository } from "../ports/app-session.repository.port";

const SESSION_FILE_PATH = "/tmp/talend-app-session.json";

export class FileAppSessionRepository implements IAppSessionRepository {
  private async readFile(): Promise<Record<string, TalendAppSession>> {
    try {
      const file = Bun.file(SESSION_FILE_PATH);
      const content = await file.text();
      return JSON.parse(content);
    } catch {
      return {};
    }
  }

  private async writeFile(data: Record<string, TalendAppSession>): Promise<void> {
    await Bun.write(SESSION_FILE_PATH, JSON.stringify(data, null, 2));
  }

  async findById(id: string): Promise<TalendAppSession | null> {
    const sessions = await this.readFile();
    return sessions[id] ?? null;
  }

  async create(session: TalendAppSession): Promise<TalendAppSession> {
    const sessions = await this.readFile();
    sessions[session.id] = session;
    await this.writeFile(sessions);
    return session;
  }

  async update(session: TalendAppSession): Promise<TalendAppSession> {
    const sessions = await this.readFile();
    sessions[session.id] = session;
    await this.writeFile(sessions);
    return session;
  }

  async delete(id: string): Promise<void> {
    const sessions = await this.readFile();
    delete sessions[id];
    await this.writeFile(sessions);
  }

  async exists(id: string): Promise<boolean> {
    const sessions = await this.readFile();
    return id in sessions;
  }
}
