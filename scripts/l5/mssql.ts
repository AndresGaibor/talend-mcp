/**
 * Preparacion de datos en el SQL Server de pruebas (contenedor `talend_mcp_mssql`).
 *
 * Bun.SQL no habla con SQL Server aqui, asi que las sentencias van a `sqlcmd`
 * dentro del contenedor. `-b` hace que un error de sentencia termine con codigo
 * distinto de 0, y eso corta la preparacion con el mensaje del servidor.
 */

const CONTENEDOR = process.env.L5_MSSQL_CONTENEDOR ?? "talend_mcp_mssql";
const CREDENCIALES = process.env.L5_MSSQL_CREDENCIALES ?? "-U talend -P talend -d talend_test";

async function sqlcmd(consulta: string, extra: string[] = []): Promise<{ codigo: number; salida: string }> {
  const proceso = Bun.spawn(
    ["docker", "exec", CONTENEDOR, "/opt/mssql-tools18/bin/sqlcmd", "-S", "localhost", ...CREDENCIALES.split(" "), "-C", "-b", ...extra, "-Q", consulta],
    { stdout: "pipe", stderr: "pipe", env: { ...process.env, MSYS_NO_PATHCONV: "1" } },
  );
  const [salida, errores, codigo] = await Promise.all([
    new Response(proceso.stdout).text(),
    new Response(proceso.stderr).text(),
    proceso.exited,
  ]);
  return { codigo, salida: (salida + errores).trim() };
}

export async function preparar(sentencias: string[]): Promise<{ ok: boolean; mensaje?: string }> {
  for (const sentencia of sentencias) {
    const { codigo, salida } = await sqlcmd(sentencia.trim().replace(/;+$/, "") + ";");
    if (codigo !== 0) {
      const linea = salida.split("\n").find((l) => /Msg \d+|Level/.test(l)) ?? salida;
      return { ok: false, mensaje: `la preparacion de la base SQL Server fallo: ${linea.trim()}` };
    }
  }
  return { ok: true };
}

/** Primera columna de la primera fila, o null si la consulta no devuelve nada o falla. */
export async function consultar(sentencia: string): Promise<string | number | null> {
  const { codigo, salida } = await sqlcmd(sentencia.trim().replace(/;+$/, "") + ";", ["-h", "-1", "-W"]);
  if (codigo !== 0) return null;
  const linea = salida.split("\n").map((l) => l.trim()).find((l) => l.length > 0 && !/rows? affected/.test(l));
  if (linea === undefined) return null;
  return /^-?\d+(\.\d+)?$/.test(linea) ? Number(linea) : linea;
}
