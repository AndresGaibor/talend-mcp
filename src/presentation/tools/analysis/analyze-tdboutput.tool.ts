import { JobXmlRepository } from "../../../infrastructure/repositories/job-xml.repository";
import type { TdbOutputAnalysis } from "../../../domain/analysis/analysis.entity";
import type { ParsedJob, TalendComponent } from "../../../domain/job/job.entity";
import { ok, fail } from "../common/response";

/**
 * Los componentes que escriben en una base de datos.
 *
 * El nombre sigue el patron `t<Motor>Output` (tDBOutput, tMysqlOutput,
 * tPostgresqlOutput...). Los que se conectan a un repositorio no llevan los
 * parametros de conexion: entonces se avisa de ello.
 */
const OUTPUT_BASES = /^(tDBOutput|t[A-Za-z0-9]+Output|tDBRow|t[A-Za-z0-9]+Row|tDBCommit|t[A-Za-z0-9]+Commit|tDBRollback|t[A-Za-z0-9]+Rollback|tDBClose|t[A-Za-z0-9]+Close)$/;

/** Los que de verdad escriben filas. */
const ESCRITURA = /Output$/;

function esSalidaABase(componente: TalendComponent): boolean {
  return OUTPUT_BASES.test(componente.componentName) && ESCRITURA.test(componente.componentName);
}

/**
 * Analiza los componentes que escriben en una base de datos de un job.
 *
 * Saca la configuracion de conexion (host, puerto, base de datos, usuario) y
 * la tabla, que es lo que hace falta para saber a donde escribe el job.
 */
function analyzeTdbOutputs(job: ParsedJob): TdbOutputAnalysis[] {
  const analyses: TdbOutputAnalysis[] = [];
  for (const componente of job.components ?? []) {
    if (!esSalidaABase(componente)) continue;
    const parameters = componente.parameters ?? {};
    const schema = (componente.schemas ?? []).find((item) => item.connector === "FLOW");
    analyses.push({
      componentName: componente.componentName,
      uniqueName: componente.uniqueName,
      host: parameters.HOST,
      port: parameters.PORT,
      dbName: parameters.DBNAME ?? parameters.DATABASE,
      user: parameters.USER,
      table: parameters.TABLE,
      tableAction: parameters.TABLE_ACTION,
      dataAction: parameters.ACTION_ON_TABLE,
      batchSize: parameters.BATCH_SIZE,
      schema,
    });
  }
  return analyses;
}

export function createAnalyzeTdbOutputTool() {
  return {
    name: "talend_analyze_tdboutput",
    description: "Analiza los componentes tDBOutput (tMysqlOutput, tDBOutput) de un job para mostrar configuración de base de datos.",
    inputSchema: {
      type: "object",
      properties: {
        jobPath: { type: "string", description: "Ruta al archivo .item del job" },
      },
      required: ["jobPath"],
    },
    handler: async (input: { jobPath: string }) => {
      const start = Date.now();
      try {
        const jobRepo = new JobXmlRepository();
        const job: ParsedJob = await jobRepo.parseJob(input.jobPath);
        const tdbOutputs: TdbOutputAnalysis[] = analyzeTdbOutputs(job).map((o) => ({
          componentName: o.componentName,
          uniqueName: o.uniqueName,
          host: o.host,
          port: o.port,
          dbName: o.dbName,
          user: o.user,
          table: o.table,
          tableAction: o.tableAction,
          dataAction: o.dataAction,
          batchSize: o.batchSize,
          schema: o.schema,
        }));
        return ok({ tdbOutputs }, { startTime: start });
      } catch (err) {
        return fail("ANALYZE_TDBOUTPUT_ERROR", `Error analizando tDBOutput: ${err}`, { startTime: start });
      }
    },
  };
}
