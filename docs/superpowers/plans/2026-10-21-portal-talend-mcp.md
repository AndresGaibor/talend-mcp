# Botón de implementación portal–Talend MCP: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que una persona revise y aplique desde una guía del portal los nodos seguros de un Job de prueba en Talend mediante `talend-mcp`.

**Architecture:** El React web llama a endpoints tipados de FastAPI. FastAPI obtiene el spec de la guía, valida un preview ligado a su revisión y usa un método tipado del adaptador MCP para orquestar tools de Talend Studio. El flujo crea un Job nuevo o completa de forma idempotente el Job vacío y coincidente en `Process/PruebasWebSAS`; los candidatos incompletos se insertan como borradores sin schema ni conexiones. No ejecuta Jobs.

**Tech Stack:** Python 3, FastAPI, Pydantic, cliente MCP Python existente, React 19, TypeScript, Vite, Bun.

**Spec:** `docs/superpowers/specs/2026-10-21-integracion-portal-talend-mcp-design.md`

## Global Constraints

- Portal API y MCP se ejecutan juntos en Windows para el primer recorrido.
- `TALEND_MCP_URL` predeterminado: `http://127.0.0.1:3927/mcp`.
- `TALEND_MCP_TIMEOUT_SECONDS` configura el timeout del adaptador MCP.
- `TALEND_MCP_READONLY` predeterminado `false`; cada creación requiere confirmar el preview y `true` bloquea la escritura.
- `TALEND_APPLY_FOLDER` predeterminado: `Process/PruebasWebSAS` y debe permanecer dentro de `Process/`.
- El MCP escucha en loopback; el frontend solo se comunica con la API del portal.
- El adapter solo permite tools MCP tipadas; nunca acepta el nombre de tool ni un payload MCP arbitrario desde el frontend.
- Una colisión en otra carpeta o cualquier nodo ajeno aborta sin sobrescribir. Solo se completa un Job existente si está en la carpeta destino y cada nodo coincide con el preview vigente. No se ejecutan Jobs.
- Los candidatos con tipo Talend conocido pero esquema o propiedades pendientes pueden llegar como borradores sin configurar y sin conexiones; el portal los marca como pendientes.
- Un archivo creado no se presenta como validado en Studio; apertura y diagnóstico de Studio se informan aparte.

## Review Focus

- Preview obsoleto por cambios a guía, hash fuente o pasos bloqueados: probar rechazo de `preview_id` diferente.
- URL MCP inválida, timeout o servidor detenido: probar error API controlado y UI legible.
- MCP retorna un envelope `ok: false` o `isError`: probar que el portal informa fallo sin “creado”.
- Ningún paso elegible o todos bloqueados: probar que la ruta no invoque el writer.
- Nombre de Job en colisión y carpeta configurada fuera de `Process/`: probar rechazo seguro.

---

### Task 1: Llamada tipada de escritura al MCP

**Files:**
- Modify: `migrador-sasgrid-qlik/src/sas_grid_migrator/talend_adapter/adapter.py`
- Modify: `migrador-sasgrid-qlik/src/sas_grid_migrator/talend_adapter/policy.py`
- Test: `migrador-sasgrid-qlik/tests/unit/test_talend_adapter.py`

**Interfaces:**
- Consumes: `TalendApplySpec.to_mcp_arguments()` en `talend_adapter/apply_spec.py`.
- Produces: `TalendAdapter.apply_custom_spec(arguments: dict[str, Any]) -> dict[str, Any]`, que crea el Job/nodos/conexiones con tools de Studio, devuelve los datos del resultado y lanza `TalendError` ante errores o respuestas sin éxito explícito.

- [x] **Step 1: Añadir pruebas de allowlist y llamada fija**

Probar que solo se permiten las tools de Studio seleccionadas, que una tool no permitida sigue rechazándose y que el método compone el payload para crear, añadir nodos y conectar.

- [x] **Step 2: Ejecutar las pruebas del adaptador y confirmar que fallan**

Run: `uv run pytest tests/unit/test_talend_adapter.py -q`
Expected: fallan las pruebas nuevas porque no existe el método o la tool sigue bloqueada.

- [x] **Step 3: Implementar `apply_custom_spec` y configuración de URL/timeout**

Mantener el cliente MCP existente. `from_env()` leerá `TALEND_MCP_URL` y `TALEND_MCP_TIMEOUT_SECONDS`; los valores predeterminados serán la URL loopback del spec y 60 segundos.

- [x] **Step 4: Ejecutar las pruebas del adaptador**

Run: `uv run pytest tests/unit/test_talend_adapter.py -q`
Expected: PASS.

---

### Task 2: Endpoint de aplicación ligado al preview

**Files:**
- Modify: `migrador-sasgrid-qlik/apps/api/main.py`
- Modify: `migrador-sasgrid-qlik/src/sas_grid_migrator/talend_adapter/apply_spec.py`
- Test: `migrador-sasgrid-qlik/tests/unit/test_talend_apply_spec.py`
- Test: `migrador-sasgrid-qlik/tests/integration/test_api_guided_pipeline.py`

**Interfaces:**
- Consumes: `TalendAdapter.apply_custom_spec(arguments)` de Task 1 y `build_apply_spec(plan, folder_path)` existente.
- Produces: `POST /api/projects/{project_id}/plans/{program:path}/talend-apply` con JSON `{ "preview_id": string }`; retorna estado `applied` o `partially_applied`, identidad del Job, datos de escritura y estado separado de Studio.

- [x] **Step 1: Añadir pruebas de ruta para confirmación y fallos**

Probar llamada al writer con el `preview_id` vigente; rechazo 409 ante preview obsoleto o sin componentes ni contextos; error 502 ante fallo MCP; estado parcial cuando hay contenido elegible y bloqueos; y que el handler nunca acepte tool name desde la solicitud.

- [x] **Step 2: Ejecutar las pruebas API y confirmar que fallan**

Run: `uv run pytest tests/unit/test_talend_apply_spec.py tests/integration/test_api_guided_pipeline.py -q`
Expected: fallan solo las pruebas nuevas porque la ruta aún no existe.

- [x] **Step 3: Ligar el preview a la identidad/revisión del plan y añadir la ruta de aplicación**

La ruta reconstruirá el spec con la carpeta de entorno, verificará el hash de preview ligado a identidad, hash de fuente, versión de reglas y argumentos MCP, y llamará el método tipado solo si hay componentes o contextos elegibles. Validar que `TALEND_APPLY_FOLDER` esté bajo `Process/`; clasificar completo/parcial según bloqueos; convertir fallos de `TalendError` a 502.

- [x] **Step 4: Ejecutar las pruebas API**

Run: `uv run pytest tests/unit/test_talend_apply_spec.py tests/integration/test_api_guided_pipeline.py -q`
Expected: PASS.

---

### Task 3: Botón visible y confirmación en la guía

**Files:**
- Modify: `migrador-sasgrid-qlik/apps/web/src/views/PlansTab.tsx`
- Modify: `migrador-sasgrid-qlik/apps/web/src/api.ts`
- Modify: `migrador-sasgrid-qlik/apps/web/src/types.ts`
- Modify: `migrador-sasgrid-qlik/apps/web/src/styles.css`

**Interfaces:**
- Consumes: vista previa existente y endpoint de aplicación de Task 2.
- Produces: botón destacado **Implementar flujo directo en Talend**, panel de estado MCP, preview de componentes/bloqueos y confirmación **Crear Job en Talend** que envía el `preview_id` exacto.

- [x] **Step 1: Añadir tipos y métodos API para respuesta de aplicación**

Definir tipos completos para el resultado (`applied`, `partially_applied`, `failed`), `api.applyTalendPreview(...)` y argumentos de vista previa sin depender de valores introducidos por el navegador.

- [x] **Step 2: Construir la experiencia de confirmación**

Reemplazar el CTA de solo revisión por el panel prominente con el botón solicitado, indicador MCP disponible/no disponible, mensaje de estados, confirmación que nombre Job/carpeta y resultado parcial o completo.

- [x] **Step 3: Estilizar y comprobar responsive/accesibilidad**

Usar el acento Talend verde que ya existe, conservar foco de teclado, `aria-live` para resultados y diseño de una columna en viewport móvil.

- [x] **Step 4: Compilar el frontend**

Run (histórico): el portal web vivía en `apps/web`; esa aplicación ya no forma parte de este repo.
Expected: TypeScript y Vite terminaban sin errores en el repo del portal.

---

### Task 4: Configuración y guía de prueba local

**Files:**
- Modify: `migrador-sasgrid-qlik/.env.example`
- Modify: `migrador-sasgrid-qlik/README.md`
- Possibly modify: `talend-mcp/README.md`

- [x] **Step 1: Documentar URL, timeout, carpeta y puerto configurables**

Añadir ejemplos sin rutas personales para `TALEND_MCP_URL`, `TALEND_MCP_TIMEOUT_SECONDS` y `TALEND_APPLY_FOLDER`, junto con `TALEND_MCP_HOST`/`TALEND_MCP_PORT` del MCP y los comandos de inicio local.

- [x] **Step 2: Revisar coherencia de configuración entre ambos procesos**

Confirmar que el ejemplo de URL coincide con host/puerto del servidor y que el destino de prueba sea `Process/PruebasWebSAS`.

---

### Task 5: Verificación de extremo a extremo en workspace de prueba

**Files:**
- Test: `migrador-sasgrid-qlik/tests/unit/test_talend_apply_spec.py`
- Test: `migrador-sasgrid-qlik/tests/unit/test_talend_adapter.py`
- Test: `migrador-sasgrid-qlik/tests/integration/test_api_guided_pipeline.py`

- [ ] **Step 1: Ejecutar la suite del portal**

Run: `uv run pytest`
Expected: PASS.

Observed: 97 passed, 1 skipped, 5 failed in `tests/unit/test_golden.py`; each failure is a Markdown golden mismatch at the generated source SHA-256 line. No golden fixture was changed.

- [x] **Step 2: Ejecutar typecheck/tests/build de la UI** (verificación histórica del portal, fuera de este repo)

Run: typecheck, tests y build en el repo separado del portal.
Expected: todos terminaron con código cero en aquella revisión.

- [x] **Step 3: Ejecutar typecheck y suite del MCP**

Run desde `talend-mcp`: `bun run typecheck` y `bun test`.
Expected: PASS sin modificar los cambios preexistentes del workspace.

- [ ] **Step 4: Smoke test local con destino Talend de prueba**

Con Portal API, MCP y Talend Studio configurados localmente, confirmar preview y creación de un Job en `Process/PruebasWebSAS`; confirmar colisión segura con la misma guía; comprobar estado Bridge disponible/no disponible y que ningún Job se ejecute.

Initially not run because it would write a real Job into the configured Talend workspace. The user later requested that this exact empty test Job be completed; track that work in Task 6.

### Task 6: Continuar el Job SAS vacío con nodos borrador

**Files:**
- Modify: `migrador-sasgrid-qlik/src/sas_grid_migrator/talend_adapter/apply_spec.py`
- Modify: `migrador-sasgrid-qlik/src/sas_grid_migrator/talend_adapter/adapter.py`
- Modify: `migrador-sasgrid-qlik/src/sas_grid_migrator/talend_adapter/policy.py`
- Modify: `migrador-sasgrid-qlik/apps/web/src/views/PlansTab.tsx`
- Modify: `migrador-sasgrid-qlik/apps/web/src/types.ts`
- Modify: `talend-mcp/talend-studio-bridge/com.andres.talend.bridge/src/com/andres/talend/bridge/automation/JobRepository.java`
- Modify: `talend-mcp/docs/TALEND-STUDIO-INTERNALS.md`

**Interfaces:**
- Consumes: pasos de una macro cuyo nombre coincide con el archivo SAS y los nodos listados por `talend_job_list_nodes`.
- Produces: nodos borrador de tipos presentes en catálogo, reanudación idempotente solo sobre el Job de destino vacío/coincidente y rutas `Process/<carpeta>/<Job>`.

- [x] **Step 1: Incluir pasos de la macro del archivo como nodos borrador seguros**
- [x] **Step 2: Reanudar un Job de destino vacío o coincidente sin duplicar nodos**
- [x] **Step 3: Corregir el orden de carpetas en la creación y apertura del Job del Bridge**
- [x] **Step 4: Mostrar en el portal cuáles nodos carecen de esquema o conexiones**
- [x] **Step 5: Verificar en vivo la inserción de nodos en el Job de `PruebasWebSAS` sin ejecutar**

Resultado: Studio lista seis nodos (`tFilterRow` ×2, `tMap` ×2, `tSetGlobalVar` ×2), 0 conexiones y 1 variable de contexto. Se reutilizó el único nodo creado antes de corregir el desempaquetado MCP y se agregaron los cinco faltantes. El Job no se compiló ni ejecutó.
