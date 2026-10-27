# P02 · Archivos, XML y JSON

Niveles 3 y 4 del catalogo. En una migracion bancaria casi todo entra y sale por ficheros planos, Excel, XML o JSON,
asi que esta familia pesa tanto como las bases de datos.
- Catalogo: [file](../catalogo-componentes/file.md), [xml](../catalogo-componentes/xml.md),
  [unstructured](../catalogo-componentes/unstructured.md), [processing](../catalogo-componentes/processing.md)
  (`tExtract*`, `tWriteJSONField`) y [technical](../catalogo-componentes/technical.md) (los pares internos `*In`/`*Out`).
- Suites: `archivos`, `formatos`.
- Servicios externos: ninguno. Todo es local; los datos de entrada se generan en `testdata/`.
- Nivel de aceptacion esperado: **A en todos**. Los que dependen de algo externo se resuelven con la escalera de EMULADORES.md: `tGPGDecrypt` (instalar `gpg` y generar una clave en `testdata/`), `tFileInputMail`
  (un `.eml` de `testdata/` o GreenMail), `tNamedPipe*` (proceso auxiliar; `\.pipe` en Windows, `mkfifo` en Linux). Los pares internos `*In`/`*Out` se cubren con su componente visible (seccion 7).

## 1. Datos de prueba

Crea los ficheros de entrada con `scripts/make-testdata.ts` (o a mano en `testdata/`). Ya existen
`l5_clientes.csv`, `l5_clientes.json`, `l5_ventas.csv`. Para cada formato nuevo anade uno **pequeno y conocido**
(3 a 5 filas) para que la salida se pueda declarar exacta. Incluye siempre una fila "dificil":

| Formato | Fila dificil que tiene que haber |
|---|---|
| Delimitado | un campo con el separador dentro entre comillas, un campo vacio, un decimal con coma |
| Excel | una celda de fecha, otra numerica con formato, una hoja con titulo y otra sin |
| Posicional | un campo mas corto de lo declarado, otro con espacios al final |
| XML | un namespace, un atributo, un elemento repetido y otro opcional ausente |
| JSON | un array anidado, un `null` y un numero grande |
| Regex / Raw | una linea que no encaja con el patron |
| Codificacion | un acento (`Ninez`) en UTF-8 y en ISO-8859-1 |

## 2. Lectura y escritura de ficheros (nivel 3)

Orden: delimitado, posicional, Excel, JSON, XML, Raw/FullRow/Regex, Properties, LDIF/ARFF, Multi-schema (`MS*`).

| Componente | Que comprobar | Pistas y trampas |
|---|---|---|
| `tFileInputDelimited` / `tFileOutputDelimited` | `FIELDSEPARATOR`, `ROWSEPARATOR`, `HEADER`, `FOOTER`, `LIMIT`, `TEXT_ENCLOSURE`, `CSV_OPTION`, `REMOVE_EMPTY_ROW`, `ENCODING`, `APPEND`, `CREATE`, `SPLIT` | Los decimales se leen con `ADVANCED_SEPARATOR`; el numero de columnas del origen debe igualar al destino (asignacion por posicion). Ya hay varios escenarios; **anadir** los de cabecera, comillas y codificacion |
| `tFileInputPositional` / `tFileOutputPositional` | Anchos, `PATTERN` (`"5,10,8"`), relleno, `TRIM` | Un campo mas corto que el ancho debe leerse sin error; escribir y volver a leer |
| `tFileInputExcel` / `tFileOutputExcel` | Hoja por nombre, `FIRST_COLUMN`, `HEADER`, `.xls` y `.xlsx`, fechas | Requiere las librerias POI (`installMissing`). Escribir y leer de vuelta; comparar como texto |
| `tFileInputJSON` / `tFileOutputJSON` | `JSON_LOOP_QUERY`, `MAPPING_JSONPATH`, array raiz, objetos anidados | Raiz del bucle en `JSON_LOOP_QUERY`; las celdas de `QUERY` son literales con comillas |
| `tFileInputXML` / `tFileOutputXML` | `LOOP_QUERY` (XPath), `MAPPING`, namespaces, atributos | El `tFileOutputXML` escribe un arbol: comprobar el fichero resultante linea a linea |
| `tFileInputRaw` / `tFileOutputRaw` | Leer todo el fichero como un solo campo | Campo `String` o `byte[]` (`id_Object`) |
| `tFileInputFullRow` | Una linea = un campo | Util para ficheros de ancho variable |
| `tFileInputRegex` | `REGEX` con grupos, lineas que no encajan | Ya hay escenario; anadir la linea que no encaja |
| `tFileInputProperties` / `tFileOutputProperties` | `.properties` y `.ini` | Modo `ini`: seccion y clave |
| `tFileInputLDIF` / `tFileOutputLDIF` | Entradas LDAP en texto | Fichero de ejemplo con 3 entradas |
| `tFileInputARFF` / `tFileOutputARFF` | Formato Weka | Fichero minimo con `@relation` y `@data` |
| `tFileInputMSDelimited` / `MSPositional` / `MSXML` y sus `tFileOutputMS*` | Ficheros con **varios tipos de registro** | La parte mas dificil: un esquema por tipo de registro y un conector por tipo. Montalo en Studio y copia el `.item` |
| `tFileInputMail` | Leer un `.eml` | Con un `.eml` de `testdata/`; si exige POP/IMAP, GreenMail (`greenmail/standalone`) como A-emu |
| `tApacheLogInput` | Formato Common/Combined Log | Fichero de 3 lineas |
| `tFileInputParquet` / `tFileOutputParquet` / `tFileInputORC` / `tFileOutputORC` | Formatos columnares: escribir y leer de vuelta, con tipos (entero, decimal, fecha, nulo) | Requieren las librerias de Hadoop/Parquet/ORC (`installMissing`); comparar fila a fila tras la vuelta |
| `tFileOutputShadow` | Fichero "sombra" con las filas que paso por un punto | Escenario con salida exacta del fichero |
| `tExtractEDIField` | Sacar campos de un mensaje EDI (par con `tEDIFACTtoXML`) | Mensaje EDIFACT minimo en `testdata/` |

## 3. Gestion de ficheros (nivel 3)

| Componente | Que comprobar | Pistas |
|---|---|---|
| `tFileList` | `LIST_MODE`, filtros, recursivo, orden | Sus valores van al `globalMap` (`<nodo>_CURRENT_FILE`...): se leen con `tJava`/`tJavaRow` |
| `tFileCopy` / `tFileDelete` / `tFileExist` / `tFileTouch` | Copiar con y sin sobrescribir, borrar carpeta, comprobar existencia, tocar fecha | Todos hechos con L5; documentar los casos de error (origen inexistente) |
| `tFileCompare` | Iguales / distintos, modo de comparacion | Hecho; anadir distintos |
| `tFileArchive` / `tFileUnarchive` | `zip`, `gzip`, `tar`, `tar.gz`; con y sin contrasena | Descomprimir y comparar contenido con `tFileCompare` |
| `tFileProperties` | Tamano, fecha, atributos | La fecha varia: comprobar solo el tamano |
| `tFileRowCount` | Numero de filas | Resultado en `globalMap` (`<nodo>_COUNT`) |
| `tFileFetch` | Descargar por HTTP a un fichero | Servidor local `Bun.serve` (ver `scripts/l5/http-sink.ts`) |
| `tCreateTemporaryFile` | Fichero temporal con prefijo/extension | Su ruta va al `globalMap`; borrar al terminar |
| `tChangeFileEncoding` | UTF-8 a ISO-8859-1 y vuelta | Comparar bytes con un fichero esperado |
| `tWaitForFile` | Esperar a que aparezca | Hecho |
| `tGPGDecrypt` | Descifrar con una clave | Instalar `gpg` (Gpg4win/`apt`), generar una clave de prueba, cifrar un fichero en `testdata/` y descifrarlo en el job |

## 4. XML, JSON y estructuras (nivel 4)

Es lo mas dificil de la familia. Mismo metodo en todos: **montar en Studio, guardar, leer el `.item`, copiar**.

| Componente | Que cubre | Escenario sugerido |
|---|---|---|
| `tXMLMap` | Transformacion XML a XML con arbol; loop, joins, filtros | `tFileInputXML -> tXMLMap -> tFileOutputXML`. Su modelo (`nodeData`) es el mas grande; copiarlo del `.item` y parametrizar |
| `tWriteJSONField` / `tWriteXMLField` | Construir un documento a partir de filas y dejarlo en un campo | `tFixedFlowInput -> tWriteJSONField -> tLogRow`; agrupar por clave |
| `tExtractJSONFields` / `tExtractXMLField` | Sacar columnas de un campo que contiene JSON o XML | Inverso del anterior: debe haber ida y vuelta |
| `tExtractPositionalFields` | Partir un campo por anchos | Complementa a `tFileInputPositional` |
| `tAdvancedFileOutputXML` | Salida XML con estructura compleja y agrupaciones | Comprobar el fichero |
| `tXSLT` | Transformar con una hoja XSLT | Hoja de 5 lineas en `testdata/` y comparar la salida |
| `tXSDValidator` / `tDTDValidator` | Validar contra un esquema; ramas valido/invalido | Un fichero valido y otro invalido; el invalido debe salir por la rama de error con el motivo |
| `tSchemaComplianceCheck` | Comprobar tipos y longitudes de las filas | Filas buenas y malas; las malas salen por `REJECT` con el error |
| `tEDIFACTtoXML` | Convertir un mensaje EDI | Escribir un mensaje EDIFACT minimo (UNH...UNT) en `testdata/`; salida XML comparada |
| `tPivotToColumnsDelimited` | Pivotar a columnas | Entrada pequena y salida exacta |
| `tParseRecordSet` | Interpretar un conjunto de resultados de un `tXXXSP` | Depende de P03 (procedimientos almacenados): se prueba en cuanto un motor tenga su `SP` (S10); hasta entonces queda pendiente de P03, no sin probar |

## 5. Trampas conocidas de la familia

| Trampa | Que hacer |
|---|---|
| Columnas distintas entre el origen y el destino | El generador asigna por posicion; igualar el numero de columnas |
| Rutas de Windows | Barras normales en el JSON (`C:/datos/a.csv`); entrecomilladas (literal Java) |
| `Ninez` aparece como `NiÃ±ez` | `ENCODING` mal; fijar `"UTF-8"` en lectura y escritura |
| Separador de lineas | `ROWSEPARATOR` `"\n"` vs `"\r\n"`; el arnes compara texto, tenlo en cuenta al declarar la salida |
| Excel: falta la libreria | `talend_job_compile` con `installMissing:true` |
| XML con namespaces: el XPath no encuentra nada | Declarar el prefijo en la tabla de namespaces del componente o usar `local-name()` |
| `tFileInputJSON` | Ver SOLUCION seccion 2 |
| Un fichero de salida que ya existe | `CREATE`/`APPEND`/`FILE_EXIST_EXCEPTION`: probar los tres comportamientos |

## 6. Aceptacion de P02

- Los componentes de nivel 3 y 4 (50 y 14 hoy; la cifra viva esta en el catalogo) ejecutados (A o A-emu), con su ficha.
- Un escenario **de ida y vuelta** por formato (escribir y leer de vuelta, con salida exacta).
- Un caso de error claro por formato (fichero inexistente, columna que falta, XML mal formado).
- Fichas en `docs/fichas-componentes/file.md`, `xml.md`, `unstructured.md`.
- Los componentes `MS*` documentados con su patron de varios tipos de registro, aunque solo uno tenga escenario.

## 7. Componentes virtuales: los pares `In` / `Out`

Varios componentes de Studio son en realidad **dos** en el codigo: el que se ve en el lienzo y un par interno
(`tXMLMap` = `tXMLMapIn` + `tXMLMapOut`; `tWriteXMLField` = `tWriteXMLFieldIn` + `tWriteXMLFieldOut`;
`tAggregateRow` = `tAggregateIn` + `tAggregateOut`; `tSortRow`, `tUniqRow`, `tDenormalize`, `tMap` tienen el suyo).
Se reconocen en el catalogo porque estan en la familia `Technical` y tienen 0 o 1 parametro.

- **No se prueban solos.** Montarlos aislados da fallos enganosos: `Cannot load from object array because "treeObjs"
  is null`, `Index 0 out of bounds for length 0` o `nb_line_... cannot be resolved`. Es el componente visible el que
  crea el par al montarse con su modelo.
- Un `*In`/`*Out` queda cubierto cuando el componente visible esta ejecutado: su fila del catalogo lleva la nota "interno de `<componente visible>`", enlazando a la ficha
  de ese. No cuentan como pendientes de L5, pero si de la ficha del visible.
- Los fallos de L4 de esos nombres (`docs/catalogo-componentes/fallos-conocidos-l4.md`) se resuelven probando el
  componente visible con su modelo (`mapper`, `tablas`, `nodeData`), no el interno.
