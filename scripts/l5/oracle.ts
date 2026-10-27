/**
 * Preparacion de datos en el Oracle de pruebas (contenedor `talend_mcp_oracle`).
 *
 * Bun.SQL no habla Oracle, asi que las sentencias van a `sqlplus` dentro del
 * contenedor. Cada sentencia se termina con `;` y los bloques PL/SQL (`BEGIN`)
 * con `/`, que es lo que espera sqlplus. Un error ORA- corta la preparacion.
 */

const CONTENEDOR = process.env.L5_ORACLE_CONTENEDOR ?? "talend_mcp_oracle";
const CONEXION = process.env.L5_ORACLE_CONEXION ?? "talend/talend@localhost/FREEPDB1";

function comoSqlPlus(sentencia: string): string {
  const texto = sentencia.trim().replace(/;+$/, "");
  if (/^BEGIN\b/i.test(texto)) return `${texto};\n/\n`;
  return `${texto};\n`;
}

export async function preparar(sentencias: string[]): Promise<{ ok: boolean; mensaje?: string }> {
  const guion = ["WHENEVER SQLERROR EXIT SQL.SQLCODE", ...sentencias.map(comoSqlPlus), "EXIT;", ""].join("\n");
  const proceso = Bun.spawn(["docker", "exec", "-i", CONTENEDOR, "sqlplus", "-s", CONEXION], {
    stdin: new Blob([guion]),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [salida, errores, codigo] = await Promise.all([
    new Response(proceso.stdout).text(),
    new Response(proceso.stderr).text(),
    proceso.exited,
  ]);
  const error = /ORA-\d{5}|SP2-\d{4}/.exec(salida + errores);
  if (codigo !== 0 || error) {
    const linea = (salida + errores).split("\n").find((l) => /ORA-|SP2-/.test(l)) ?? salida.trim();
    return { ok: false, mensaje: `la preparacion de la base Oracle fallo: ${linea.trim()}` };
  }
  return { ok: true };
}

/** Primera columna de la primera fila, o null si la consulta no devuelve nada o falla. */
export async function consultar(sentencia: string): Promise<string | number | null> {
  const guion = [
    "WHENEVER SQLERROR EXIT SQL.SQLCODE",
    "SET HEADING OFF FEEDBACK OFF PAGESIZE 0 LINESIZE 500 TRIMSPOOL ON",
    `${sentencia.trim().replace(/;+$/, "")};`,
    "EXIT;",
    "",
  ].join("\n");
  const proceso = Bun.spawn(["docker", "exec", "-i", CONTENEDOR, "sqlplus", "-s", CONEXION], {
    stdin: new Blob([guion]),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [salida, codigo] = await Promise.all([new Response(proceso.stdout).text(), proceso.exited]);
  if (codigo !== 0 || /ORA-|SP2-/.test(salida)) return null;
  const linea = salida.split("\n").map((l) => l.trim()).find((l) => l.length > 0);
  if (linea === undefined) return null;
  return /^-?\d+(\.\d+)?$/.test(linea) ? Number(linea) : linea;
}
