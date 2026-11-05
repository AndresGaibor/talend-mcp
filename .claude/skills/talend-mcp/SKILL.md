---
name: talend-mcp
description: Usa el servidor MCP talend-mcp para inspeccionar, crear, editar, compilar y ejecutar jobs de Qlik Talend Studio. Úsala cuando la tarea mencione jobs, componentes, esquemas, contextos, ejecuciones o migraciones de Talend, o cuando haya que decidir entre trabajar offline sobre el proyecto y hacerlo en vivo con Studio.
---

# Usar talend-mcp

El repositorio ejecuta un servidor MCP local (`bun run index.ts`) que lee y escribe proyectos de
Qlik Talend Studio sobre `process/*.item` y, con Studio abierto, a través del plugin Java del
bridge. Este repo ya trae el servidor registrado en `.mcp.json` con el preset `agent` por stdio.

Usa esta skill para **operar** sobre un proyecto Talend. Para **cambiar el código del servidor**,
la fuente de verdad es `AGENTS.md` del repositorio, no este archivo.

## Cuándo usarla

- Inspeccionar un job, sus componentes, conexiones o contextos.
- Crear, editar, compilar o ejecutar jobs, uno o en lote.
- Comprobar si un componente está soportado y qué parámetros acepta.
- Migrar familias de jobs o replicar una plantilla.
- Diagnosticar por qué un job no compila, no ejecuta o termina con avisos.

No la uses para redactar documentos, ni para tareas que no toquen Talend. Si el MCP no responde,
la CLI sigue disponible para lectura (ver más abajo).

## Primer paso, siempre

1. `talend_guide { mode: "overview" }` — mapa de tareas. Si hay un proyecto configurado, devuelve
   el estado del entorno y las tools expuestas por el preset.
2. `talend_guide { mode: "task", task: "<id>" }` — secuencia exacta de una tarea. Ids útiles:
   `crear-job`, `editar-job`, `migracion-masiva`. Acepta texto libre ("crear un job").
3. `talend_guide { mode: "rules" }` — reglas de configuración que evitan fallos silenciosos.
4. `talend_diagnose_environment {}` y `talend_bridge_ping {}` antes de tocar Studio.

Si `talend_diagnose_environment` dice que no hay proyecto, abre el proyecto en Studio o pide al
usuario la ruta y define `TALEND_PROJECT` (la carpeta que contiene `talend.project`) en `.env.local`,
que Bun carga solo. No inventes rutas.

## Estrategia mixta (la decisión que más importa)

| Trabajo | Camino | Tools |
|---|---|---|
| Migraciones, lotes, jobs cerrados, cambios repetidos | **Offline** | `talend_jobs_create_from_spec`, `talend_jobs_create_batch`, `talend_job_edit_offline`, `talend_jobs_edit_batch`, `talend_job_build_batch` |
| Un job abierto en un editor de Studio | **Studio en vivo** | `talend_job_create_in_studio`, `talend_job_add_node`, `talend_job_configure_node`, `talend_job_connect_nodes`, `talend_job_execute` |
| Componentes que Studio configura al conectar (`tMap`, esquemas dinámicos) | **Studio en vivo** | las mismas de arriba |

Nunca edites en disco un job abierto en un editor: Studio lo pisaría al guardar. Las tools offline
lo detectan y responden `JOB_OPEN_IN_STUDIO`; en ese caso usa `mode: "studio"` o pide cerrar el editor.

## Tools canónicas del preset `agent`

| Tool | Entrada | Qué hace |
|---|---|---|
| `talend_job_inspect` | `{ job, folderPath?, detail?: "summary" \| "full" }` | Componentes, conexiones y contextos del job |
| `talend_component_describe` | `{ name }` | Definición del componente: parámetros y valores válidos. Úsala antes de configurar; no adivines |
| `talend_job_plan` | `{ job, operations[], mode?: "auto"\|"offline"\|"studio", dryRun?: true }` | Valida y devuelve el diff sin escribir. `dryRun` es `true` por defecto |
| `talend_job_edit` | igual que `plan`, `dryRun` por defecto `false` | Aplica el lote de forma atómica |
| `talend_job_run` | `{ job, context?, params?, confirm: true }` | Ejecuta. Exige `confirm: true` |
| `talend_run_status` | `{ runId }` | Estado y resultado de una ejecución |
| `talend_job_verify` | `{ job, run?: false, installMissing?, timeoutMs? }` | Diseño + compilación + ejecución + avisos en una llamada |
| `talend_jobs_list` | `{ limit?, offset? }` | Jobs del proyecto |
| `talend_job_quality_report` | `{ jobId }` | Informe de calidad del job (puntaje y hallazgos) |
| `talend_search` / `talend_describe` / `talend_execute` | Code Mode | Acceso a las tools que no están en el preset |

Operaciones admitidas por `plan`/`edit`: `add_node`, `remove_node`, `set_params`, `set_schema`,
`connect`, `disconnect`, `move`, `set_context`. Se aplican en orden y el lote es atómico: si una
falla, el `.item` no se modifica.

## Verificación: una sola llamada

Después de crear o cambiar un job, llama `talend_job_verify { job }`. Ya encadena problema de
diseño, compilación y ejecución, y busca `[WARN]`, `[ERROR]`, `[FATAL]` y excepciones **aunque el
código de salida sea 0**. Devuelve `verdict`: `ok`, `ok_con_avisos` o `error`, más `findings`.

- `run` es `false` por defecto: solo diseño y compilación, sin efectos externos.
- Usa `run: true` cuando ejecutar sea aceptable; informa al usuario **cada aviso**, no solo el veredicto.
- `talend_job_build_batch` demuestra que muchos jobs compilan, pero compilar no es ejecutar:
  verifica una muestra representativa.

## Reglas que rompen jobs

1. **No escribas el `.item` a mano.** Todo pasa por las tools, que validan integridad y tipos.
2. **Esquema antes de conectar** cuando el componente lo pide; el `tMap` se configura **después** de conectar.
3. **Usa los nombres que devuelve Studio** (`row1`, `tMap_1`). No los supongas.
4. **No adivines parámetros.** `talend_component_describe` y `talend_studio_component_parameters`
   dicen qué existe y qué falta; un parámetro desconocido se rechaza (`INVALID_COMPONENT_PARAMS`).
5. **Los `CHECK` van como cadena con comillas:** `"true"` / `"false"`, no `true`.
6. **Confirma antes de ejecutar o borrar.** `talend_job_run` exige `confirm: true`; las tools
   destructivas pueden ser irreversibles.
7. **`bun run bridge:install` recarga el plugin en el Studio abierto**: no lo lances con jobs o
   diálogos en curso.
8. **Prefiere `dryRun`** en cualquier edición que no hayas hecho antes; el diff dice qué cambiará.

## Si falta una tool

El preset `agent` expone solo una parte del catálogo. Si no ves la que necesitas:

1. `talend_search { query: "..." }` para encontrarla por nombre o capacidad.
2. `talend_describe { name }` para leer su contrato.
3. `talend_execute { name, input }` para invocarla.
4. Solo si hace falta el catálogo completo, reinicia con `TALEND_MCP_FILTER=all`; no lo hagas por defecto.

## CLI, cuando el MCP no está disponible

La CLI usa el mismo registro de tools, sin servidor HTTP. Es de solo lectura salvo `jobs create`
y `tools call` con permiso explícito:

```bash
bun run cli help
bun run cli doctor
bun run cli jobs list --project <ruta> --json
bun run cli jobs show <NOMBRE_EP>
bun run cli tools list --json
bun run cli tools describe talend_job_verify
bun run cli tools call talend_job_verify --input '{"job":"MI_JOB"}'
```

La escritura requiere `--yes` después de revisar la operación. La CLI no sustituye al MCP para
crear o editar jobs en lote.

## Diagnóstico rápido

| Síntoma | Qué mirar |
|---|---|
| No hay proyecto | `TALEND_PROJECT` en `.env.local`, o el proyecto abierto en Studio |
| El bridge no responde | `talend_bridge_ping`, `bun run doctor`, Studio abierto con el plugin cargado |
| No compila | `error.message` de `talend_job_verify`; el detalle suele ser el parámetro exacto que falta |
| Terminó con código 0 y avisos | `verdict: ok_con_avisos`; lee `findings.warnings` y `talend_tail_run_output` |
| Una tool no aparece | preset `agent`; usa `talend_search` o sube a `TALEND_MCP_FILTER=all` |
| Studio tiene un diálogo abierto | `talend_studio_ui_dialogs`; `talend_job_verify` se niega a seguir con diálogos bloqueantes |

## Dónde leer más

- `docs/AGENTE-EXTERNO.md`: configurar un componente en ocho llamadas, con ejemplo copiable.
- `docs/GUIA-AGENTE.md`: flujo completo, reglas de configuración, errores.
- `docs/MODO-OFFLINE.md`: garantías y rendimiento del camino offline.
- `docs/CATALOGO-DE-TOOLS.md`: catálogo generado de todas las tools.
- `docs/TALEND-STUDIO-INTERNALS.md`: APIs internas de Studio y trampas conocidas.
