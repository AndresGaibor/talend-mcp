/** Operaciones comunes contra el Postgres local de escenarios L5. */
function postgresUrl(): string {
  return process.env.L5_POSTGRES_URL ?? "postgres://talend:talend@127.0.0.1:5433/talend_test";
}

export async function consultar(sqlTexto: string): Promise<string | number | null> {
  try {
    const sql = new Bun.SQL(postgresUrl());
    try {
      const filas = (await sql.unsafe(sqlTexto)) as Array<Record<string, unknown>>;
      const primera = filas[0];
      if (!primera) return null;
      const valor = Object.values(primera)[0];
      return valor === null || valor === undefined ? null : (valor as string | number);
    } finally {
      await sql.close();
    }
  } catch {
    return null;
  }
}

export async function preparar(sentencias: string[]): Promise<{ ok: boolean; mensaje?: string }> {
  const sql = new Bun.SQL(postgresUrl());
  try {
    for (const sentencia of sentencias) await sql.unsafe(sentencia);
    return { ok: true };
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : String(error);
    return { ok: false, mensaje: `la preparacion de la base fallo: ${mensaje}` };
  } finally {
    await sql.close();
  }
}
