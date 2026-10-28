type ComponenteDePlantilla = { uniqueName: string; componentName: string; draftOnly?: boolean; draftReason?: string };
type ConexionDePlantilla = { source: string; target: string };

export type Omitido = { uniqueName: string; componentName: string; motivo: string };

/**
 * Quita de una plantilla los borradores cuyo componente no esta en el catalogo local.
 *
 * En Studio en vivo un borrador ausente del catalogo se omite (con sus conexiones) y el resto del job se
 * crea; el offline rechazaba el lote entero. Un componente ausente que NO es borrador sigue siendo un error:
 * `sinResolver` lista sus nombres.
 *
 * @param ausentes nombres de componente que el catalogo no conoce.
 */
export function sinBorradoresAusentes<
  T extends { components: ComponenteDePlantilla[]; connections?: ConexionDePlantilla[] },
>(plantilla: T, ausentes: ReadonlySet<string>): { plantilla: T; omitidos: Omitido[]; sinResolver: string[] } {
  const omitidos: Omitido[] = [];
  const sinResolver = new Set<string>();
  const omitidosPorNombre = new Set<string>();
  const components = plantilla.components.filter((componente) => {
    if (!ausentes.has(componente.componentName)) return true;
    if (!componente.draftOnly) {
      sinResolver.add(componente.componentName);
      return true;
    }
    omitidosPorNombre.add(componente.uniqueName);
    omitidos.push({
      uniqueName: componente.uniqueName,
      componentName: componente.componentName,
      motivo: `'${componente.componentName}' no esta en el catalogo local de Studio; se omite este borrador y sus conexiones`,
    });
    return false;
  });
  const connections = plantilla.connections?.filter(
    (conexion) => !omitidosPorNombre.has(conexion.source) && !omitidosPorNombre.has(conexion.target),
  );
  const limpia = components.map(({ draftOnly: _draftOnly, draftReason: _draftReason, ...resto }) => resto);
  return {
    plantilla: { ...plantilla, components: limpia, ...(connections ? { connections } : {}) } as T,
    omitidos,
    sinResolver: [...sinResolver],
  };
}
