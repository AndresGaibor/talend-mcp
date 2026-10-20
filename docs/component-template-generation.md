# Prueba de generación de plantillas de componentes Talend

Fecha: 2026-10-20

## Alcance

Se recorrieron los 1.215 nombres de componente con prefijo `c` o `t` en `migrador-sasgrid-qlik/docs/reference/talend`. Se excluyeron `README.md` y `studio-configuration.md`. Se usó Talend Studio 8.0.1 en `C:\Talend\8.0.1\studio` y el MCP `talend_components_generate_template`.

La plantilla se genera para un componente por llamada: el MCP busca su definición en el catálogo y devuelve XML. Una tarea normal consulta solo las definiciones de los componentes que necesita; no vuelve a escanear los 1.215 componentes. El escaneo completo sirve para poblar las cachés.

## Resultado de la pasada completa

- Generaron fixture XML: **855 / 1.215**.
- No encontrados en el catálogo: **360 / 1.215**.
  - `c*`: 88.
  - `t*`: 272.
- El escáner de definiciones encontró 1.158 componentes; el constructor de catálogo produjo 951 entradas.
- Los 360 fallos fueron `Component not found`: sus nombres no estaban en el catálogo usado por el generador.

El manifiesto [component-template-generation-results.json](./component-template-generation-results.json) contiene cada nombre y su resultado. Las plantillas XML fueron respuestas MCP y **no se guardaron como 855 archivos**.

Ejemplo abreviado de la respuesta generada para `tMap`:

```xml
<node xmi:id="_8NxmUbb1sWWlvzddwJQ1oN" componentName="tMap">
  <elementParameter field="TEXT" name="UNIQUE_NAME" value="tMap_1"></elementParameter>
  <elementParameter field="TEXT" name="ROWS_BUFFER_SIZE" value="2000000"></elementParameter>
  <nodeData xsi:type="TalendMapper:MapperData">
    <outputTables sizeState="INTERMEDIATE" name="out1"></outputTables>
    <inputTables sizeState="INTERMEDIATE" name="row1" matchingMode="ALL_ROWS" lookupMode="LOAD_ONCE"></inputTables>
  </nodeData>
</node>
```

## Fallos y correcciones aplicadas

1. **La ruta `pluginsDir` se interpretaba como la carpeta `studio`.** `TalendPluginScanner.scanStudioPlugins` añadía `\plugins` internamente, por lo que pasar la carpeta real de plugins escaneaba una ruta inexistente. El escáner ahora recibe directamente la carpeta `plugins`.
2. **El escaneo y el generador usaban cachés distintas.** El escaneo llenaba `.talend-mcp/component-cache.json`; búsqueda y generación leían `.talend-mcp/component-catalog.json`. La herramienta de escaneo ahora actualiza ambas cachés y devuelve el estado del catálogo.
3. **El lector de plugins JAR suponía que `jar` estaba en `PATH`.** En este equipo no estaba allí, aunque el JDK sí estaba configurado. Ahora usa `JAVA_HOME/bin/jar` cuando existe y conserva `jar` como fallback.

Las correcciones se cubren con pruebas de integración del escaneo y de resolución del ejecutable JAR: **2 pasaron**.

## Lo que sigue sin generarse

La corrección de las cachés no añade definiciones que no estén instaladas. Los 272 nombres `t*` faltantes necesitan sus definiciones de plugin disponibles para Talend 8.0.1. Los 88 nombres `c*` pertenecen a componentes Camel/Routes; el generador probado construye XML de componentes de Jobs y no implementa la creación de rutas Camel. Esos bloques requieren un catálogo y generador de Routes.

La pasada de 1.215 nombres ocurrió antes de aplicar las correcciones. Las pruebas posteriores verificaron el nuevo flujo con un plugin de prueba local; no se repitió el barrido completo contra Studio.
