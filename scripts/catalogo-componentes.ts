/**
 * Genera el catalogo completo de componentes en `docs/catalogo-componentes/`.
 *
 * Une cuatro fuentes y deja un fichero por grupo de familias:
 *   - las definiciones XML instaladas en Studio (nombre, familia, paleta, parametros, conectores, librerias);
 *   - los informes de compilacion L4 (`testdata/cobertura-*.csv`);
 *   - los escenarios L5 (`tests/fixtures/talend/escenarios-l5/**.json`);
 *   - la prioridad y el plan de pruebas (reglas de este fichero).
 *
 * ```
 * bun run scripts/catalogo-componentes.ts
 * ```
 *
 * Es solo lectura sobre Studio: no necesita que este abierto. Los ficheros generados no se editan a mano;
 * los planes con la explicacion estan en `docs/plan-componentes/`.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DefinitionIndexRepository } from "../src/modules/component-definitions/infrastructure/definition-index.repository";
import type { ComponentDefinition } from "../src/modules/component-definitions/domain/component-definition.types";

const SALIDA = "docs/catalogo-componentes";

// ---------------------------------------------------------------- prioridad

/** Nivel 1 a 4 por nombre exacto. El resto se decide por familia (ver `nivelPorFamilia`). */
const NIVEL_POR_NOMBRE: Record<string, number> = {};
const fijar = (nivel: number, nombres: string) => {
  for (const nombre of nombres.split(/\s+/).filter(Boolean)) NIVEL_POR_NOMBRE[nombre] = nivel;
};
fijar(
  1,
  `tMap tFileInputDelimited tFileOutputDelimited tLogRow tFilterRow tFilterColumns tAggregateRow tSortRow tUniqRow tJoin
   tUnite tReplicate tNormalize tDenormalize tConvertType tRowGenerator tFixedFlowInput tReplace tReplaceList
   tExtractDelimitedFields tExtractRegexFields tSplitRow tSampleRow tDuplicateRow tJava tJavaRow tJavaFlex tRunJob
   tPrejob tPostjob tDie tWarn tSetGlobalVar tContextLoad tFlowToIterate tIterateToFlow tLoop tForeach tSleep tSendMail
   tSystem tParallelize tBufferInput tBufferOutput`,
);
fijar(
  2,
  `tLogCatcher tStatCatcher tAssert tAssertCatcher tFlowMeter tFlowMeterCatcher tChronometerStart tChronometerStop
   tSetEnv tSetProxy tSetKeystore tSetKerberosConfiguration tLibraryLoad tMemorizeRows tMsgBox tInfiniteLoop
   tWaitForSqlData tWaitForSocket tServerAlive tContextDump`,
);
fijar(
  3,
  `tFileInputExcel tFileOutputExcel tFileInputJSON tFileOutputJSON tFileInputXML tFileOutputXML tFileInputPositional
   tFileOutputPositional tFileInputFullRow tFileInputRaw tFileOutputRaw tFileInputRegex tFileInputProperties
   tFileOutputProperties tFileList tFileCopy tFileDelete tFileExist tFileTouch tFileCompare tFileArchive tFileUnarchive
   tFileProperties tFileRowCount tFileFetch tCreateTemporaryFile tChangeFileEncoding tWaitForFile tGPGDecrypt`,
);
fijar(
  4,
  `tXMLMap tWriteJSONField tWriteXMLField tExtractJSONFields tExtractXMLField tExtractPositionalFields
   tAdvancedFileOutputXML tXSLT tXSDValidator tDTDValidator tEDIFACTtoXML tSchemaComplianceCheck
   tPivotToColumnsDelimited tParseRecordSet`,
);

/** Motores de base de datos relacional que mas pesan en la banca (nivel 5, orden de trabajo). */
const MOTORES_PRIORITARIOS = ["Oracle", "MSSql", "DB2", "Postgresql", "Mysql", "JDBC", "Teradata"];

function nivelPorFamilia(c: ComponentDefinition): number {
  // Reglas por nombre, antes que las de familia: la familia de Studio agrupa cosas distintas.
  if (/^tSAPHana/.test(c.name)) return 5;
  if (/^t(File(Input|Output)(ARFF|LDIF|MS|Mail|Parquet|ORC|Shadow)|NamedPipe|ApacheLog|ExtractEDI)/.test(c.name)) return 3;
  if (/^t(FuzzyMatch|IntervalMatch|AddCRCRow|AddLocationFromIP|DuplicateRow|PatternCheck|RecordMatching|Survive|ThresholdViolation|StandardizePhoneNumber|Synonym|Data(Encrypt|Decrypt|Masking|Unmasking|Shuffling)|Pattern(Masking|Unmasking)|Address|Melissa|Qas|Uniserv)/.test(c.name)) return 11;
  if (/^t(BigQuery|CosmosDB|DynamoDB)/.test(c.name)) return 8;
  if (/^t(Cassandra|HBase|Hive|Impala|Mongo|Neo4j|Couchbase|ElasticSearch|Kudu|DeltaLake|Iceberg|Snowflake|Redis)/.test(c.name)) return 10;
  if (/^t(HttpRequest|REST|SOAP|WebService|XMLRPC|RSS|LDAP|POP)/.test(c.name)) return 9;
  if (/^t(Kafka|MapRStreams|Mom|JMS|MicrosoftMQ|JBossESB)/.test(c.name)) return 8;
  if (/^t(SAP|ELTSAP|Salesforce|MicrosoftCrm|ServiceNow|SVNLog|BarChart|LineChart|Jasper)/.test(c.name)) return 12;
  if (/^t(JobFailure|JobLog|JobReject|Syslog)/.test(c.name)) return 2;
  const familia = c.families.join("|");
  if (/^t(Oracle|MSSql|DB2|Postgresql|Mysql|JDBC|Teradata)/.test(c.name)) return 5;
  if (/Databases|Cloud\/Amazon\/RDS|DB_JDBC/i.test(familia)) return 5;
  if (/^ELT|ELT\//.test(familia) || c.name.startsWith("tELT") || c.name.startsWith("tSQLTemplate")) return 6;
  if (/^t(FTP|SCP|SSH|Socket)/.test(c.name)) return 7;
  if (/Cloud|Messaging|MOM|Storage|Dropbox|Box|AWS|Amazon|Google|Azure/i.test(familia)) return 8;
  if (/Internet|Business|ESB|Web ?Services|LDAP|SOAP|REST/i.test(familia)) return 9;
  if (/Big Data|NoSQL|MapReduce|Hadoop|Spark|Hive|Impala|HCatalog|ElasticSearch|Sqoop|Iceberg/i.test(familia)) return 10;
  if (/Data_Quality|Data_Privacy|Machine Learning/i.test(familia)) return 11;
  return 12;
}

const NIVELES: Record<number, string> = {
  1: "Nucleo de cualquier job",
  2: "Control, auditoria y ejecucion",
  3: "Archivos",
  4: "XML, JSON y mapeos complejos",
  5: "Bases de datos relacionales",
  6: "ELT y SQL",
  7: "Transferencia de ficheros",
  8: "Cloud y mensajeria",
  9: "APIs y servicios",
  10: "Big Data y NoSQL",
  11: "Calidad y privacidad de datos",
  12: "Resto de la paleta Standard (baja prioridad)",
  13: "Paletas Spark, Streaming y MapReduce",
};

// -------------------------------------------------------------------- planes

type Plan = { id: string; archivo: string; titulo: string };
const PLANES: Plan[] = [
  { id: "P01", archivo: "P01-nucleo-y-control.md", titulo: "Nucleo, control y auditoria" },
  { id: "P02", archivo: "P02-archivos.md", titulo: "Archivos, XML y JSON" },
  { id: "P03", archivo: "P03-bases-de-datos-relacionales.md", titulo: "Bases de datos relacionales" },
  { id: "P04", archivo: "P04-elt-y-sql.md", titulo: "ELT y SQL" },
  { id: "P05", archivo: "P05-transferencia-de-ficheros.md", titulo: "Transferencia de ficheros (FTP, SCP, SSH)" },
  { id: "P06", archivo: "P06-cloud-y-mensajeria.md", titulo: "Cloud y mensajeria" },
  { id: "P07", archivo: "P07-apis-y-servicios.md", titulo: "APIs, servicios y directorios" },
  { id: "P08", archivo: "P08-big-data-y-nosql.md", titulo: "Big Data y NoSQL" },
  { id: "P09", archivo: "P09-calidad-y-privacidad.md", titulo: "Calidad y privacidad de datos" },
  { id: "P10", archivo: "P10-paletas-no-di.md", titulo: "Paletas Spark, MapReduce y Streaming" },
  { id: "P11", archivo: "P11-negocio-y-legado.md", titulo: "Negocio (SAP, CRM), legado y resto" },
];

/** Nivel de un componente: 1 a 12 solo en la paleta Standard (DI); 13 para el resto de paletas. */
function nivelDe(c: ComponentDefinition): number {
  return c.palette !== "DI" ? 13 : (NIVEL_POR_NOMBRE[c.name] ?? nivelPorFamilia(c));
}

function planDe(c: ComponentDefinition, nivel: number): Plan {
  const por = (id: string) => PLANES.find((p) => p.id === id)!;
  if (c.palette !== "DI") return por("P10");
  switch (nivel) {
    case 1:
    case 2:
      return por("P01");
    case 3:
    case 4:
      return por("P02");
    case 5:
      return por("P03");
    case 6:
      return por("P04");
    case 7:
      return por("P05");
    case 8:
      return por("P06");
    case 9:
      return por("P07");
    case 10:
      return por("P08");
    case 11:
      return por("P09");
    default:
      return /SAP|Business|CRM|Deprecated|Salesforce|ServiceNow|Technical|Misc/i.test(c.families.join("|"))
        ? por("P11")
        : por("P01");
  }
}

// ----------------------------------------------------------------- mediciones

function leerCsv(texto: string): string[][] {
  const filas: string[][] = [];
  let campo = "";
  let fila: string[] = [];
  let comillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]!;
    if (comillas) {
      if (c === '"' && texto[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') comillas = false;
      else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === ",") {
      fila.push(campo);
      campo = "";
    } else if (c === "\n") {
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = "";
    } else if (c !== "\r") campo += c;
  }
  if (campo || fila.length) {
    fila.push(campo);
    filas.push(fila);
  }
  return filas;
}

type L4 = { estado: "compila" | "falla" | "sin medir"; error?: string };

function leerL4(): Map<string, L4> {
  const mapa = new Map<string, L4>();
  for (const fichero of readdirSync("testdata")) {
    if (!fichero.startsWith("cobertura") || !fichero.endsWith(".csv")) continue;
    const filas = leerCsv(readFileSync(join("testdata", fichero), "utf8"));
    const cabecera = filas[0] ?? [];
    const col = cabecera.indexOf("compila");
    const colError = cabecera.indexOf("error_compilacion");
    if (col < 0) continue;
    for (const fila of filas.slice(1)) {
      const nombre = fila[0];
      if (!nombre) continue;
      const previo = mapa.get(nombre);
      if (previo?.estado === "compila") continue;
      if (fila[col] === "si") mapa.set(nombre, { estado: "compila" });
      else if (fila[col] === "no") mapa.set(nombre, { estado: "falla", error: (fila[colError] ?? "").slice(0, 110) });
    }
  }
  return mapa;
}

function leerL5(): Map<string, string[]> {
  const mapa = new Map<string, string[]>();
  const recorrer = (dir: string) => {
    for (const entrada of readdirSync(dir, { withFileTypes: true })) {
      const ruta = join(dir, entrada.name);
      if (entrada.isDirectory()) recorrer(ruta);
      else if (entrada.name.endsWith(".json")) {
        const texto = readFileSync(ruta, "utf8");
        const pendiente = /"pendiente"\s*:\s*(true|"[^"]*")/.test(texto);
        for (const m of texto.matchAll(/"type":\s*"(t[A-Za-z0-9]+)"/g)) {
          const lista = mapa.get(m[1]!) ?? [];
          const etiqueta = ruta.split(/[\\/]escenarios-l5[\\/]/)[1]!.replace(/\\/g, "/") + (pendiente ? " (pendiente)" : "");
          if (!lista.includes(etiqueta)) lista.push(etiqueta);
          mapa.set(m[1]!, lista);
        }
      }
    }
  };
  recorrer("tests/fixtures/talend/escenarios-l5");
  return mapa;
}

// ------------------------------------------------------------------- salida

/** Servicio externo que hace falta para ejecutar (L5), deducido del nombre/familia. */
function servicioExterno(c: ComponentDefinition): string {
  const n = c.name;
  const f = c.families.join("|");
  if (/^t(Postgresql|Mysql|Oracle|MSSql|DB2|JDBC|Teradata|Sybase|Informix|Ingres|Vertica|Netezza|Greenplum|Redshift|Exasol|AzureSynapse|SQLite|Firebird|HSQLDb|JavaDB|MaxDB|Access|AS400|AmazonAurora|AmazonMysql|AmazonOracle|VectorWise)/.test(n))
    return "BD: contenedor, H2 o driver shim";
  if (/^tELT/.test(n)) return "BD: Postgres/MySQL/H2";
  if (/^t(FTP|SCP|SSH)/.test(n)) return "FTP/SFTP/SSH: contenedor";
  if (/^t(S3|SQS|DynamoDB|AmazonEMR|Kinesis)/.test(n)) return "AWS: LocalStack/moto";
  if (/^t(GS|BigQuery|GoogleDataproc|PubSub)/.test(n)) return "Google: emuladores";
  if (/^t(Dropbox|Box)/.test(n)) return "SaaS: servidor falso + proxy";
  if (/^t(Kafka|JMS|Mom|MicrosoftMQ)/.test(n)) return "broker: Kafka/ActiveMQ";
  if (/^t(MongoDB|Cassandra|HBase|Neo4j|Couchbase|ElasticSearch|Redis)/.test(n)) return "NoSQL: contenedor";
  if (/^t(Hive|Impala|HDFS|HCatalog|Sqoop|Hadoop)/.test(n)) return "Hadoop: compose/local";
  if (/^t(LDAP)/.test(n)) return "LDAP: contenedor";
  if (/SAP|Salesforce|ServiceNow|MicrosoftCrm|NetSuite/.test(n + f)) return "negocio: servidor falso/doble";
  if (/^t(HttpRequest|REST|SOAP|WebService|ESB|XMLRPC)/.test(n)) return "HTTP: servidor falso";
  if (/^t(SendMail|POP)/.test(n)) return "correo: MailHog/GreenMail";
  return "ninguno";
}

function fila(c: ComponentDefinition, l4: Map<string, L4>, l5: Map<string, string[]>): string {
  const esDi = c.palette === "DI";
  const medida = esDi ? l4.get(c.name) : undefined;
  const escenarios = esDi ? (l5.get(c.name) ?? []) : [];
  const nivel = nivelDe(c);
  const plan = planDe(c, nivel);
  const conectores = [...new Set(c.connectors.map((x) => x.type))].join(" ");
  const libs = c.imports.filter((i) => i.required).length;
  const estadoL4 = !esDi ? "n/a" : medida ? (medida.estado === "compila" ? "compila" : "falla") : "sin medir";
  const estadoL5 = !esDi ? "n/a" : escenarios.length === 0 ? "sin escenario" : escenarios.every((e) => e.includes("(pendiente)")) ? "pendiente" : "con escenario";
  const celdas = [
    `\`${c.name}\``,
    String(nivel),
    c.palette,
    c.parameters.length + "/" + c.requiredParameters.length,
    conectores || "-",
    libs > 0 ? String(libs) : "-",
    servicioExterno(c),
    estadoL4,
    estadoL5,
    plan.id,
  ];
  return `| ${celdas.join(" | ")} |`;
}

/** Familia principal normalizada: `Data Quality` y `Data_Quality` son el mismo grupo (y el mismo fichero). */
function grupoDe(c: ComponentDefinition): string {
  return ((c.family.split("/")[0] ?? "Otros").trim() || "Otros").replace(/_/g, " ");
}

const slug = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

async function main() {
  const repo = new DefinitionIndexRepository();
  const indice = await repo.load({ refresh: true });
  const componentes = [...indice.components].sort((a, b) => a.name.localeCompare(b.name));
  const l4 = leerL4();
  const l5 = leerL5();

  mkdirSync(SALIDA, { recursive: true });
  const porGrupo = new Map<string, ComponentDefinition[]>();
  for (const c of componentes) {
    const g = grupoDe(c);
    porGrupo.set(g, [...(porGrupo.get(g) ?? []), c]);
  }

  const cabecera =
    "| Componente | Nivel | Paleta | Params (oblig.) | Conectores | Libs oblig. | Servicio externo | L4 (compila) | L5 | Plan |\n|---|---|---|---|---|---|---|---|---|---|";

  const resumenGrupos: string[] = [];
  for (const [grupo, lista] of [...porGrupo].sort((a, b) => b[1].length - a[1].length)) {
    const nombre = `${slug(grupo)}.md`;
    const compilan = lista.filter((c) => c.palette === "DI" && l4.get(c.name)?.estado === "compila").length;
    const conL5 = lista.filter((c) => c.palette === "DI" && (l5.get(c.name) ?? []).some((e) => !e.includes("(pendiente)"))).length;
    const subfamilias = [...new Set(lista.map((c) => c.family))].sort();
    const texto = [
      `# Catalogo: ${grupo}`,
      "",
      "> Generado por `bun run scripts/catalogo-componentes.ts`. No lo edites: cambia el script o los datos de origen.",
      "",
      `${lista.length} componentes · ${compilan} compilan (L4) · ${conL5} con escenario L5 que pasa o esta definido.`,
      "",
      `Subfamilias: ${subfamilias.join(" · ")}`,
      "",
      cabecera,
      ...lista.map((c) => fila(c, l4, l5)),
      "",
    ].join("\n");
    writeFileSync(join(SALIDA, nombre), texto, "utf8");
    resumenGrupos.push(`| [${grupo}](${nombre}) | ${lista.length} | ${compilan} | ${conL5} |`);
  }

  // Resumen por nivel y por plan.
  const porNivel = new Map<number, ComponentDefinition[]>();
  const porPlan = new Map<string, ComponentDefinition[]>();
  for (const c of componentes) {
    const n = nivelDe(c);
    porNivel.set(n, [...(porNivel.get(n) ?? []), c]);
    const p = planDe(c, n).id;
    porPlan.set(p, [...(porPlan.get(p) ?? []), c]);
  }
  const estadoDe = (c: ComponentDefinition) => ({
    compila: c.palette === "DI" && l4.get(c.name)?.estado === "compila",
    l5: c.palette === "DI" && (l5.get(c.name) ?? []).some((e) => !e.includes("(pendiente)")),
  });

  const filasNivel = [...porNivel]
    .sort((a, b) => a[0] - b[0])
    .map(([n, lista]) => {
      const comp = lista.filter((c) => estadoDe(c).compila).length;
      const e5 = lista.filter((c) => estadoDe(c).l5).length;
      return `| ${n} | ${NIVELES[n]} | ${lista.length} | ${comp} | ${lista.length - comp} | ${e5} | ${lista.length - e5} |`;
    });
  const filasPlan = PLANES.map((p) => {
    const lista = porPlan.get(p.id) ?? [];
    const comp = lista.filter((c) => estadoDe(c).compila).length;
    const e5 = lista.filter((c) => estadoDe(c).l5).length;
    return `| [${p.id}](../plan-componentes/${p.archivo}) | ${p.titulo} | ${lista.length} | ${lista.length - comp} | ${lista.length - e5} |`;
  });

  const totalCompilan = componentes.filter((c) => estadoDe(c).compila).length;
  const totalL5 = componentes.filter((c) => estadoDe(c).l5).length;
  const porPaleta = new Map<string, number>();
  for (const c of componentes) porPaleta.set(c.palette, (porPaleta.get(c.palette) ?? 0) + 1);

  const fallos = componentes
    .filter((c) => c.palette === "DI" && l4.get(c.name)?.estado === "falla")
    .map((c) => `| \`${c.name}\` | ${(l4.get(c.name)?.error ?? "").replace(/\|/g, "/")} |`);
  writeFileSync(
    join(SALIDA, "fallos-conocidos-l4.md"),
    [
      "# Fallos de compilacion conocidos (L4)",
      "",
      "> Generado. Son los componentes que fallaron en TODAS las corridas de `testdata/cobertura-*.csv`. Muchos fallos antiguos",
      "> eran de arnes o de memoria de Studio: **vuelve a medir antes de dar uno por malo** (ver plan P00, paso 2).",
      "",
      "| Componente | Ultimo error |",
      "|---|---|",
      ...fallos,
      "",
    ].join("\n"),
    "utf8",
  );

  const lista = [
    "# Catalogo completo de componentes de Talend 8.0.1",
    "",
    "> Generado por `bun run scripts/catalogo-componentes.ts` a partir de las definiciones instaladas en Studio, los informes",
    "> `testdata/cobertura-*.csv` y los escenarios L5. **No se edita a mano**: se regenera. El plan para probarlos y",
    "> documentarlos esta en [../plan-componentes/README.md](../plan-componentes/README.md).",
    "",
    `Total: **${componentes.length}** componentes (${[...porPaleta].map(([p, n]) => `${p}: ${n}`).join(" · ")}).`,
    `Compilan en L4: **${totalCompilan}**. Con escenario L5: **${totalL5}**.`,
    "",
    "## Como leer las tablas",
    "",
    "| Columna | Significado |",
    "|---|---|",
    "| Nivel | Prioridad 1 (primero) a 12 (ultimo). Ver la tabla de niveles |",
    "| Paleta | `DI` = job Standard. El resto son Spark/Streaming: se prueban con otro plan |",
    "| Params (oblig.) | Parametros totales / obligatorios segun el XML de definicion |",
    "| Conectores | Tipos de enlace que admite (FLOW, ITERATE, REJECT, SUBJOB_OK...) |",
    "| Libs oblig. | Jars que el componente exige y que Studio puede tener que descargar |",
    "| Servicio externo | Que hay que levantar o emular para ejecutarlo de verdad (L5); el detalle esta en [EMULADORES.md](../plan-componentes/EMULADORES.md) |",
    "| L4 (compila) | Resultado historico de montar el componente en un job minimo y compilar |",
    "| L5 | `con escenario` = hay un escenario ejecutable; `pendiente` = definido pero no pasa aun. **Todo debe acabar ejecutado**: nada se queda en `solo compila` |",
    "| Plan | Plan de trabajo con el detalle de como probarlo (carpeta `docs/plan-componentes/`) |",
    "",
    "## Niveles de prioridad",
    "",
    "| Nivel | Descripcion | Componentes | Compilan | Sin compilar | Con L5 | Sin L5 |",
    "|---|---|---|---|---|---|---|",
    ...filasNivel,
    "",
    "## Por plan de trabajo",
    "",
    "| Plan | Alcance | Componentes | Sin compilar (L4) | Sin L5 |",
    "|---|---|---|---|---|",
    ...filasPlan,
    "",
    "## Por grupo de familias (un fichero cada uno)",
    "",
    "| Grupo | Componentes | Compilan (L4) | Con L5 |",
    "|---|---|---|---|",
    ...resumenGrupos,
    "",
    "Otros ficheros: [fallos-conocidos-l4.md](fallos-conocidos-l4.md).",
    "",
  ].join("\n");
  writeFileSync(join(SALIDA, "README.md"), lista, "utf8");

  console.log(`Catalogo: ${componentes.length} componentes en ${porGrupo.size} grupos -> ${SALIDA}/`);
  console.log(`Compilan ${totalCompilan} · con L5 ${totalL5} · fallos conocidos ${fallos.length}`);
}

await main();
