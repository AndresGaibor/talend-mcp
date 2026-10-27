/**
 * Preparacion de datos en el Db2 de pruebas (contenedor `talend_mcp_db2`, base `TALEND`).
 *
 * Las sentencias van al CLP `db2` dentro del contenedor, como el usuario de
 * instancia `db2inst1`. Se usa `@` como terminador de sentencia (`-td@`) para que
 * los procedimientos con `BEGIN ... END` lleven `;` dentro. Db2 no tiene
 * `DROP TABLE IF EXISTS`: esa forma se resuelve aqui mirando el catalogo antes de borrar.
 */

const CONTENEDOR = process.env.L5_DB2_CONTENEDOR ?? "talend_mcp_db2";
const BASE = process.env.L5_DB2_BASE ?? "TALEND";

async function ejecutar(args: string[]): Promise<{ codigo: number; salida: string }> {
  const proceso = Bun.spawn(["docker", ...args], { stdout: "pipe", stderr: "pipe", env: { ...process.env, MSYS_NO_PATHCONV: "1" } });
  const [salida, errores, codigo] = await Promise.all([
    new Response(proceso.stdout).text(),
    new Response(proceso.stderr).text(),
    proceso.exited,
  ]);
  return { codigo, salida: (salida + errores).trim() };
}

/** Copia un guion al contenedor y lo ejecuta con el CLP como db2inst1. */
async function correrEnContenedor(guion: string, opciones: string): Promise<{ codigo: number; salida: string }> {
  const nombre = `l5-${crypto.randomUUID()}.sql`;
  const local = `${process.env.TEMP ?? "/tmp"}/${nombre}`;
  await Bun.write(local, guion);
  await ejecutar(["cp", local, `${CONTENEDOR}:/tmp/${nombre}`]);
  return ejecutar([
    "exec",
    CONTENEDOR,
    "su",
    "-",
    "db2inst1",
    "-c",
    `db2 connect to ${BASE} >/dev/null && db2 ${opciones} -f /tmp/${nombre}; rc=$?; db2 connect reset >/dev/null; rm -f /tmp/${nombre}; exit $rc`,
  ]);
}

export async function preparar(sentencias: string[]): Promise<{ ok: boolean; mensaje?: string }> {
  const pendientes: string[] = [];
  for (const sentencia of sentencias) {
    const borrar = /^DROP (TABLE|PROCEDURE) IF EXISTS\s+(\w+)/i.exec(sentencia.trim());
    if (borrar) {
      const tipo = borrar[1]!.toUpperCase();
      const catalogo = tipo === "TABLE" ? "SYSCAT.TABLES WHERE TABNAME" : "SYSCAT.PROCEDURES WHERE PROCNAME";
      const existe = await consultar(`SELECT COUNT(*) FROM ${catalogo} = '${borrar[2]!.toUpperCase()}'`);
      if (existe === 0 || existe === null) continue;
      pendientes.push(`DROP ${tipo} ${borrar[2]}`);
      continue;
    }
    pendientes.push(sentencia);
  }
  if (pendientes.length === 0) return { ok: true };
  const guion = pendientes.map((s) => `${s.trim().replace(/;+$/, "")}\n@`).join("\n") + "\n";
  const { codigo, salida } = await correrEnContenedor(guion, "-x -td@");
  const error = /SQL\d{4,5}N|SQL\d{4,5}C/.exec(salida);
  if (codigo !== 0 || error) {
    const linea = salida.split("\n").find((l) => /SQL\d/.test(l)) ?? salida;
    return { ok: false, mensaje: `la preparacion de la base Db2 fallo: ${linea.trim()}` };
  }
  return { ok: true };
}

/** Primera columna de la primera fila, o null si la consulta no devuelve nada o falla. */
export async function consultar(sentencia: string): Promise<string | number | null> {
  const { codigo, salida } = await correrEnContenedor(`${sentencia.trim().replace(/;+$/, "")}\n@\n`, "-x -td@");
  if (codigo !== 0 || /SQL\d{4,5}N/.test(salida)) return null;
  const linea = salida.split("\n").map((l) => l.trim()).find((l) => l.length > 0);
  if (linea === undefined) return null;
  return /^-?\d+(\.\d+)?$/.test(linea) ? Number(linea) : linea;
}
