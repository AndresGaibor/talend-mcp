# Borrado seguro de proyectos y etiquetas legibles

## Objetivo

Permitir retirar del portal un proyecto que ya no se necesita y hacer legible el lienzo de Talend, manteniendo reintentos idempotentes de los componentes derivados de SAS.

## Decisiones

- El botón aparece en el encabezado del proyecto y abre una confirmación que muestra el nombre y los datos del portal afectados. Para confirmar, se escribe el nombre exacto.
- Se borran metadata, archivos fuente extraídos, análisis, dependencias, planes, exportaciones y estados asociados al proyecto. El ZIP original no se conserva como archivo binario en el portal.
- La operación se rechaza si el pipeline SAS o un lote MCP está en cola o ejecución.
- Los Jobs y contextos de Talend no se borran al borrar el proyecto del portal.
- El MCP actualiza un Job en Talend Studio cuando su ubicación/identidad puede confirmarse. Un nombre repetido en otra carpeta con identidad ambigua sigue siendo conflicto.
- Los componentes muestran el propósito SAS resumido y una referencia corta `· SAS N`. El MCP mantiene compatibilidad con los nombres de operación `op_N_*` ya guardados en Jobs existentes.

## Alternativas consideradas

- Borrar desde la tarjeta sin confirmación: descartado porque permite un clic accidental.
- Borrar también Jobs desde Talend: descartado porque una acción del portal no identifica con seguridad qué otros Jobs pertenecen al proyecto.
- Quitar toda referencia de operación de las etiquetas: descartado porque el MCP usa esa identidad para conciliar reintentos y retirar nodos obsoletos.

## Aceptación

- El borrado requiere el nombre exacto y devuelve un conflicto legible si hay trabajo activo.
- Los datos del proyecto dejan de aparecer en la lista y su directorio queda retirado.
- No se envían operaciones MCP de borrado.
- Las etiquetas nuevas caben en el lienzo y los reintentos reconocen etiquetas históricas y nuevas.
