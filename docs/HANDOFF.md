# Handoff: automatizar Talend Studio con el MCP

> Documento de traspaso entre sesiones. La fuente de verdad son el roadmap
> ([ROADMAP-DOMINIO-TALEND.md](ROADMAP-DOMINIO-TALEND.md)), el estado de las pruebas
> ([PLAN-DE-PRUEBAS.md](PLAN-DE-PRUEBAS.md)) y los descubrimiento sobre Studio
> ([TALEND-STUDIO-INTERNALS.md](TALEND-STUDIO-INTERNALS.md)).

## Objetivo

Controlar Talend Studio por completo desde el MCP: crear jobs, anadir y configurar cualquier componente, hasta
lo mas complejo. El dominio se mide con una matriz **componente x nivel** (L1 crear, L2 configurar, L3 conectar,
L4 compila, L5 ejecuta con la salida esperada).

## Documentacion a leer primero

1. `docs/GUIA-AGENTE.md`: como usar el MCP, el flujo, los errores y los limites.
2. `docs/ROADMAP-DOMINIO-TALEND.md`: el plan priorizado (P0 a P4).
3. `docs/TALEND-STUDIO-INTERNALS.md`: las secciones 26 a 33 son las nuevas.
4. `docs/PLAN-DE-PRUEBAS.md`: el estado por fase y por familia.
5. `AGENTS.md`: reglas del repo.

## Estado del repo

- Rama `main`, al dia con el remoto. `bun test` verde (301 tests). `bun x tsc --noEmit` pasa.
- Los tests de integracion contra el Studio real solo corren con `TALEND_BRIDGE_INTEGRATION=1`
  (`tests/integration/`). Con y sin Studio, `bun test` es verde.

## Entorno (Windows)

- Bun: `$env:PATH = "$env:USERPROFILE\.bun\bin;$env:PATH"`.
- JDK de Studio: `JAVA_HOME=C:\Talend\8.0.1\zulu21.50.19-ca-jdk21.0.11-win_x64`.
- Studio abierto; el bridge escucha en `127.0.0.1:3930` con token en `~/.talend-bridge/token`.
  `~/.talend-bridge/config.json` tiene `unsafeActions: true`.
- Compilar y recargar el plugin Java en caliente, sin reiniciar Studio (~5 s):
  ```bash
  bun run scripts/start.ts --install-bridge
  ```
- Llamar al bridge directo: `bun run scripts/bridge-call.ts /ruta @archivo.json`. En PowerShell hay que pasar el
  JSON por archivo, porque las comillas en linea se pierden.
- Para editar codigo Java con `\\` usa la herramienta Edit (las plantillas JS y `sed` pierden las barras).

## Lo que se ha hecho en esta sesion

### Las definiciones de los componentes, en disco (sin Studio)

Cada componente declara en su XML (`<nombre>_java.xml`, en la instalacion de Studio) que parametros son
obligatorios, con que valor, cuando se ven, que conexiones admite y que artefactos necesita.

- Nuevo modulo `src/modules/component-definitions/`: indice de las definiciones (1175 leidas, 777 de las Standard),
  plan de relleno de los parametros obligatorios y eleccion del conector de entrada y de salida.
- Nueva tool `talend_components_definition` y el script `scripts/component-definitions.ts`.
- Los parametros que Studio no declara como obligatorios (su `isRequired` es generoso) salen del XML.

### La cobertura mide L3 y L4 de verdad

`scripts/coverage.ts` monta cada componente en un job minimo (un `tFixedFlowInput` con schema si consume, un
`tLogRow` si el generador lo pide) y le rellena los parametros obligatorios del plan:

- `tFileOutputDelimited`, `tFileOutputRaw`, `tFileOutputLDIF`, `tFileOutputProperties` y `tFileOutputPositional`
  compilan (antes no: faltaba el `FILENAME` o el schema).
- `tFilterRow`, `tSortRow` y `tAggregateRow` compilan: sus tablas se rellenan con las columnas del schema.
- Los componentes de la generacion nueva (`JDBCInput` y compañía) compilan: el destino se anade cuando el
  generador dice "Missing output connection".
- Opciones: `--family`, `--components`, `--con-definicion`, `--max`, `--compile`, `--cancel`.
- Los componentes sin artefacto local tardan ~50 s cada uno (el generador busca el artefacto en Maven): por eso
  el catalogo entero no se mide de una vez.

### Conectar bien (un bug que rompia muchos jobs)

El **nombre** de la conexion (`row1`, `row2`...) es la variable de la fila en el codigo generado, y las tablas de
los componentes la referencian (`row1.monto`). El bridge la llamaba `conn_1` y las transformaciones no generaban
codigo. Ademas, el **conector** no siempre es `FLOW`: el `tUniqRow` saca sus filas por `UNIQUE`. Ver INTERNALS 32.

### Arnés de ejecucion (L5)

`scripts/execution-check.ts` monta un job, lo ejecuta y **compara la salida con la esperada** (declarada antes de
ejecutar). Los escenarios estan en `tests/fixtures/talend/escenarios-l5.json`; el informe sale en
`testdata/resultados-l5.csv`. Tres escenarios en verde: el de humo, el de leer un CSV y el de leer y escribir.

## Resultados medidos

| Nivel | Resultado |
|---|---|
| L1/L2 | 877 de 897 componentes Standard (98 %). Fallan 20 sin runtime de Maven (`components-jdbc-runtime:0.37.61`) |
| L3/L4 | Medidos por familias: 134 componentes de las nueve familias mas usadas, **134 se crean, guardan y borran, y 99 compilan (74 %)**. Los que no compilan: 12 son la mitad de un par (`tAggregateIn`, `tSortIn`...) y 17 necesitan una configuracion real (tablas, schema, contexto) |
| L5 | 3 escenarios con la salida verificada (humo, leer un CSV, leer y escribir un CSV). Pendiente el `tUniqRow` (el formato de su tabla `UNIQUE_KEY`) |

## Lo siguiente (por prioridad)

1. **L5 por familias**: el arnes ya funciona; faltan escenarios (el `tUniqRow`, el `tSortRow`, el `tAggregateRow`
   con sus tablas reales) y un Postgres de pruebas para los `tDB*`.
2. **Acabar el formato de las tablas de transformacion**: el `tUniqRow` sigue generando codigo que lee una
   columna suelta ("id cannot be resolved"). Con el `tSortRow` hay que usar los valores de su XML (`SORT` = "num",
   `ORDER` = "desc") y el prefijo de la conexion en el `COLNAME`.
3. **Tipos de job** (Spark Batch, Streaming): hoy `create` solo crea jobs Standard. Desbloquea las 397 variantes.
4. **Metadata del repositorio** (conexiones de base de datos, esquemas de archivo), imprescindible para los `tDB*`.
5. **Validar conexiones en `connect`**: la tool acepta un texto libre; con el indice de definiciones puede
   comprobar que el conector existe en el componente y que el nombre de la conexion es valido.
6. Otros, en el roadmap:
   - `tMap`: necesita `talend-tmap-dataset-1.2.16.jar` (de Talend Exchange).
   - Postgres de pruebas.
   - Los 120 componentes de la generacion nueva (los `.car`) no tienen XML: su definicion esta en el codigo Java.

## Cuidados

- Todo lo que hagas por el bridge afecta al Studio real del usuario. Los jobs de prueba `MCP_*` se borran con
  `/automation/job/delete`; borrar cierra sus editores. Si tocas un job que no es tuyo, pregunta.
- `readOnly` en `config.json` solo protege comandos, lanzamientos y `run-code`, **no** las rutas que crean o borran
  jobs y nodos.
- Cada vez que descubras algo de Studio, documentalo en `docs/TALEND-STUDIO-INTERNALS.md`: el usuario lo ha
  pedido repetidamente.
- El usuario escribe en espanol, con mensajes breves; responde en espanol.
