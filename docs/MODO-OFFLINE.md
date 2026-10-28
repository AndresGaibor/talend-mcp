# Modo offline: crear y editar jobs sin Studio

Un job de Talend es un par de ficheros en `process/`: `NOMBRE_0.1.item` (el diseño, XML) y
`NOMBRE_0.1.properties`. Escribirlos directamente es muchísimo más rápido que montar el job nodo a nodo
con la API de Studio, y no necesita Studio abierto. Este documento explica cuándo usar cada camino,
qué tools hay, qué garantías dan y qué rendimiento tienen.

## Estrategia mixta (la regla)

| Trabajo | Camino | Por qué |
|---|---|---|
| Migraciones, familias de jobs parecidos, cambios repetidos | **Offline** | ~1 ms por job al escribir; sin editor |
| Jobs cerrados (no abiertos en un editor) | **Offline** | Nada se desincroniza |
| Comprobar que muchos jobs compilan | **Offline + `build-batch`** | ~0,2 s por job, sin abrir editor |
| Un job abierto en un editor de Studio | **Studio en vivo** | Studio pisaría el cambio al guardar |
| Componentes que Studio configura al conectarlos (tMap, esquemas dinámicos) | **Studio en vivo** | Studio resuelve su modelo |
| Ver el resultado en el lienzo / ejecutar con el Run visible | **Studio en vivo** | Es lo que se quiere ver |

Se combinan: lo habitual en una migración es crear y editar **offline** en bloque, y reservar Studio
para los pocos componentes complejos y para ejecutar una muestra.

## Las tools

| Tool | Hace |
|---|---|
| `talend_jobs_create_from_spec` | Crea un job desde una especificación de componentes y conexiones |
| `talend_jobs_create_batch` | Crea un job por fila desde una **plantilla** con `{{variables}}` (hasta 20 000) |
| `talend_job_edit_offline` | Edita un job: lote atómico de operaciones, con `dryRun` y diff |
| `talend_jobs_edit_batch` | Aplica el mismo lote a muchos jobs (por nombres o regex) |
| `talend_job_build_batch` | Genera y compila muchos jobs sin abrir su editor |
| `talend_job_verify` | Ejecuta un job y revisa avisos (para una muestra) |

### Operaciones de edición

`add_node`, `remove_node` (quita también sus conexiones), `set_params`, `set_schema`, `connect`,
`disconnect`, `move`, `set_context`. Se validan con zod y se aplican **en orden**.

### Garantías

- **Atómico por job:** si una operación falla, o el resultado sería inconsistente (conexión a un nodo
  que no existe, `UNIQUE_NAME` repetido, nombre de conexión repetido), el fichero no se toca. El error
  dice qué operación falla (`Operacion 3 (connect): ...`).
- **Creación por lote:** los `.item` y `.properties` nuevos se crean de forma exclusiva; si falla la escritura
  del segundo fichero, se elimina el primero recién creado. El portal añade una marca de propiedad al spec
  y un reintento reconoce el par existente con esa misma marca, sin sobrescribir Jobs ajenos.
- **Un job que falla no impide los demás** en un lote; la respuesta trae `fallos`.
- **No pisa un job abierto:** si Studio tiene el job en un editor, la tool se niega (`JOB_OPEN_IN_STUDIO`),
  salvo `force:true`. En un lote, esos jobs se saltan y se informan.
- **`dryRun`** valida y devuelve el diff sin escribir.
- Tras escribir, las tools refrescan el workspace de Studio si está abierto (`refreshStudio`).

## Flujo de una migración

1. `talend_jobs_create_batch` con `dryRun:true` para validar la plantilla y las filas.
2. El mismo comando sin `dryRun` (y con `verify:true` si Studio está abierto) para escribir y compilar.
3. `talend_jobs_edit_batch` para los retoques comunes (parámetros, esquemas, contextos).
4. `talend_job_build_batch` para comprobar que **todos** compilan; `noCompilan` debe quedar vacío.
5. `talend_job_verify` sobre una **muestra** representativa: compilar no es ejecutar.

## Rendimiento medido

Prueba con 1 000 jobs de dos componentes, Studio abierto (máquina de 13 GB):

| Paso | Tiempo |
|---|---|
| Crear 1 000 jobs (escritura) | 1,1 s |
| Compilarlos (`build-batch`, 4 hilos) | 268 s (0,27 s/job) |
| Editar los 1 000 | 0,9 s |
| Recompilar los 1 000 | 234 s |

Referencias: 20 000 items generados en memoria en 2,4 s; montar un job con la API de Studio cuesta de
3,6 a 5,6 s por caso. Orden de magnitud para 100 000 jobs: escribir en segundos, compilar en unas 6–8 h
en una sola máquina (el coste está en `generateCode`, que corre en serie dentro de Studio; la
compilación con `javac` sí es paralela).

El coste dominante de `build-batch` era el workspace de Eclipse, no Talend: cada `generateCode` crea y
reescribe recursos del proyecto Maven del job, y suelto cada recurso es una operación con sus reglas y
notificaciones. `JobBuilder.buildBatch` agrupa la generación en un único `IWorkspace.run` y el coste
por job deja de crecer con el tamaño del workspace (antes pasaba de 0,4 a 2,2 s).

## Límites conocidos

- Compilar no ejecuta: `build-batch` no detecta errores en tiempo de ejecución.
- Los componentes que Studio configura al conectar se configuran mejor en Studio (ver la tabla).
- El catálogo de componentes (`componentVersion`) se toma del catálogo local; un componente que no
  esté en él se rechaza antes de escribir.
- Un lote de verificación se parte en tramos de 500 jobs para no agotar el tiempo de la petición.

## Dónde está el código

- Edición: `src/talend/editor/job-edit.ts` (`tests/talend/job-edit.test.ts`).
- Lotes y plantillas: `src/talend/job-batch/batch.ts`, `open-guard.ts` (`tests/talend/job-batch.test.ts`).
- Tools: `src/presentation/tools/jobs/edit-offline.tool.ts`, `batch.tool.ts`;
  `src/talend/studio/tools-job-build-batch.ts`.
- Bridge: `JobBuilder.buildBatch` y la ruta `POST /automation/job/build-batch`
  (detalle en [studio-internals/08-interfaz-ui.md](studio-internals/08-interfaz-ui.md), secciones 80, 82–84).
- Tarea de la guía del agente: `migracion-masiva` (`talend_guide { mode: "task", task: "migracion-masiva" }`).
