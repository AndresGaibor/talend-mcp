import { parseArgs } from "util";
import { getConfiguredProjectPath } from "../src/talend/workspace";
import {
  listRepositoryContexts,
  readRepositoryContext,
  createRepositoryContext,
  upsertRepositoryContextParameter,
  deleteRepositoryContextParameter,
  deleteRepositoryContext,
  formatRepositoryContext,
  formatRepositoryContextList,
} from "../src/talend/repository-contexts";

async function main() {
  const { values, positionals } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      help: { type: "boolean", short: "h" },
      purpose: { type: "string" },
      description: { type: "string" },
      type: { type: "string", default: "id_String" },
      context: { type: "string", default: "Default" },
    },
    allowPositionals: true,
  });

  const command = positionals[0];
  const projectPath = getConfiguredProjectPath();

  if (!projectPath) {
    console.error("Error: No se detectó TALEND_PROJECT.");
    process.exit(1);
  }

  if (values.help || !command) {
    console.log(`Uso: bun run contexts <comando> [args]

Comandos:
  list                      Lista todos los contextos de repositorio
  read <nombre>             Muestra el detalle de un contexto
  create <nombre>           Crea un contexto nuevo
  upsert <nombre> <key> <val>  Crea o actualiza una variable
  delete-parameter <nombre> <key> Borra una variable específica
  delete <nombre>           Elimina el contexto completo

Opciones:
  --purpose <texto>        Propósito del contexto (al crear)
  --description <texto>    Descripción (al crear)
  --type <tipo>            Tipo de dato (id_String, id_Password...)
  --context <nombre>       Nombre del bloque (Default)
`);
    return;
  }

  try {
    switch (command) {
      case "list": {
        const contexts = await listRepositoryContexts(projectPath);
        console.log(formatRepositoryContextList(contexts));
        break;
      }

      case "read": {
        const name = positionals[1];
        if (!name) throw new Error("Falta el nombre del contexto.");
        const ctx = await readRepositoryContext(projectPath, name);
        if (!ctx) throw new Error("Contexto no encontrado.");
        console.log(formatRepositoryContext(ctx));
        break;
      }

      case "create": {
        const name = positionals[1];
        if (!name) throw new Error("Falta el nombre del contexto.");
        await createRepositoryContext(projectPath, {
          name,
          purpose: values.purpose,
          description: values.description,
        });
        console.log(`✅ Contexto '${name}' creado.`);
        break;
      }

      case "upsert": {
        const [_, name, key, val] = positionals;
        if (!name || !key || val === undefined) throw new Error("Uso: upsert <nombre> <key> <val>");
        await upsertRepositoryContextParameter(projectPath, name, key, val, values.context, values.type);
        console.log(`✅ Variable '${key}' actualizada en '${name}'.`);
        break;
      }

      case "delete-parameter": {
        const [_, name, key] = positionals;
        if (!name || !key) throw new Error("Uso: delete-parameter <nombre> <key>");
        await deleteRepositoryContextParameter(projectPath, name, key, values.context);
        console.log(`✅ Variable '${key}' eliminada de '${name}'.`);
        break;
      }

      case "delete": {
        const name = positionals[1];
        if (!name) throw new Error("Falta el nombre del contexto.");
        await deleteRepositoryContext(projectPath, name);
        console.log(`✅ Contexto '${name}' eliminado.`);
        break;
      }

      default:
        console.error(`Comando desconocido: ${command}`);
    }
  } catch (e: any) {
    console.error(`❌ Error: ${e.message}`);
    process.exit(1);
  }
}

main();
