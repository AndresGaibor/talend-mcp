/**
 * Prefijos de espacio de nombres que un XML usa en sus elementos y atributos sin haberlos declarado.
 *
 * Studio carga el `.item` con un parser de EMF estricto: un `xsi:type` sin `xmlns:xsi` hace que el recurso no se
 * cargue, el Job aparece con "Error when loading the job" (un dialogo modal que bloquea la interfaz) y al borrarlo
 * Studio deja el `.item` huerfano. El modo offline escribe archivos directamente, asi que se comprueba antes.
 *
 * Solo se miran los nombres dentro de las etiquetas: los valores entre comillas ("C:/datos/x.csv") y el texto no cuentan.
 */
export function prefijosSinDeclarar(xml: string): string[] {
  const sinComentarios = xml.replace(/<!--[\s\S]*?-->/g, "").replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "");
  const usados = new Set<string>();
  const declarados = new Set(["xml", "xmlns"]);

  for (const [etiqueta] of sinComentarios.matchAll(/<[^<>]+>/g)) {
    const sinValores = etiqueta.replace(/"[^"]*"/g, '""').replace(/'[^']*'/g, "''");
    for (const [, prefijo] of sinValores.matchAll(/xmlns:([\w.-]+)\s*=/g)) declarados.add(prefijo!);
    for (const [, prefijo] of sinValores.matchAll(/^<\/?([A-Za-z_][\w.-]*):[\w.-]+/g)) usados.add(prefijo!);
    for (const [, prefijo] of sinValores.matchAll(/\s([A-Za-z_][\w.-]*):[\w.-]+\s*=/g)) usados.add(prefijo!);
  }
  return [...usados].filter((prefijo) => !declarados.has(prefijo));
}
