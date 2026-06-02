import { readTextFile } from "../src/talend/files";
import { createTalendFolder, createTalendJob, deleteTalendJob, duplicateTalendJob, findTalendJob, moveTalendJobToFolder, renameTalendJob } from "../src/talend/job-crud";
import { listJobs, parseJobProperties } from "../src/talend/repository";
import { updateTalendJobPropertiesXml } from "../src/talend/editor";
import { getConfiguredProjectPath } from "../src/talend/workspace";

type Args = Record<string, string | boolean | undefined>;

function parseArgs(argv: string[]): { command?: string; positionals: string[]; options: Args } {
  const [command, ...rest] = argv;
  const positionals: string[] = [];
  const options: Args = {};

  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i]!;
    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }

    const key = token.slice(2);
    const next = rest[i + 1];
    if (next === undefined || next.startsWith("--")) {
      options[key] = true;
      continue;
    }

    options[key] = next;
    i += 1;
  }

  return { command, positionals, options };
}

function requireProjectPath(): string {
  const projectPath = getConfiguredProjectPath();
  if (!projectPath) throw new Error("No se detectó TALEND_PROJECT.");
  return projectPath;
}

function readOption(options: Args, key: string): string | undefined {
  const value = options[key];
  return typeof value === "string" ? value : undefined;
}

function printUsage(): void {
  console.log(`Uso:
  bun run jobs <comando> [args] [opciones]

Comandos:
  list
  read <jobName>
  create <jobName>
  update <jobName>
  rename <oldJobName> <newJobName>
  delete <jobName>
  duplicate <sourceJobName> <targetJobName>
  move <jobName> <folderPath>
  create-folder <folderPath>

Opciones:
  --folder-path <ruta>
  --source-folder-path <ruta>
  --version <x.y>
  --label <texto>
  --description <texto>
  --purpose <texto>
  --default-context <texto>

Ejemplos:
  bun run jobs read mi_job --folder-path carpeta_a
  bun run jobs create mi_job --folder-path carpeta_nueva
  bun run jobs duplicate mi_job mi_job_copia --source-folder-path carpeta_a --folder-path carpeta_b
  bun run jobs move mi_job carpeta_destino/subcarpeta
  bun run jobs create-folder carpeta_nueva/subcarpeta`);
}

async function main(): Promise<void> {
  const { command, positionals, options } = parseArgs(Bun.argv.slice(2));
  const projectPath = requireProjectPath();

  switch (command) {
    case "list": {
      console.log(JSON.stringify(await listJobs(projectPath), null, 2));
      break;
    }
    case "read": {
      const jobName = positionals[0];
      if (!jobName) throw new Error("Uso: bun run jobs read <jobName>");
      const folderPath = readOption(options, "folder-path");
      const target = await findTalendJob(projectPath, jobName, folderPath);
      if (!target) throw new Error(`Job no encontrado: ${jobName}`);
      const xml = await readTextFile(target.propertiesPath, projectPath);
      console.log(JSON.stringify({ ...target, ...parseJobProperties(xml, target.propertiesPath) }, null, 2));
      break;
    }
    case "create": {
      const jobName = positionals[0];
      if (!jobName) throw new Error("Uso: bun run jobs create <jobName> [--folder-path carpeta]");
      console.log(JSON.stringify(await createTalendJob(projectPath, {
        jobName,
        version: readOption(options, "version") ?? "0.1",
        defaultContext: readOption(options, "default-context"),
        label: readOption(options, "label"),
        description: readOption(options, "description"),
        purpose: readOption(options, "purpose"),
        folderPath: readOption(options, "folder-path"),
      }), null, 2));
      break;
    }
    case "update": {
      const jobName = positionals[0];
      if (!jobName) throw new Error("Uso: bun run jobs update <jobName> [--label ...]");
      const folderPath = readOption(options, "folder-path");
      const target = await findTalendJob(projectPath, jobName, folderPath);
      if (!target) throw new Error(`Job no encontrado: ${jobName}`);
      const xml = await readTextFile(target.propertiesPath, projectPath);
      const updated = updateTalendJobPropertiesXml(xml, {
        label: readOption(options, "label"),
        description: readOption(options, "description"),
        purpose: readOption(options, "purpose"),
      });
      await Bun.write(target.propertiesPath, updated);
      console.log(JSON.stringify({ propertiesPath: target.propertiesPath }, null, 2));
      break;
    }
    case "rename": {
      const oldJobName = positionals[0];
      const newJobName = positionals[1];
      if (!oldJobName || !newJobName) throw new Error("Uso: bun run jobs rename <oldJobName> <newJobName>");
      console.log(JSON.stringify(await renameTalendJob(projectPath, { oldJobName, newJobName, folderPath: readOption(options, "folder-path") }), null, 2));
      break;
    }
    case "duplicate": {
      const sourceJobName = positionals[0];
      const targetJobName = positionals[1];
      if (!sourceJobName || !targetJobName) throw new Error("Uso: bun run jobs duplicate <sourceJobName> <targetJobName>");
      console.log(JSON.stringify(await duplicateTalendJob(projectPath, {
        sourceJobName,
        sourceFolderPath: readOption(options, "source-folder-path"),
        targetJobName,
        targetVersion: readOption(options, "version"),
        targetFolderPath: readOption(options, "folder-path"),
      }), null, 2));
      break;
    }
    case "move": {
      const jobName = positionals[0];
      const folderPath = positionals[1] ?? readOption(options, "folder-path");
      if (!jobName || !folderPath) throw new Error("Uso: bun run jobs move <jobName> <folderPath>");
      console.log(JSON.stringify(await moveTalendJobToFolder(projectPath, { jobName, folderPath }), null, 2));
      break;
    }
    case "delete": {
      const jobName = positionals[0];
      if (!jobName) throw new Error("Uso: bun run jobs delete <jobName> [--folder-path carpeta]");
      console.log(JSON.stringify(await deleteTalendJob(projectPath, {
        jobName,
        folderPath: readOption(options, "folder-path"),
      }), null, 2));
      break;
    }
    case "create-folder": {
      const folderPath = positionals[0] ?? readOption(options, "folder-path");
      if (!folderPath) throw new Error("Uso: bun run jobs create-folder <folderPath>");
      console.log(JSON.stringify(createTalendFolder(projectPath, folderPath), null, 2));
      break;
    }
    default:
      printUsage();
  }
}

await main();
