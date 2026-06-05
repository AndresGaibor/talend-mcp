import type { TalendAppSession } from "../domain/app-session.types";
import type { IAppSessionRepository } from "../ports/app-session.repository.port";
import { join } from "path";
import { mkdirSync } from "fs";

function getSessionFilePath(): string {
  const baseDir = process.env.TALEND_MCP_DIR || process.cwd();
  const dir = join(baseDir, ".talend-mcp");
  mkdirSync(dir, { recursive: true });
  return join(dir, "app-sessions.json");
}

export class FileAppSessionRepository implements IAppSessionRepository {
  private async readFile(): Promise<Record<string, TalendAppSession>> {
    try {
      const file = Bun.file(getSessionFilePath());
      const content = await file.text();
      return JSON.parse(content);
    } catch {
      return {};
    }
  }

  private async writeFile(data: Record<string, TalendAppSession>): Promise<void> {
    await Bun.write(getSessionFilePath(), JSON.stringify(data, null, 2));
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
