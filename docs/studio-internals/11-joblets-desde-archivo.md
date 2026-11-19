# Joblets escritos a mano: qué se probó y qué falta

**Estado: spike hecho a medias; la decisión sigue pendiente de la interfaz.** Fecha: 11 de noviembre
de 2026 (tarea A-6 del Plan A).

## Lo que se hizo

1. Se escribió un joblet mínimo con el generador del repositorio
   (`createTalendJoblet` de `src/talend/job-crud/joblet.ts`): `JL_prueba_mcp` versión `0.1`, con
   `tJobletInput` y `tJobletOutput` conectados por `row1` y una variable de contexto `prefijo`
   (`id_String`). Los dos archivos quedaron donde los busca Studio:
   `PRJ_EJEMPLO/joblets/JL_prueba_mcp_0.1.item` y `.properties`. El generador produce los nodos
   `tJobletInput`/`tJobletOutput`, el parámetro de contexto del joblet y la propiedad
   `TalendProperties:JobletProcessItem` con el enlace `jobletProcess`.
2. Se pidió refrescar el workspace (`/workspace/refresh` del bridge). Studio contestó
   `java.lang.IllegalStateException: El hilo de la interfaz de Studio esta ocupado (se acabo el
   tiempo de espera)`: en ese momento el IDE estaba compilando o ejecutando un Job del arnés L5. El
   refresco **no se pudo verificar**.
3. `/automation/components?filter=JL_` no sirve para comprobarlo: ese endpoint enumera los
   componentes `t*` de la paleta y no los joblets del proyecto.

## Decisión

No hay evidencia de que Studio 8.0.1 cargue un joblet escrito a mano, así que **no se adopta como
camino principal**: el emisor sigue con **plan B, un Job hijo con `tRunJob`** para reutilizar lógica
entre Jobs. El joblet queda como opción solo si una comprobación en la interfaz (ventana del
repositorio, carpeta *Joblets*, después de refrescar) lo muestra y permite arrastrarlo a un Job.

## Lo que falta para cerrar A-6

- Repetir el refresco con Studio libre y mirar la carpeta *Joblets* en la ventana del repositorio.
- Si aparece: crear el escenario L5 de dos Jobs que usen el mismo joblet con valores distintos del
  parámetro y comparar cada salida con su CSV esperado.
- Si no aparece: dejar escrito aquí el resultado literal y mantener `tRunJob` como la única forma de
  reutilizar lógica; no se registra la tool `talend_joblets_create_from_spec`.

Los archivos de prueba se borraron del proyecto al terminar el spike, para no dejar un joblet
incompleto en el repositorio del usuario.
