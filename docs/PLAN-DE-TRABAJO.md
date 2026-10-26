# PLAN DE TRABAJO

Checklist para trabajar en `talend-mcp`. Complementa [AGENTS.md](../AGENTS.md).

## 1. Antes de empezar

```bash
bun install
bun run verify       # typecheck + tests + fixtures; debe terminar sin errores
bun run l5:validar   # fixtures L5 bien formados (no abre Studio)
bun run doctor       # estado de Studio, bridge, MCP y configuracion
```

Si algo falla antes de tu cambio, es un problema preexistente: anotalo y sigue. No lo
"arregles" de paso, va en un commit aparte.

## 2. Clasifica la tarea

| Tipo | Donde va | Ejemplo |
|---|---|---|
| Tool de modulo | `src/modules/<modulo>/tools/` | una consulta nueva al workspace |
| Tool de estudio | `src/talend/studio/tools-<area>.ts` | algo que necesita el IDE en vivo |
| Logica de Talend | `src/talend/` | parseo de XML, reglas de diagnostico |
| Caso de uso | `src/modules/<modulo>/application/` | logica de negocio |
| Infraestructura | `src/infrastructure/` | filesystem, git, xml |
| Plugin Java | `talend-studio-bridge/` | capacidades nuevas del bridge |
| Documentacion | `docs/`, `README.md` | guias y referencias |

## 3. Receta: agregar una tool

1. **Caso de uso** en `src/modules/<modulo>/application/<nombre>.use-case.ts`.
   Sin logica de negocio en el handler de la tool.
2. **Tool** con schema Zod:

   ```typescript
   import { z } from "zod/v4";
   import type { CallToolResult } from "@modelcontextprotocol/server";

   export function createMiTool() {
     return {
       name: "talend_mi_cosa",
       description: "Que hace la tool, en una frase.",
       inputSchema: z.object({}),
       annotations: { readOnly: true },
       handler: async (input): Promise<CallToolResult> => ({
         content: [{ type: "text", text: "..." }],
         structuredContent: { ...payload },
         isError: false,
       }),
     };
   }
   ```

3. **Registro**:
   - Tools de modulo: `getModuleTools()` en `src/server/registered-tools.ts`.
   - Tools de estudio: el array `allTools` de `src/talend/studio/bridge-tools.ts`.
4. **Test** en `tests/<area>/`.
5. **Verificacion**: `bun run verify` (typecheck + tests + fixtures). Si el cambio es solo de tests,
   `bun run test:ci` corta en el primer fallo.

Reglas de naming: `talend_<area>_<verbo>`. Marca `readOnly: true` en toda tool que no escriba.
Si la capacidad ya existe, renombra la tool vieja en vez de crear una segunda.

Los mensajes de los CLI salen por `src/shared/cli/ui.ts`: `ui.ok` para lo que salio bien, `ui.warn`
para una degradacion que no impide seguir, `ui.fail` para un error, `ui.step` para el progreso y
`ui.debug` para trazas. No uses `console.log` ni colores propios: `TALEND_MCP_LOG` y `NO_COLOR`
solo funcionan si todos los scripts pasan por ese logger.

## 4. Receta: cambiar el plugin Java

1. Edita el bundle en `talend-studio-bridge/com.andres.talend.bridge/src/`.
2. Compila y publica con el CLI:

   ```bash
   bun run bridge:install
   ```

   El instalador detecta Talend Studio y elige la via segun el estado del IDE:

   - **Studio corriendo**: compila con `javac` (~8 s, 0 s si no cambiaron las fuentes) y copia el
     jar en `~/.talend-bridge/hot/bridge.jar`. El plugin lo detecta y se recarga solo
     (`Bundle.update`), asi que **no hay que reiniciar Studio**. Espera a que el ping confirme la
     version nueva; si no llega, avisa en vez de dar exito.
   - **Studio cerrado**: usa Maven + Tycho, desinstala la version anterior y instala la nueva con el
     p2 director.

   Opciones: `--maven` fuerza Maven/Tycho aunque Studio este abierto; `--force` recompila y
   recarga aunque las fuentes no hayan cambiado.

   `bun run start` hace esta misma actualizacion solo cuando el bridge no responde y Studio esta
   abierto: nunca lanza Maven ni p2 en el arranque. Desactivala con
   `TALEND_BRIDGE_AUTO_INSTALL=0` o `bun run start --skip-bridge`.

3. Verifica:

   ```bash
   curl http://127.0.0.1:3930/ping
   bun run doctor
   ```

Errores frecuentes del plugin:

| Sintoma | Causa | Que hacer |
|---|---|---|
| `ClassNotFoundException: ...Startup` | `plugin.xml` no entro en el jar | Revisar `bin.includes` en `build.properties` (una sola linea por clave) |
| El bridge no escucha en 3930 | El bundle es lazy y no hay extension `org.eclipse.ui.startup` | Verificar que `plugin.xml` este en el jar |
| `ProvisionException ... ubicacion de extension invalida` | Cache de p2 con una URI malformada | El instalador lo limpia; si persiste, borrar `configuration/org.eclipse.osgi/*/data/*` |
| `No se encontro Talend Studio` | Rutas no contempladas | Define `TALEND_STUDIO_HOME` con la carpeta que tiene `plugins/` y `features/`, o agrega la ruta en `studioHomeCandidates()` de `scripts/lib/studio-detect.ts` |
| El plugin no se recarga | Studio abierto con una versión vieja sin `HotReloadService` | Cerrar Studio, instalar con p2 y volver a abrir |

## 5. Verificacion antes de commitear

```bash
bun run verify
git status
```

Revisa que no queden archivos generados:

- `.talend-mcp/` (cache local)
- `talend-studio-bridge/**/target/`

`scripts/clean-artifacts.ts` los borra.

## 6. Commits

Formato: `tipo: descripcion en imperativo` (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`,
`chore:`, `build:`).

Ejemplos:

```
feat: agrega talend_recipe_generate con patrones de ETL
fix: normaliza separadores en las comparaciones de rutas de job
test: agrega fixtures de Data Quality portables entre sistemas
docs: documenta el flujo de instalacion del plugin
```

## 7. Pendientes conocidos

Cosas que se detectaron al preparar el repo y siguen abiertas:

- `src/modules/jobs/adapters/talend-xml-job.repository.ts` sigue siendo un stub: las tools de
  job usan la implementacion real de `src/infrastructure/repositories/job-xml.repository.ts`.
  Conviene unificar en una sola capa.
- `talend_jobs_detect_antipatterns` devuelve siempre la lista vacia: falta el detector real.
- `talend_components_extract_schema` devuelve las columnas vacias: el catalogo no guarda el
  detalle de columnas de cada componente.
- `talend_components_catalog_status` usa un cache de componentes en memoria; deberia persistir.
- Las tools de `src/modules/` y las de `src/talend/studio/` se registran en dos listas
  distintas; unificarlas reduciria la chance de duplicar capacidades.
- El build del plugin descarga metadata p2 de Eclipse, por lo que el job de CI del plugin es
  lento. Se puede cachear.
