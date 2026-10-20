# PLAN DE TRABAJO

Checklist para trabajar en `talend-mcp`. Complementa [AGENTS.md](../AGENTS.md).

## 1. Antes de empezar

```bash
bun install
bun run typecheck    # debe terminar sin errores
bun test             # debe estar verde
```

Si algo falla antes de tu cambio, es un problema preexistente: anotalo y sigue. No lo
"arregles" de paso, va en un commit aparte.

## 2. Clasifica la tarea

| Tipo | Donde va | Ejemplo |
|---|---|---|
| Tool nueva | `src/modules/<modulo>/tools/` | una consulta nueva al workspace |
| Tool nueva (legacy) | `src/presentation/tools/<area>/` | solo si no cabe en un modulo |
| App nueva | `src/presentation/apps/` | una vista HTML nueva |
| Logica de Talend | `src/talend/` | parseo de XML, reglas de diagnostico |
| Caso de uso | `src/modules/<modulo>/application/` | logica de negocio |
| Infraestructura | `src/infrastructure/` | filesystem, git, xml |
| Plugin Java | `talend-studio-bridge/` | capacidades nuevas del bridge |
| Documentacion | `docs/`, `README.md` | guias y referencias |

## 3. Receta: agregar una tool

1. **Caso de uso** en `src/modules/<modulo>/application/<nombre>.use-case.ts`.
   Sin logica de negocio en el handler de la tool.
2. **Tool** en `src/modules/<modulo>/tools/<nombre>.tool.ts`:

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

3. **Registro** en `getModuleTools()` de `src/server/registered-tools.ts`.
4. **Nombre** en `src/tools/tool-names.ts` si otras apps la usan.
5. **Test** en `tests/<area>/`.
6. **Verificacion**: `bun run typecheck` y `bun test`.

Reglas de naming: `talend_<area>_<verbo>`. Marca `readOnly: true` en toda tool que no escriba.

## 4. Receta: agregar una app

Ver [mcp-apps-ui.md](mcp-apps-ui.md). En resumen:

1. ID en `src/presentation/apps/app-types.ts`.
2. Definicion en `src/presentation/apps/definitions/`.
3. Shell en `src/presentation/apps/legacy-shells/` y dispatch en `legacy-app-shell.ts`.
4. Estado inicial en `src/presentation/apps/app-state.ts`.
5. Test en `tests/presentation/apps/app-registry.test.ts`.

## 5. Receta: cambiar el plugin Java

1. Edita el bundle en `talend-studio-bridge/com.andres.talend.bridge/src/`.
2. Compila e instala con el CLI:

   ```bash
   bun run scripts/start.ts --install-bridge
   ```

   El instalador detecta Talend Studio, compila con Maven + Tycho, desinstala la version
   anterior y instala la nueva. Cierra Talend Studio antes (el script lo ofrece).
3. Reinicia Talend Studio y verifica:

   ```bash
   curl http://127.0.0.1:3930/ping
   ```

Errores frecuentes del plugin:

| Sintoma | Causa | Que hacer |
|---|---|---|
| `ClassNotFoundException: ...Startup` | `plugin.xml` no entro en el jar | Revisar `bin.includes` en `build.properties` (una sola linea por clave) |
| El bridge no escucha en 3930 | El bundle es lazy y no hay extension `org.eclipse.ui.startup` | Verificar que `plugin.xml` este en el jar |
| `ProvisionException ... ubicacion de extension invalida` | Cache de p2 con una URI malformada | El instalador lo limpia; si persiste, borrar `configuration/org.eclipse.osgi/*/data/*` |
| `No se encontro Talend Studio` | Rutas no contempladas | Agregar la ruta en `studioCandidates()` de `scripts/install-bridge.ts` |

## 6. Verificacion antes de commitear

```bash
bun run typecheck
bun test
git status
```

Revisa que no queden archivos generados:

- `.talend-mcp/` (cache local)
- `talend-studio-bridge/**/target/`
- `apps-ui/dist` (ya no existe)

`scripts/clean-artifacts.ts` los borra.

## 7. Commits

Formato: `tipo: descripcion en imperativo` (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`,
`chore:`, `build:`).

Ejemplos:

```
feat: agrega talend_recipe_generate con patrones de ETL
fix: normaliza separadores en las comparaciones de rutas de job
test: agrega fixtures de Data Quality portables entre sistemas
docs: documenta el flujo de instalacion del plugin
```

## 8. Pendientes conocidos

Cosas que se detectaron al preparar el repo y siguen abiertas:

- Las tools de presentacion (`src/presentation/tools/`) y las canonicas de modulo conviven.
  La migracion esta documentada en [tool-migration.md](tool-migration.md) pero incompleta.
- `talend_list_launch_configs` devuelve una lista vacia; la implementacion real esta en
  `talend_bridge_launch_configs`.
- `talend_components_extract_schema` devuelve las columnas vacias: el catalogo no guarda el
  detalle de columnas de cada componente.
- Las apps HTML generadas en `legacy-shells/` no tienen cobertura automatizada.
- El build del plugin descarga metadata p2 de Eclipse, por lo que el job de CI del plugin es
  lento. Se puede cachear.
- `src/application/` y `src/domain/` tienen partes que solo sobreviven por el barrel
  `index.ts`; conviene terminar de podarlas o convertirlas en la capa canonica.
