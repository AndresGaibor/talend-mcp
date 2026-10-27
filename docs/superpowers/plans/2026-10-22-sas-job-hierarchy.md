# Jerarquía correcta de Jobs SAS en Talend

> Plan de trabajo interno; la solicitud del usuario autoriza corregir el portal, MCP y los Jobs de prueba sin ejecutar Jobs.

**Meta:** convertir las instrucciones del portal en Jobs Talend con jerarquía y conexiones coherentes; incluir la información pendiente como variables de contexto vacías con comentarios.

**Regla de interpretación:** una macro SAS definida en el mismo archivo se incorpora al Job de ese programa. Una llamada a `%include` o macro auxiliar no es por sí sola un Job hijo. Una macro orquestadora que incluye programas SAS estáticos se convierte en un Job padre que llama a los Jobs de esos programas mediante `tRunJob` y triggers `OnSubjobOk`.

**Límites:** todas las escrituras pasan por la API de Talend Studio a través del Bridge. No escribir `.item` o `.properties` directamente. No compilar ni ejecutar Jobs durante este cambio. No inventar esquemas, datos ni credenciales; los requisitos no resueltos se guardan en el contexto con valor vacío y una explicación.

## Tarea 1: corregir la forma de la instrucción del portal

- [ ] Añadir pruebas de regresión del ZIP para auto-invocaciones, includes de configuración, macros auxiliares y orquestación de programas hijos.
- [ ] Aplanar la macro del mismo nombre del archivo dentro de su Job aun cuando haya sentencias top-level.
- [ ] Resolver llamadas `%run_step` contra programas SAS del mismo ZIP por ruta/sufijo único; emitir `tRunJob` solo cuando la ruta resuelve a un plan.
- [ ] Mantener sin bloquear los nodos con candidato Talend conocido aunque falte validación; seguir enviando al contexto cada valor, conexión, esquema, expresión o decisión pendiente.
- [ ] Enviar las especificaciones de Jobs hijos junto a la del orquestador y conservar sus carpetas de origen.

## Tarea 2: ejecutar la jerarquía con MCP y Studio

- [ ] Añadir prueba para que el MCP cree Jobs hijos antes del padre y compruebe referencias `tRunJob` desde el catálogo vivo.
- [ ] Preparar referencias `PROCESS` y parámetros de contexto con los nombres internos reales que Studio publica; no confiar en una etiqueta sin validar.
- [ ] Reconciliar nodos gestionados por el portal cuando se re-aplica una propuesta corregida, conservando nodos ajenos.
- [ ] Crear contextos para parámetros de macros y datos pendientes, con valor vacío y comentario que indique qué completar.
- [ ] Verificar nodos, conexiones, carpetas y referencias con las tools de lectura del MCP; no compilar ni ejecutar Jobs.

## Tarea 3: prueba con `ts-sas-legacy-analytics`

- [ ] Aplicar `job_run_daily_insurance` y sus hijos `job_claims_processing` y `job_policy_valuation` en las carpetas correspondientes a `PruebasWebSAS/ts-sas-legacy-analytics/`.
- [ ] Revisar que el padre ejecute secuencialmente ambos Jobs hijos con `OnSubjobOk` y que no tenga auto-llamadas ni `tRunJob` a `autoexec.sas` o `run_step`.
- [ ] Revisar que los datos técnicos pendientes estén en contextos vacíos.
- [ ] Documentar el rol de cada Job y los límites de la verificación sin compilar ni ejecutar.
