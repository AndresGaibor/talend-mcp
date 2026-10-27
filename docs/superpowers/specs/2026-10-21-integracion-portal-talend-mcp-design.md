# Implementación directa de guías del portal en Talend

## Objetivo

Conectar la guía de cada Job del portal `migrador-sasgrid-qlik` con el servidor `talend-mcp`, para que una persona pueda revisar una propuesta y crear el Job nuevo correspondiente en Talend desde el portal. El contenido que recibe el MCP será una especificación estructurada derivada del `JobPlan`; el portal no enviará instrucciones libres para que se interpreten de forma abierta.

El primer recorrido está pensado para pruebas locales rápidas: portal API y MCP ejecutándose en el mismo Windows con acceso al workspace de Talend. La dirección del MCP, su timeout y la carpeta destino serán configurables.

## Experiencia de usuario

En el detalle de cada guía habrá un panel destacado con el botón principal **Implementar flujo directo en Talend** y el estado de conexión con MCP. El destino inicial será `Process/PruebasWebSAS`.

Al pulsar el botón, el portal consultará la API para generar la vista previa a partir de la guía actual. Mostrará el Job y la carpeta destino, componentes y conexiones elegibles, además de pasos bloqueados con sus motivos. La vista previa no escribirá ni ejecutará nada.

Una segunda acción explícita, **Crear Job en Talend**, confirmará la escritura del Job indicado. Los pasos bloqueados quedarán fuera del spec; si existe al menos un componente o variable de contexto elegible, se podrá crear el Job con ese subconjunto y el resultado se marcará como parcial. Si no hay contenido Talend para crear, el portal no llamará a una herramienta de escritura. Una guía de macro sin componentes elegibles puede crear un Job esqueleto con sus contextos y mostrar los pasos de la macro como pendientes. La confirmación debe nombrar el Job y la carpeta para reducir errores de destino.

El panel comunicará MCP no disponible, timeout, destino ocupado, Job creado, aplicación parcial y fallo. La escritura de los archivos `.item` y `.properties` se reportará por separado de la capacidad opcional del Bridge para refrescar, abrir o diagnosticar el Job en Studio. Crear archivos no equivale a validar ni ejecutar el Job.

## Arquitectura y contrato

El frontend llama únicamente a la API FastAPI del portal. La API construye el spec desde el `JobPlan`, conserva la vista previa actual y, al confirmar, invoca un método tipado del `TalendAdapter`. El adapter orquesta una secuencia cerrada de tools de Studio (`talend_job_create_in_studio`, `talend_job_add_node` y `talend_job_connect_nodes`) y manda el nombre del Job en cada operación para que el Bridge lo resuelva dentro de la operación de UI. Solo compensa fallos borrando el Job que acaba de crear mediante `talend_job_delete_in_studio`. No habrá un proxy de herramientas MCP arbitrarias ni escritura manual de `.item`/`.properties`.

La ruta de vista previa existente seguirá siendo la fuente del payload. Se añadirá una ruta de aplicación por proyecto y programa que reciba el `preview_id`, vuelva a construir la propuesta actual y compare su identidad y hash antes de escribir. La confirmación se rechazará si la propuesta cambió, el preview no tiene componentes ni contextos elegibles o el MCP no devuelve éxito. El cálculo del preview debe quedar ligado al spec y a la revisión de la guía/fuente, no solo al JSON MCP, para detectar cambios que alteren bloqueos o elegibilidad.

El adapter agregará las operaciones específicas de creación en Studio a su política allowlist y validará el envelope MCP y el guardado informado por Studio. El endpoint no aceptará nombre de tool, rutas locales ni argumentos MCP arbitrarios desde el navegador. El nombre de carpeta vendrá de configuración del servidor y deberá permanecer dentro de `Process/`.

## Configuración y despliegue de prueba

Portal y MCP se ejecutarán co-localizados en Windows para este primer alcance. La configuración del portal será:

- `TALEND_MCP_URL`, por defecto `http://127.0.0.1:3927/mcp`.
- `TALEND_MCP_TIMEOUT_SECONDS`, con un valor inicial acotado para llamadas locales.
- `TALEND_MCP_READONLY`, por defecto `false` para habilitar creación confirmada desde el portal; `true` deshabilita la escritura.
- `TALEND_APPLY_FOLDER`, por defecto `Process/PruebasWebSAS`.

El MCP conserva `TALEND_MCP_HOST` (por defecto `127.0.0.1`) y `TALEND_MCP_PORT` (por defecto `3927`). La guía de instalación de prueba documentará que la URL del portal debe coincidir con el host y puerto configurados en el proceso MCP. Los valores no se codificarán en el frontend.

La llamada de aplicación será síncrona en esta versión para reducir piezas necesarias en pruebas rápidas. El timeout se podrá ajustar por configuración. No habrá cola ni reintentos automáticos.

## Seguridad y límites del primer alcance

- Solo se crean Jobs nuevos. Una colisión de nombre o destino aborta; nunca se actualiza ni sobrescribe un Job existente.
- El destino permanece bajo `Process/PruebasWebSAS` por defecto y cualquier cambio configurable debe pasar la misma validación de ruta.
- Solo se envían parámetros y componentes elegibles que la guía considere verificados y completos. Las decisiones pendientes, secretos, credenciales, expresiones no verificadas y capacidades no soportadas quedan bloqueadas.
- No se ejecuta el Job, no se guardan credenciales y no se conectan sistemas de producción.
- El servidor MCP sigue escuchando en loopback para el MVP. El frontend no se conecta directamente al MCP.
- El preview no escribe. La escritura se habilita por defecto, pero cada Job requiere la acción explícita de confirmación; `TALEND_MCP_READONLY=true` permite deshabilitarla desde el entorno.
- Si la escritura resulta correcta pero Studio no está disponible, el portal mostrará el Job como generado y el estado de Studio como pendiente; no afirmará que fue validado.

Actualizar Jobs existentes en general, restaurar snapshots y conectar un portal remoto con un MCP local quedan para una fase posterior; la ampliación acotada de abajo solo permite completar el Job de prueba vacío y coincidente.

## Ampliación solicitada: primer avance visible de macros SAS

Para el programa SAS cuya única lógica está dentro de una macro con el mismo nombre del archivo, el Job generado representa esa macro y puede contener sus pasos. Los candidatos Talend que existen en el catálogo pero todavía necesitan esquema, origen, destino o expresión se insertan como nodos borrador sin parámetros ni conexiones; el portal los identifica como no configurados y el Job no se ejecuta.

La confirmación puede completar el Job homónimo ya existente solo cuando está en la carpeta de prueba configurada (o en la ruta anidada que generó la versión anterior del Bridge) y todos sus nodos existentes coinciden con la propuesta. Se agregan únicamente los nodos faltantes. Si el Job tiene otros nodos, está en otra carpeta o el estado no se puede leer, la operación se detiene sin modificarlo.

El Bridge crea el recurso en `Process/<carpeta>/<Job>`. Los datasets, conexiones, esquemas, condiciones SAS no traducidas y pasos sin componente identificable permanecen bloqueados hasta resolver sus datos de origen y destino.

Primera aplicación en `PruebasWebSAS` (2026-10-22): seis nodos visibles en Studio (`tFilterRow` ×2, `tMap` ×2 y `tSetGlobalVar` ×2), cero conexiones y una variable de contexto. La inserción fue confirmada por `talend_job_list_nodes`; el Job no se compiló ni ejecutó.

## Verificación y aceptación

La integración debe verificarse con un MCP falso para el flujo portal→preview→confirmación→resultado y con el contrato real de la tool seleccionada. Un smoke test local usará el workspace de Talend de prueba configurado y comprobará la creación bajo `Process/PruebasWebSAS`, la colisión segura, la respuesta con Bridge disponible/no disponible y que ningún Job se ejecute.

Se acepta el primer alcance cuando una persona puede ver el botón en una guía, conocer el estado del MCP, revisar exactamente qué se propone, confirmar la creación de un Job nuevo, recibir un resultado distinguible (completo/parcial/fallido) y ver los bloqueos que requieren trabajo manual. El portal debe seguir explicando que “generado” no significa “validado en Studio”.

## Archivos previstos

En `migrador-sasgrid-qlik`: `apps/api/main.py`, `src/sas_grid_migrator/talend_adapter/adapter.py`, `policy.py`, `apps/web/src/views/PlansTab.tsx`, `apps/web/src/api.ts`, `apps/web/src/types.ts`, estilos, configuración de ejemplo, documentación y pruebas del adapter/API/UI.

En `talend-mcp`: reutilizar la API de Studio disponible para crear el Job y sus nodos; no escribir `.item`/`.properties` desde el portal. No ampliar la integración para actualizar Jobs existentes en este alcance.

## Addendum 2: Portal instructor y MCP ejecutor

La nueva instrucción del usuario reemplaza la revisión en dos clics y el seguimiento manual por paso descritos arriba. El portal conserva el análisis SAS como fuente de instrucciones y ofrece una sola acción que envía el plan actual al MCP; el MCP valida los componentes disponibles y ejecuta las operaciones de Studio. Se quitan de la interfaz los estados Pendiente, En progreso, Completado, Bloqueado y la confirmación por paso. Los datos técnicos faltantes siguen visibles como información para completar la migración.

El portal enviará una instrucción estructurada que conserva origen, evidencia SAS, operación, candidato Talend, propiedades, expresiones, dependencias, esquemas conocidos, supuestos y datos que todavía faltan. No se enviará el estado manual anterior del paso como decisión ejecutable. El MCP reutilizará `talend_job_apply_custom_spec` como una única operación de ejecución: consultará el catálogo y parámetros de Studio, abrirá o creará el Job mediante la API de Studio, agregará contextos, componentes, configuración soportada y conexiones, y devolverá componentes creados/reutilizados, advertencias y datos pendientes.

`talend_job_apply_custom_spec` dejará de escribir `.item` o `.properties` directamente. Para un Job existente, el MCP localizará el `.item` dentro del proyecto y abrirá esa ruta exacta; esto permite continuar el Job de prueba en su ubicación heredada `process/job_dsc_appendtocustomerdb/PruebasWebSAS/`. Si la propuesta contiene nodos o conexiones ajenos, la ejecución se detiene sin borrar ni reemplazar el Job. La ruta corregida para Jobs nuevos permanece `Process/PruebasWebSAS`.

El botón único puede crear un Job parcial cuando existan candidatos seguros, aunque la guía tenga decisiones técnicas sin resolver. Los estados de análisis y los datos faltantes no requieren aprobación ni bloquean la inserción de nodos conocidos. Un nombre de componente o una conexión que no se pueda verificar en Studio se informa y se omite. La integración no ejecuta el Job ni declara equivalencia SAS; las conexiones, esquemas y expresiones dinámicas siguen pendientes cuando el portal no tenga datos suficientes.

La aceptación de esta ampliación requiere: MCP y Bridge conectados; un clic del portal que invoque una sola tool MCP; apertura del Job SAS correcto aunque esté en la ruta heredada; nodos y contextos visibles en Studio; estados manuales ausentes de la guía; avisos técnicos conservados; y cero ejecución del Job.

Smoke test 2026-10-22: el portal actualizó `job_dsc_appendtocustomerdb` con 6 nodos existentes etiquetados según la guía y `context.range_id`. No creó conexiones porque el programa no define el origen ni los schemas. El portal devolvió aplicación parcial; la lectura de problemas de Studio reportó 2 errores de diseño y 6 avisos asociados a valores y filas faltantes. No se compiló ni se ejecutó el Job.

## Addendum 3: conservar datos reales y estructura del ZIP

Esta instrucción reemplaza cualquier generación de datos sintéticos descrita en la prueba anterior. El portal solo envía valores y configuraciones confirmados por el análisis; no agrega filas `TEST_*`, fechas, nombres de columnas ni conexiones de ejemplo. Cuando falta información, genera variables `migration_todo_<hash>` vacías con el motivo exacto en el comentario del contexto Talend. Si no hay nodos ni otras variables, crea `migration_source_program` para que la guía conserve su identidad de origen sin inventar valores SAS.

La falta de un dato pendiente ya no descarta un componente reconocido. El MCP aplica los parámetros y esquemas confirmados y crea los componentes identificados como borradores; los valores que el portal no puede validar siguen pendientes. Al reintentar, conserva los contextos existentes que ya tengan valor.

La carpeta configurada por `TALEND_APPLY_FOLDER` es la raíz para pruebas. El portal agrega como subcarpetas el directorio relativo del archivo SAS dentro del ZIP y muestra esa jerarquía en las listas. MCP puede reanudar un Job que una versión anterior dejó en otra carpeta solo si su descripción y propósito identifican la misma guía; devuelve la ruta real del Job existente y no altera Jobs con identidad distinta o ambigua.

Durante la única llamada síncrona al MCP, la guía presenta una barra indeterminada y el texto de aplicación. Al terminar, muestra si el Job se creó o actualizó, su ruta y los conteos de componentes, conexiones y contextos agregados o reutilizados. El flujo no compila ni ejecuta el Job.

Verificación del 2026-10-22 posterior al error de compilación mostrado por el usuario: el MCP informó `clean=true` (0 errores y 0 avisos) y `talend_job_compile` devolvió `compiles=true` para `job_dsc_appendtocustomerdb`. La consola Run abierta mostraba una ejecución previa con código 0 y filas `TEST_*`; esa salida pertenece al Job existente y no es creada por el nuevo payload del portal. La captura del error no se reprodujo en esa comprobación.
