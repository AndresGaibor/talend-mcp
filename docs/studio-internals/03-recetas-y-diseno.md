# Internals de Talend Studio: Recetas y diseno de jobs

[Indice completo](../TALEND-STUDIO-INTERNALS.md)

## 15. Receta: un job de humo de punta a punta

Con lo de arriba, un job `tFixedFlowInput` -> `tLogRow` se construye asi (script
`scripts/studio-job.ts fase0`):

1. `talend_job_delete_in_studio` con el nombre (borra del repositorio, no del disco).
2. `talend_job_create_in_studio` con `replace: true`.
3. `talend_job_add_node` con `tFixedFlowInput` y con `tLogRow`.
4. `talend_job_set_schema` con las columnas y los `values` (las filas de datos).
5. `talend_job_connect_nodes` con los dos unique names.
6. Comprobar el `.item`: nodos, conexiones y columnas.
7. Ejecutar.

El `.item` de un job de humo correcto:

```xml
<node componentName="tFixedFlowInput" componentVersion="0.101" posX="200" posY="80">
  <elementParameter field="TABLE" name="INTABLE">
    <elementValue elementRef="id" value="1" id="0"/>
    <elementValue elementRef="ciudad" value="&quot;Bogota&quot;" id="1"/>
    <elementValue elementRef="monto" value="100.5" id="2"/>
  </elementParameter>
  <metadata connector="FLOW" name="tFixedFlowInput_1">
    <column name="id" type="id_Integer" .../>
    <column name="ciudad" type="id_String" .../>
    <column name="monto" type="id_Double" .../>
  </metadata>
</node>
<node componentName="tLogRow" ...>
  <metadata connector="FLOW" name="tLogRow_1">...</metadata>
</node>
<connection connectorName="FLOW" source="tFixedFlowInput_1" target="tLogRow_1">
```

Y el job ejecutado imprime:

```
1|Bogota|100.5
2|Medellin|200.25
```

## 16. Regla de oro: verificar el resultado, no el `ok`

Una operacion del bridge puede devolver `ok: true` y no haber escrito nada. El fallo aparece
despues, cuando el job se ejecuta con el schema viejo o con el job vacio.

Por eso, tras cualquier operacion que escriba en el disco, hay que **mirar el archivo**:

```powershell
Get-Item "<job>.item" | Select-Object Length, LastWriteTime
```

Un `.item` de un job vacio pesa unos 196 bytes: es el `ProcessType` sin nodos. Si el peso no
ha cambiado tras anadir nodos, la operacion no llego al disco.

Y antes de ejecutar un job, hay que comprobar que el schema que ve Studio es el que se
escribio. El parametro mas revelador es `SCHEMA_OPT_NUM`: Studio lo deja con un valor
corrupto como `Main1100Main1` cuando el componente no se creo con su API.

El error `Unknown java id type : 'id_Decimal'` significa que el proceso en memoria de Studio
tiene un tipo de columna que ya no existe en el archivo. La solucion no es arreglar el
`.item`: es que el proceso se cree con la API de Studio, que aplica los valores por defecto
correctos.

## 17. Lo que queda sin resolver

- **La salida de la consola del run (vista Run) sigue sin poder leerse.** Se resolvio por otra
  via: `talend_job_execute` relanza el job generado y devuelve su salida (seccion 23).
- **El fin de ejecucion se detecta por sondeo del proceso del sistema operativo**, con el
  limite de los jobs que duran menos de 50 ms. La via limpia seria llamar a
  `Processor.run()`, que devuelve el `java.lang.Process` con su salida y su codigo de
  salida, pero hay que replicar el contexto y las opciones del run.
- **El codigo de columna se serializa bien pero `MetadataColumn.getType()` sigue vacio**:
  hay que leer `getTalendType()`. No es un bug de Talend, pero conviene recordarlo.

## 18. Configuracion declarativa de componentes

Para que el MCP cubra **todos** los componentes y no solo los que se
programaron a mano, la configuracion de un nodo se declara y se aplica con la
misma API para todos. Hay cuatro bloques, y los cuatro son genericos:

```json
{
  "type": "tFileInputDelimited",
  "parameters": { "FILENAME": { "value": "C:/datos/clientes.csv" },
                  "HEADER": { "value": "1" } },
  "tables":     { "INTABLE": { "columns": ["id", "ciudad"],
                               "rows": [["1", "Bogota"]] } },
  "schema":     [ { "connector": "FLOW", "name": "tFileInputDelimited_1",
                    "columns": [ { "name": "id", "type": "id_Integer" } ] } ],
  "mapper":     { "inputs": [], "outputs": [], "vars": [] }
}
```

- `parameters`: los parametros del componente. El valor puede venir como
  texto o como objeto con `value`, `field` (tipo de campo) y `literal`.
- `tables`: los parametros de tipo TABLE, con sus columnas y sus filas.
- `schema`: el metadata del nodo, por conector y por nombre de tabla.
- `mapper`: el modelo del tMap (transformaciones, filtros y joins). Es lo
  unico especifico de un componente, y vive en su propio adaptador.

### 18.1 Los valores de texto son literales Java

El generador de Talend escribe el valor del parametro tal cual en el codigo.
Una ruta tiene que ir entre comillas o el codigo no compila:

```java
Object filename_tFileInputDelimited_2 = C:\datos\clientes.csv;   // no compila
Object filename_tFileInputDelimited_2 = "C:\datos\clientes.csv";  // correcto
```

La regla que aplica el bridge:

- si el valor ya viene entrecomillado, se deja;
- si es un booleano o un numero, se deja (en Talend esos no son cadenas);
- en cualquier otro caso, se entrecomilla.

Y los booleanos y los numeros se distinguen porque el valor por defecto del
parametro en el catalogo ya lo dice. Ojo con `HEADER` del `tFileInputDelimited`:
no es un booleano sino el **numero de lineas de cabecera** ("1"), y si se
pone "true" el constructor de `FileInputDelimited` no cuadra y no compila.

### 18.2 Parametros que el catalogo no declara

Hay parametros que el componente no expone en el catalogo hasta que se
configura: el `FILENAME` del `tFileOutputDelimited` no esta, pero un job real
si lo tiene. Cuando el spec pide un parametro que no existe, el bridge lo
crea con el tipo indicado (o deducido: una ruta es un `FILE`). Es lo que hace
el IDE al migrar un job antiguo.

### 18.3 El nombre de una tabla del tMap es el de la conexion

El conversor del tMap empareja las tablas del modelo con las conexiones por
nombre. Si el modelo declara la tabla "out1" y la conexion se llama "conn_1",
las expresiones se pierden. Por eso el bridge usa **los nombres reales de las
conexiones** del nodo, no los que declara el spec.

### 18.4 El modelo del tMap se aplica al final

Al conectar, Talend rehace las tablas del tMap segun las conexiones y se
pierde lo que se hubiera puesto antes. El orden correcto es:

1. crear los nodos;
2. conectar;
3. poner el schema;
4. **el modelo del mapper, al final**.

### 18.5 Como se guarda el `nodeData`

El `nodeData` (el modelo del tMap) es un objeto EMF que puede seguir apuntando
al recurso anterior. Si se guarda tal cual, el `.item` sale sin el. La
solucion es la misma que usa Studio: **copia en profundidad** antes de
colgarlo.

```java
Object copia = EcoreUtil.copy(nodeData);
nodeType.setNodeData(copia);
```

### 18.6 Consultar el catalogo: la pieza que hace esto escalable

El MCP no puede adivinar como se configura un componente. La tool
`talend_studio_component_parameters` lee del catalogo que publica el propio
Studio los parametros de un componente, con su tipo y su valor por defecto:

```
talend_studio_component_parameters {"name": "tSortRow"}
  -> CRITERIA [TABLE] = []
     PARALLELIZE_NUMBER [TEXT] = 2
     ...
```

Con eso, configurar un componente nuevo es un paso de leer su ficha, no de
adivinar: el nucleo no conoce ningun componente concreto y anadir soporte
para uno nuevo es anadir un adaptador (`MapperConfigurer`), no tocar el nucleo.


### 18.7 Las columnas de las tablas tambien salen del catalogo

Un componente con tablas (el `tFilterRow`, el `tSortRow`, el `tUniqRow`, el
`tAggregateRow`) tiene sus propias columnas, y saber cuales son es
indispensable para rellenarlas. La tool las devuelve:

```
talend_studio_component_parameters {"name": "tSortRow"}
  -> CRITERIA [TABLE] columnas: [COLNAME, SORT, ORDER]

talend_studio_component_parameters {"name": "tUniqRow"}
  -> UNIQUE_KEY [TABLE] columnas: [SCHEMA_COLUMN, KEY_ATTRIBUTE, CASE_SENSITIVE]

talend_studio_component_parameters {"name": "tAggregateRow"}
  -> GROUPBYS   [TABLE] columnas: [OUTPUT_COLUMN, INPUT_COLUMN]
  -> OPERATIONS [TABLE] columnas: [OUTPUT_COLUMN, FUNCTION, INPUT_COLUMN, IGNORE_NULL]
```

Con eso, la tabla se rellena con el formato de `elementValue` que usa Talend:

```xml
<elementParameter field="TABLE" name="CRITERIA">
  <elementValue elementRef="COLNAME" value="row1.monto" id="0"/>
  <elementValue elementRef="SORT" value="" id="1"/>
  <elementValue elementRef="ORDER" value="DESC" id="2"/>
</elementParameter>
```

**Ojo**: con esto se puede generar el `.item` de cualquier componente, pero no
garantiza que el **generador de codigo** lo acepte. El `tFilterRow` y el
`tUniqRow` resuelven el valor de la condicion contra las columnas del schema
(`rightColumn`, `inputColumn`) y si no lo encuentra petan con un
`NullPointerException` al generar el codigo. El formato que espera el generador
no esta en el catalogo: solo estan los nombres de columna. Para esos
componentes hay que mirar como los deja el IDE o usar el `tMap`.


### 18.8 El codigo Java va tal cual, sin comillas

Los memos (el `CODE` del `tJavaRow`, el `CLASS_CODE` del `tJava`) no son
literales: el generador los escribe dentro del codigo, asi que **no se
entrecomillan**. Si se entrecomillaran, el codigo no compilaria.

```java
// tal cual
output_row.acumulado = acumulado;
```

Y las variables locales se declaran en el propio codigo: si no, el generador
no las encuentra y falla con `acumulado cannot be resolved to a variable`.

### 18.9 Los numeros llevan el sufijo de su tipo

`100` es un int y no un Double. Al rellenar la tabla de datos de un
`tFixedFlowInput` con una columna `id_Double`, el valor tiene que salir como
`100.0`, o el codigo generado no compila con
`Type mismatch: cannot convert from int to Double`.

El bridge lo hace solo al formatear el literal:

| Tipo | Valor | Literal |
|---|---|---|
| `id_Integer` | 100 | `100` |
| `id_Long` | 100 | `100L` |
| `id_Double` | 100 | `100.0` |
| `id_BigDecimal` | 100 | `new java.math.BigDecimal("100")` |
| `id_String` | Bogota | `"Bogota"` |
| `id_Boolean` | true | `true` |
| `id_Date` | 2023-01-15 | `new java.sql.Timestamp(1673740800000L)` |

### 18.10 Al borrar un job hay que borrar su proyecto generado

Studio deja por cada job un proyecto Java en el workspace, bajo
`poms/jobs/process/<job>`. Si se borra el job del repositorio pero no esa
carpeta, al recrearlo Talend reutiliza el proyecto viejo, con su `target` y su
`.project` de antes, y la ejecucion falla con:

```
El recurso /PRJ_BANCOLOMBIA_MI_JOB_0.1/src/main/java/prj_bancolombia no existe
```

Por eso `talend_job_delete_in_studio` borra tambien esa carpeta.

### 18.11 Instalar los modulos que faltan

Los componentes de "processing" (tMap, tJavaRow, tSortRow, tAggregateRow,
tFilterRow) usan un runtime que no viene con Studio: hay que descargarlo. Al
ejecutar un job con ellos, Studio abre un dialogo pidiendo los modulos.

El guardian **no los descarga solo** (es una decision de red), pero da tiempo:
el dialogo se deja abierto 30 s. Con la tool
`talend_studio_install_modules` se pulsa "Download and Install" de forma
explicita.

Sin los modulos, el `classpath.jar` del job sale vacio y al ejecutarlo a mano
falla con `NoClassDefFoundError: routines/system/api/TalendJob`.

## 21. La carga en caliente: lo que hay que soltar antes de recargar

Cuando se recompila el plugin, `HotReloadService` recarga el bundle con
`Bundle.update()`. OSGi descarta el classloader, para el Activator y lo
vuelve a iniciar.

**Si algo del bundle viejo sigue vivo, el IDE se queda con clases muertas** y
la siguiente operacion falla con:

```
IllegalStateException: Invalid class loader from a refreshed bundle is being used
```

Lo que hay que soltar antes de recargar:

- **el servidor HTTP**: si sigue escuchando, atiende las peticiones con las
  clases del bundle descartado;
- **el hilo del guardian de modales**: sigue vivo usando las clases viejas.

Por eso el `Activator` registra en el `HotReloadService` un `beforeReload` que
para las dos cosas.


### 18.12 Llamar a otro job: el PROCESS_TYPE y sus tres parametros tecnicos

Los componentes que lanzan otro job (el `tRunJob`, el `tRunRoutine`) guardan la
referencia en cuatro parametros, y con solo la etiqueta no basta:

```xml
<elementParameter field="PROCESS_TYPE" name="PROCESS" value="&quot;MI_JOB_HIJO&quot;"/>
<elementParameter field="TECHNICAL" name="PROCESS:PROCESS_TYPE_CONTEXT" value="Default"/>
<elementParameter field="TECHNICAL" name="PROCESS:PROCESS_TYPE_PROCESS" value="PRJ-BANCOLOMBIA:_5fdc50e8993c"/>
<elementParameter field="TECHNICAL" name="PROCESS:PROCESS_TYPE_VERSION" value="Latest"/>
```

El `PROCESS:PROCESS_TYPE_PROCESS` es `<etiqueta del proyecto>:<id interno del
item>`, y el id interno es el atributo `id` del `.properties` del job hijo. Por
eso el bridge, cuando el parametro es de tipo `PROCESS_TYPE`, completa solo los
tres tecnicos: basta con pedir `PROCESS` con la etiqueta del job hijo.

### 18.13 Los avisos de Talend son MessageBox nativos

El "Jobname Error" y el aviso de error de generacion **no son shells de SWT**:
son el `MessageBox` nativo de Windows (`org.eclipse.swt.internal.win32.OS`).
Eso tiene dos consecuencias:

- No aparecen en `Display.getShells()`, asi que el guardian no los ve.
- Bloquean el hilo de la UI a nivel de sistema operativo: el bucle de mensajes
  de SWT no se ejecuta y **ninguna** llamada al hilo de la UI responde (el
  `UiThread.sync` se queda esperando hasta agotar el tiempo).

La unica forma de cerrarlos desde Java es simular la tecla: el guardian
detecta que la interfaz lleva unos segundos ocupada y pulsa Enter, que es el
boton por defecto de esos avisos.

Para diagnosis: un volcado de hilos muestra el hilo principal de Studio
parado en `org.eclipse.swt.internal.win32.OS.MessageBox(Native Method)`.

## 22. Lo que funciona y lo que no

| Fase | Prueba | Estado |
|---|---|---|
| 0 | `tFixedFlowInput` -> `tLogRow` | funciona |
| 1 | `tFileInputDelimited` -> `tLogRow` | funciona |
| 1 | `tFileInputDelimited` -> `tFileOutputDelimited` | funciona |
| 2 | `tMap` con transformaciones y filtro | el `.item` sale bien; no compila |
| 3 | `tUniqRow`, `tAggregateRow`, `tSortRow` | el `.item` sale bien; no genera codigo |
| 4 | `tJavaRow` con codigo propio | funciona |
| 6 | `tPrejob`, `tPostjob`, `tRunJob` entre jobs | funciona |

Las dos que no llegan a ejecutarse son por el entorno, no por el diseno:

- La **Fase 2** necesita el modulo `talend-tmap-dataset-1.2.16.jar`, que es de
  Talend Exchange y no esta en Maven Central ni en los repositorios publicos
  de Talend. Sin el, el `classpath.jar` del job sale vacio.
- La **Fase 3** falla porque el generador de las transformaciones resuelve el
  valor de la condicion contra las columnas del schema y el formato interno
  que espera no esta en el catalogo (solo los nombres de columna). Es la parte
  que falta por descubrir: la forma exacta de la condicion.
