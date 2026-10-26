/**
 * Mide la cobertura de componentes de Talend que tiene el MCP.
 *
 *   bun run scripts/coverage.ts                    # todos los componentes
 *   bun run scripts/coverage.ts --filter tFile     # solo los que contienen ese texto
 *   bun run scripts/coverage.ts --max 50           # solo los primeros 50
 *   bun run scripts/coverage.ts --compile          # ademas genera el codigo y comprueba que compila (L4)
 *   bun run scripts/coverage.ts --family File/Input --solo-pendientes
 *   bun run scripts/coverage.ts --out informe.csv  # guarda el detalle
 *   bun run scripts/coverage.ts --solo-pendientes   # omite componentes ya compilados en una tanda anterior
 *   bun run scripts/coverage.ts --cancel           # para la medicion en marcha
 *
 * El informe sale en `testdata/cobertura.csv` con una fila por componente: si se pudo
 * crear, configurar, guardar en el job y borrar, y con que fallo. Para agrupar los
 * fallos por causa: `bun run scripts/coverage-summary.ts`.
 *
 * La medicion corre dentro de Studio (el bridge recorre el catalogo y monta un job de
 * pruebas) y tarda varios minutos. Se arranca y se consulta el progreso cada pocos
 * segundos: una sola peticion HTTP larga la cortaria el cliente a los 5 minutos.
 */

import { ejecutar } from "./coverage/cli";

try {
  await ejecutar(process.argv.slice(2));
} catch (error) {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
