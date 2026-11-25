# Criterio profesional para el agente: perfil del proyecto, preguntas y reutilización

Fecha: 2026-11-24. Estado: implementado (ver desviaciones).

## Intención

Hoy el agente sabe **manejar las tools** (skill `talend-mcp`, `talend_guide`), pero no tiene
**criterio de diseño**: no mira qué existe antes de crear, no pregunta lo que no puede deducir y
no sigue las convenciones del proyecto. El usuario no ha visto fallos concretos; quiere un agente
"más útil": que conozca el proyecto, pregunte cuando falte algo y reutilice en vez de duplicar.

## Objetivos

1. Antes de crear o cambiar un job, el agente obtiene un **perfil del proyecto** (qué hay y qué
   convenciones se usan) y lo respeta.
2. Si el perfil deja **huecos** que cambian el resultado (qué contexto o conexión usar, destino,
   nombre), el agente **pregunta al usuario**; no inventa.
3. El agente **reutiliza** lo que existe: contextos del proyecto, conexiones y esquemas de
   repositorio, jobs hijos con `tRunJob`.
4. El criterio llega por el **propio MCP**, así que funciona con cualquier cliente (Claude Code,
   Copilot, otros), no solo con los que leen skills.

## No objetivos

- Descargar la documentación completa de Talend Studio. Las reglas se redactan y, si alguna deja
  dudas, se contrasta con la página concreta de la documentación oficial.
- Crear joblets a mano. Sin evidencia de que Studio 8.0.1 los cargue
  (`docs/studio-internals/11-joblets-desde-archivo.md`), la reutilización de lógica entre jobs es
  un job hijo con `tRunJob`. Si ya existen joblets en el proyecto, el perfil los lista y el
  agente los **usa** pero no los fabrica.
- Cachear el perfil, o un motor de reglas o de linting. Es una lectura puntual cada vez.

## Antiobjetivos (fallo aunque "funcione")

- Que el agente haga una batería de preguntas genéricas antes de cada tarea. Pregunta solo por
  huecos reales del perfil.
- Que el perfil sea una sola llamada que devuelve miles de líneas. Debe ser un resumen corto.

## Restricciones

- Debe funcionar **sin Studio** (offline): conexiones, contextos y esquemas de repositorio por el
  bridge solo existen con Studio abierto, así que el perfil lee `process/`, `joblets/`,
  `context/` y `metadata/` del disco. Con Studio abierto puede enriquecerse, pero no depende.
- Respetar la arquitectura actual: tool nueva en `src/modules/...`, `talend_<area>_<verbo>`, sin
  aliases (AGENTS.md). Verificar con `bun run typecheck` y `bun test`.
- Español, como el resto de la documentación.

## Enfoques considerados

- **A. Solo skills.** Barato, pero solo lo ven los clientes que leen skills, y el agente haría
  5 o 6 llamadas sueltas cada vez.
- **B. Perfil en el MCP + tarea de guía + puntero en la skill.** Elegido por el usuario
  ("lo que recomiendes"). Llega a todos los clientes.
- **C. B + referencia local de Studio.** Descartado: grande, caduca, y lo que cambia la conducta
  son pocas reglas.

El usuario aceptó empezar por A y subir a B. Se hace en **dos fases sin trabajo tirado**: el
contenido de A (ritual y reglas) vive desde el principio en la tarea de guía, y B solo añade la
tool que alimenta el primer paso.

## Diseño

### Fase 1 (sin código de tools): ritual y reglas

- **Tarea `disenar-job` en `talend_guide`** (`src/modules/guide/domain/task-catalog/`, archivo
  nuevo y alta en `index.ts` y `areas.ts`). Pasos: 1) orientarse; 2) inventario con las tools que
  ya existen (`talend_jobs_list`, `talend_list_project_contexts`, `talend_job_inspect` de jobs
  parecidos, y con Studio `talend_list_repository_*`); 3) decidir qué se reutiliza; 4) preguntar
  por los huecos; 5) crear (offline o Studio); 6) `talend_job_verify`.
- **Reglas de criterio** añadidas a `rules.ts` (unas 15 o 20, cortas, accionables). Borrador de
  temas: reutilizar antes de crear; un contexto del proyecto para rutas y credenciales, nunca
  valores fijos; conexiones y esquemas desde el repositorio; nombres con el prefijo y la
  convención ya usados; un job hace una cosa y lo común va a un hijo con `tRunJob`; control de
  errores (`tDie`/`onComponentError`) y registro (`tLogRow`/`tStatCatcher`) donde el proyecto ya
  los pone; no dejar componentes sueltos ni desconectados; verificar siempre.
- **Skill `talend-mcp`**: una sección corta "Antes de crear" que remite a
  `talend_guide { mode: "task", task: "disenar-job" }`. No duplica el contenido.
- **Preguntas**: el texto de la tarea indica **cuándo** preguntar (hueco que cambia el resultado,
  sin valor por defecto razonable) y **cómo**: de una en una, con la opción recomendada primero.

### Fase 2: `talend_project_profile`

Tool de solo lectura, offline, que devuelve un resumen:

- **inventario**: contextos de proyecto, jobs (con carpeta), joblets, conexiones y esquemas de
  `metadata/`, rutinas; con límite por categoría y `total` real;
- **convenciones detectadas**: prefijos de nombre más frecuentes en jobs, joblets y contextos,
  y versión de Talend del `talend.project`;
- **huecos**: lista de frases ("no hay contextos de proyecto", "no hay conexión de BD en el
  repositorio") que el agente convierte en preguntas;
- **recomendaciones de reutilización**: cuando existe algo con el mismo propósito que lo pedido
  (mismo prefijo o nombre parecido), lo señala.

Entrada: `{ projectPath?, limit? }` (el proyecto activo por defecto). Se añade como primer paso
de `disenar-job` y se expone en el preset `agent`.

## Pruebas

- Fase 1: test que comprueba que la tarea y las reglas existen en `talend_guide` y que los
  `tool` de los pasos son nombres reales del registro.
- Fase 2: tests con un proyecto de ejemplo (`PRJ_EJEMPLO` o un directorio temporal) cubriendo:
  proyecto vacío (todos los huecos), proyecto con convenciones claras, y límite de resultados.

## Qué queda para quien construya

- Las 15-20 reglas exactas y su redacción final.
- Cómo se detecta un "prefijo" (la heurística concreta) y el umbral para llamarlo convención.
- Si `talend_project_profile` puede enriquecerse con el bridge cuando hay Studio, o se queda solo
  en disco en la primera versión (propuesta: solo disco).

## Pregunta abierta para el usuario

¿Tiene el equipo un **estándar de nombres** (prefijos de jobs, contextos, carpetas)? Si existe,
lo ideal es leerlo de un archivo en el proyecto (por ejemplo `.talend-mcp/convenciones.md`) y no
solo deducirlo. Propuesta: la v1 solo deduce; el archivo se añade si el estándar existe.

## Desviaciones registradas en la implementacion

- La entrada de `talend_project_profile` gano `purpose` (necesario para los candidatos de reutilizacion).
- Los candidatos de reutilizacion casan por prefijo de token del nombre (raiz de 4 letras, o la palabra entera si tiene 3), no por prefijo de nombre.
- Hay 14 reglas de criterio en lugar de 15-20.
- El perfil no devuelve la version de Talend del proyecto (`talend.project`): ningun consumidor la usaba, se descarta.
- La mencion a `areas.ts` de este documento era incorrecta: ese archivo clasifica tools, no tareas. Solo hizo falta registrar la tarea en `task-catalog/index.ts`.
- Un `projectPath` explicito que no es un proyecto responde `INVALID_PROJECT_PATH` en lugar de caer al proyecto activo.
- El paso `talend_list_project_contexts` se quito de `disenar-job` (llevaba una ruta de ejemplo que hacia fallar la llamada); el perfil ya cubre los contextos.
