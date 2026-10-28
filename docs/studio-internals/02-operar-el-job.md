# Internals de Talend Studio: Operar sobre el job abierto

[Indice completo](../TALEND-STUDIO-INTERNALS.md)

## 11. Operar sobre el job abierto con la API de Studio

Escribir el `.item` a mano obliga a reproducir el formato XML de Talend: el `context`, el
`metadata`, el `LENGTHS` de cada componente, los tipos Java de columna. studio no avisa de
los cambios hechos por fuera, asi que ademas hay que forzar la recarga del modelo EMF. Son
fallos que aparecen uno a uno y con nombres de error poco descriptivos.

La via correcta es operar sobre el job abierto con la API del propio IDE. El bridge expone
estas operaciones:

| Operacion | Endpoint | Que hace |
|---|---|---|
| Crear job | `POST /automation/job/create` | Crea el item en el repositorio de Talend y lo abre en el editor |
| Anadir nodo | `POST /automation/nodes/add` | Anade un componente con todos sus parametros por defecto |
| Conectar | `POST /automation/nodes/connect` | Conecta dos nodos del flujo |
| Modificar | `POST /automation/nodes/update` | Cambia parametros o etiqueta de un nodo |
| Borrar | `POST /automation/nodes/delete` | Elimina nodos del job |
| Copiar | `POST /automation/nodes/copy` | Copia un nodo, como el portapapeles del editor |
| Listar | `POST /automation/nodes/list` | Nodos del job abierto |
| Ejecutar codigo | `POST /automation/run-code` | Compila y ejecuta Java dentro de Studio |

### Como se anade un nodo

`Node(component)` crea el nodo con la definicion del componente y todos sus parametros y
valores por defecto. Eso es justo lo que el MCP no puede reproducir a mano.

```java
Node node = new Node(catalogComponent);
NodeContainer container = new NodeContainer(node);
CreateNodeContainerCommand command =
    new CreateNodeContainerCommand(process, container, location);
commandStack.execute(command);
```

`CreateNodeContainerCommand` es la clase concreta de `CreateCommand`, que es abstracta. El
`Process.addNodeContainer(...)` es el metodo publico que registra el nodo en el modelo.

### Como se conecta

`ConnectionCreateCommand` es el comando que usa el editor al arrastrar una conexion:

```java
ConnectionCreateCommand command =
    new ConnectionCreateCommand(sourceNode, "FLOW", new ArrayList<>());
command.setTarget(targetNode);
command.execute();
```

### Como se crea el job

El item se crea con la factoria EMF del modelo y se registra en el repositorio:

```java
Object factory = PropertiesFactory.eINSTANCE;
Property property = factory.createProperty();
property.setId(id);
property.setLabel(name);
property.setVersion(version);

ProcessItem item = factory.createProcessItem();
item.setProperty(property);
item.setState(factory.createItemState());

// El recurso del `.item`: sin el, el `.item` sale vacio.
Resource itemResource = xmiResourceManager.createItemResource(
    iProject, item, Path.fromOSString("process/" + nombre), ERepositoryObjectType.PROCESS, false);

// El `ProcessType` va DENTRO del recurso, no suelto.
ProcessType processType = TalendFileFactory.eINSTANCE.createProcessType();
((List<Object>) itemResource.getContents()).add(processType);
item.setProcess(processType);

repositoryFactory.create(project, item, Path.fromOSString(nombre));
```

Detalles que hay que respetar o la llamada falla:

- **El `ProcessType` es el contenido del `.item` y tiene que vivir en un `TalendXMIResource`
  del resource set del proyecto.** Si se crea suelto, el repositorio lo serializa vacio: el
  `.item` sale con 196 bytes y sin nodos. El recurso se pide con
  `XmiResourceManager.createItemResource(iProject, item, ruta, PROCESS, false)`. El ultimo
  booleano decide el tipo: `false` es el `TalendXMIResource` (el del `.item`) y `true` un
  `ByteArrayResource` (el del `.properties`). Con `true` falla con
  `ProcessTypeImpl cannot be cast to ByteArray`.
- **El `ItemState` marca el item como vivo.** Sin el, el repositorio lo considera borrado.
- **Dos rutas distintas, y no son la misma.** La que espera `repositoryFactory.create()` es la
  de la carpeta **sin** la carpeta del tipo de objeto: `Path.fromOSString(nombre)`. El
  repositorio antepone `process/` y crea dentro los tres archivos del job. La que espera
  `createItemResource()` si lleva la carpeta del tipo: `process/MiJob`. Con la ruta equivocada
  el item acaba en `process/process/MiJob`.
- **El label del job no puede llevar puntos ni guiones.** El repositorio lo valida con
  `^[a-zA-Z]+[a-zA-Z0-9_]*$` y rechaza el item si no cumple.
- **`repositoryFactory.create()` sin recurso previo falla** con
  `The 'no null' constraint is violated`: intenta meter en el recurso un `ProcessType` que
  todavia no existe. Por eso el recurso se crea antes.
- **Si ya existe un job con esa etiqueta, Studio abre el modal "Jobname Error"** ("Etiqueta X
  is already in use, do you want to replace it?") y el hilo de la UI se queda dentro del
  dialogo. Hay que comprobar el repositorio ANTES de crear, no despues. Ver seccion 13.

Studio escribe despues los tres archivos que acompañan a un job: el `.item`, el
`.properties` y el `.screenshot`.

Con la ruta bien puesta, el resultado en disco es:

```
process/MiJob/MiJob_0.1.item
process/MiJob/MiJob_0.1.properties
process/MiJob/MiJob_0.1.screenshot
```

Es decir: una carpeta por job, con los tres archivos dentro. Un job creado a mano desde el
IDE tiene la misma forma.

### Consultar el repositorio

`getAllVersion` y `getProcessItem` no encuentran los jobs por su nombre. El id que espera el
repositorio es el id interno de la propiedad, que en el `.properties` es el atributo `id` del
elemento `Property`:

```xml
<TalendProperties:Property xmi:id="_aQicUMzNEfGJMsMWYwBlcw" id="_83101607873700" label="MCP_Fase0_Api" ...>
```

No es el `xmi:id` de la raiz del `.item` (el `.item` de un job vacio no lo tiene) sino el
atributo `id` del `.properties`. Con ese id, `ItemCacheManager.getProcessItem(projectLabel, id,
version)` devuelve el item y `ProcessEditorInput` carga el proceso.

`getAllVersion` tiene tres sobrecargas y solo una sirve para listar:

| Firma | Nota |
|---|---|
| `getAllVersion(Project, String, boolean)` | Con el id vacio no devuelve nada |
| `getAllVersion(Project, String, String, ERepositoryObjectType)` | La que lista, con id y tipo |
| `getAllVersion(String)` | Por path de proyecto |

`ERepositoryObjectType` no es un enum: son constantes estaticas. La de job es `PROCESS`
(no `PROCESS_JOB`).

### Anadir nodos sin pasar por el command stack

El command stack (`CreateNodeContainerCommand`) es la via del editor, y ya funciona desde el
bridge. Pero para construir un job entero por codigo, `Process.addNodeContainer(...)` es mas
directo: crea el `NodeContainer`, lo registra en el modelo y devuelve el nodo ya con su
unique name asignado por Studio.

```java
Node node = new Node(catalogComponent);
NodeContainer container = new NodeContainer(node);
node.setLabel("entrada");
node.setLocation(new Point(200, 100));
process.addNodeContainer(container);
```

El unique name lo pone Studio: `tFileInputDelimited_7`, `tLogRow_2`.

### Conectar nodos

`ConnectionCreateCommand` es el comando que usa el editor al arrastrar una conexion. Su
tercer argumento no es una lista cualquiera: el constructor lee los tres primeros elementos
sin comprobar nada, asi que la lista no puede ir vacia.

```java
List<Object> meta = new ArrayList<>();
meta.add(metaName);        // nombre del schema de la conexion
meta.add(connectionName);  // nombre de la conexion
meta.add(metadataTable);   // IMetadataTable con el schema que viaja

ConnectionCreateCommand command =
    new ConnectionCreateCommand(sourceNode, "FLOW", meta);
command.setTarget(targetNode);
command.execute();
```

Si la lista va vacia, el constructor revienta con
`IndexOutOfBoundsException: Index 0 out of bounds for length 0`.

### Trampa: `isDirty` del editor no ve los cambios del modelo

Hay dos indicadores de cambio y no significan lo mismo:

| Indicador | Que mira |
|---|---|
| `editor.isDirty()` | El estado de la UI: paginas abiertas y command stack de GEF |
| `process.isProcessModified()` | El estado real del modelo de Talend |

`AbstractMultiPageTalendEditor.isDirty()` solo mira `propertyIsDirty` y las paginas.
`AbstractTalendEditor.isDirty()` solo mira `dirtyState` y `getCommandStack().isDirty()`.
Ninguno de los dos consulta `process.isProcessModified()`.

Consecuencia: un job modificado por la API (parametros, schema, conexiones) queda con
`editor.isDirty() == false` y `process.isProcessModified() == true`. Si el guardado comprueba
`isDirty`, **no escribe nunca**, aunque la operacion haya devuelto `ok: true`.

La solucion es preguntar al proceso:

```java
process.setProcessModified(true);
editor.doSave(new NullProgressMonitor());
```

La comprobacion de `isDirty` tiene sentido en un guardado pedido por el usuario desde el menu
(para no escribir sin cambios). En una operacion que el bridge acaba de hacer, lo que se
quiere es guardar siempre.

### Trampa: las rutas literales van entre comillas

Un `FILENAME` con una ruta literal se guarda **entre comillas** en el `.item`:

```xml
<elementParameter field="FILE" name="FILENAME" value="&quot;C:/Users/datos/Carga.csv&quot;"/>
```

Si el valor va sin comillas, Talend lo interpreta como una expresion Java y el codigo generado
sale mal:

```java
Object filename_tFileInputDelimited_1 = C:/Users/datos/Carga.csv;
```

y la ejecucion falla con:

```
The Job "MiJob" has wrong configuration. Fix it and try again.
Error Line: 1028
Detail Message: Carga cannot be resolved to a variable
```

La comilla no es decorativa: en el `.item` se escribe como entidad XML `&quot;`.

Cuando el valor viene de una variable global, en cambio, es una expresion Java y no lleva
comillas:

```xml
<elementParameter field="FILE" name="FILENAME" value="(String) globalMap.get(&quot;RUTA_RESULTADO&quot;)"/>
```

Al pasar un valor por la API hay que decidir cual de las dos formas es la correcta. Un valor
con comillas se trata como literal; un valor sin comillas, como expresion.

### Trampa: un proceso propio no persiste nada

**Crear un `ProcessEditorInput` propio y llamar a `saveXmlFile()` no escribe el job.** El
proceso cargado asi es una copia suelta: el `.item` del disco se queda con 196 bytes (el
`ProcessType` vacio) aunque el guardado devuelva `true` y los nodos esten en memoria.

La via que si funciona es trabajar sobre el **editor real** de Talend:

1. Abrir el archivo con `WorkbenchService.openResource(ruta)`, que abre el editor de jobs.
2. Operar sobre `editor.getDesignerEditor().getProcess()`, que es el proceso vivo.
3. Guardar con el guardado del editor (`doSave`), no con `saveXmlFile` del proceso.

Los nodos anadidos a un proceso propio tampoco persisten entre ejecuciones: al recargar el
item, el proceso vuelve a estar vacio. Hay que anadir, configurar, conectar y guardar en la
misma operacion, sobre el editor abierto.

Este es el fallo que hizo que un job creado con la API de Talend quedara vacio en disco
pese a que todas las operaciones devolvieran `ok: true`.

### Trampa: cambiar un parametro no marca el editor como dirty

`setValue` sobre un `ElementParameter` no dispara el aviso de cambio, asi que el editor sigue
sin cambios pendientes y el guardado no escribe nada:

```
"saved": false, "message": "Editor no esta dirty, no se necesita guardar"
```

Hay que marcar el proceso a mano: `process.setProcessModified(true)`. El bridge lo hace tras
cada operacion que modifica el job.

### `run_code`: libertad total

`POST /automation/run-code` compila y ejecuta Java dentro de Studio. El codigo ve las mismas
APIs que ve el IDE, asi que sirve para lo que no cabe en una tool: explorar una API
desconocida, consultar el estado interno o hacer una operacion que aun no tenga endpoint.

El codigo debe tener una clase con un metodo estatico `public static Object run()`. El valor
que devuelva se serializa a JSON.

```java
public class MiConsulta {
  public static Object run() throws Exception {
    Map<String, Object> out = new LinkedHashMap<>();
    Class<?> pm = Class.forName("org.talend.repository.ProjectManager");
    Object pmi = pm.getMethod("getInstance").invoke(null);
    Object project = pm.getMethod("getCurrentProject").invoke(pmi);
    out.put("proyecto", project.getClass().getMethod("getLabel").invoke(project));
    return out;
  }
}
```

Detalles de la implementacion:

- Se compila con `javax.tools.JavaCompiler`, que viene en el modulo `jdk.compiler` del JDK
  que ejecuta Studio. El runtime de Studio no trae el compilador, pero su JDK si.
- El classpath se arma con los jars de los bundles cargados.
- **Las clases de Talend se cargan desde los bundles del framework, no desde los jars.** Si se
  cargaran desde el jar, el codigo veria una copia distinta de las clases que usa el IDE, con
  singletons y caches diferentes, y las llamadas a la API fallarian.
- Solo corre si `unsafeActions` esta activo y el modo no es lectura. Ejecutar codigo
  arbitrario puede tocar el workspace de forma irreversible.

## 12. Operar sobre el job abierto: lo que faltaba

Esta seccion recoge lo que se descubrio al intentar crear un job desde cero, arrastrar
componentes de la paleta y ejecutar el job.

### 12.1 El nombre unico lo genera el proceso, no el comando

Un nodo recien creado no tiene nombre: su parametro `UNIQUE_NAME` nace vacio. El comando de
alta (`CreateNodeContainerCommand.execute()`) **no lo genera, solo lo registra**:

```java
// CreateNodeContainerCommand.execute()
Node.getElementParameter(UNIQUE_NAME).getValue().toString();
process.addUniqueNodeName(nombre);
```

Es decir, lee el parametro y lo anota en la lista del proceso. Si el parametro esta vacio, el
proceso registra una cadena vacia y el nodo se queda sin nombre.

Consecuencias:

- **Un nodo sin nombre unico no se serializa.** `saveXmlFile()` lo salta, asi que el `.item`
  se queda con 0 nodos aunque en el lienzo se vea el componente.
- **El nombre unico lo pone `process.generateUniqueNodeName(node)`**, que hay que llamar
  ANTES de ejecutar el comando y volcar el resultado en el parametro `UNIQUE_NAME`.

```java
String nombre = (String) process.generateUniqueNodeName(node);
node.getElementParameter("UNIQUE_NAME").setValue(nombre);
```

El contador es global del proceso: el primer nodo de un job nuevo es `tLogRow_1`.

### 12.2 Los parametros del componente se piden al componente

`new Node(component)` deja el nodo **sin parametros**. Los crea el propio componente a partir
de su definicion, y ahi estan los valores por defecto (el `ENCODING`, el `FIELDSEPARATOR`, el
schema fijo de los componentes que lo traen...).

El metodo no es publico, asi que hay que buscarlo entre los declarados:

```java
Method create = null;
for (Method m : nodeClass.getDeclaredMethods()) {
  if ("createElementParameters".equals(m.getName()) && m.getParameterCount() == 0) {
    create = m;
  }
}
create.setAccessible(true);
create.invoke(node);
```

Con `tFixedFlowInput` eso da 41 parametros y con `tLogRow` 42. Sin este paso el nodo se
queda sin parametros y el generador de codigo falla.

El orden importa: primero los parametros (que crean el `UNIQUE_NAME` vacio), despues el
nombre unico.

### 12.3 Trampa: `doSave` no guarda nada si el editor no esta "dirty"

`AbstractMultiPageTalendEditor.doSave()` empieza asi:

```java
if (!isDirty()) {
  return;   // <-- sale sin hacer nada
}
```

`isDirty()` es el indicador de la **interfaz**, no el del modelo de Talend. Los cambios que
hace la API no lo activan. Por eso `editor.doSave()` no escribe: el `.item` se queda como
estaba.

La trampa se nota al conectar: si el nodo se anade por el command stack, el editor se marca
sucio y `doSave` funciona; si la conexion se crea llamando a `execute()` directamente, el
editor sigue limpio y la conexion nunca llega al disco.

### 12.4 Guardar el job: `saveXmlFile` y reemplazar el contenido del recurso

`editor.doSave()` no es la via. Lo que funciona es esto:

```java
// 1. Talend construye el ProcessType completo desde el modelo grafico.
ProcessType nuevo = process.saveXmlFile();

// 2. El ProcessType enlazado al item NO es ese: es el que cargo el `.item`.
ProcessType enlazado = item.getProcess();
Resource resource = enlazado.eResource();

// 3. Se deja el nuevo como contenido del recurso y se guarda.
resource.getContents().clear();
resource.getContents().add(nuevo);
item.setProcess(nuevo);
resource.save(new HashMap());
```

Por que hace falta: el `ProcessType` enlazado al recurso tiene los **nodos** (el modelo
grafico los va anadiendo ahi), pero **no las conexiones ni el metadata**, que solo existen
en el `ProcessType` que arma `saveXmlFile()`. Medido en un job con dos nodos y una conexion:

| ProcessType | nodos | conexiones |
|---|---|---|
| enlazado al item | 2 | 0 |
| el de `saveXmlFile()` | 2 | 1 |

Despues de volcar y guardar, el `.item` tiene las dos cosas.

Al vaciar y rellenar `getContents()` hay que **copiar la lista antes**: al meter un objeto EMF
en un contenedor, EMF lo saca del contenedor viejo y salta un `ConcurrentModificationException`
si se esta recorriendo esa misma lista.

### 12.5 El schema: metadata y tablas

Definir el schema de un nodo son dos cosas:

1. **El metadata del nodo**: la lista de columnas con su tipo Java. Va en el `metadata` del
   `.item`, colgando del `node`. El `tableName` tiene que ser el **unique name** del nodo
   (como en los jobs que escribe el IDE) y la tabla tiene que ir colgada de un conector
   (`attachedConnector`), si no Studio no la serializa.

   La columna se crea con `MetadataColumn` y su tipo va en `setTalendType()`. El `setType()`
   se queda vacio: el `getType()` de la columna de metadata **no devuelve el tipo**, hay que
   leer `getTalendType()`.

2. **La tabla del componente**, si la tiene. Los componentes con schema fijo (`tFixedFlowInput`)
   guardan los datos en tablas de tipo `TABLE`:

   - la de codigos `SCHEMA_COLUMN`/`VALUE` define las columnas y su valor por defecto;
   - la que tiene `columnsBasedOnSchema` (en `tFixedFlowInput` se llama `INTABLE`) guarda los
     registros: una fila por registro, con una entrada por columna.

   El formato en memoria de una tabla es **una lista de mapas**: cada mapa es una fila y sus
   claves son los codigos de columna. Al serializar, Talend convierte cada celda en un
   `elementValue`:

   ```xml
   <elementParameter field="TABLE" name="INTABLE">
     <elementValue elementRef="id" value="1" id="0"/>
     <elementValue elementRef="ciudad" value="&quot;Bogota&quot;" id="1"/>
     <elementValue elementRef="monto" value="100.5" id="2"/>
   </elementParameter>
   ```

   Los **valores son literales Java**: las cadenas van entre comillas. Si se escribe `Bogota`
   a pelo, el codigo generado sera `conn_1.ciudad = Bogota;` y no compila
   (`Bogota cannot be resolved to a variable`).

   Ademas, `tFixedFlowInput` nace en modo single (`USE_SINGLEMODE=true`, `USE_INTABLE=false`),
   y en ese modo la tabla de datos se ignora. Para que el job saque filas hay que poner
   `USE_SINGLEMODE=false` y `USE_INTABLE=true`.

### 12.6 Trampa: la conexion se ejecuta por el command stack

`ConnectionCreateCommand` se puede ejecutar a mano, y la conexion aparece en el modelo
grafico (`node.getOutgoingConnections()`). Pero si no se ejecuta por el command stack, el
editor no se marca como modificado y el guardado se salta la conexion. Con el command stack
todo va bien:

```java
designerEditor.getCommandStack().execute(command);
```

### 12.7 Trampa: el item fantasma

Si se borran los archivos del job a mano en vez de borrarlo del repositorio, el repositorio
se queda con el item. La proxima vez que se cree un job con la misma etiqueta:

- el modal "Jobname Error" aparece y bloquea el hilo de la UI;
- el item creado apunta al recurso viejo y al abrirlo falla con
  `El proxy NO se resolvio despues de cargar el resource. URI proxy: .../process/process/...`.

Hay que borrar el item con `repositoryFactory.deleteObjectPhysical(project, viewObject)`, que
ademas borra los archivos.

## 13. El guardian de modales

Studio abre modales que bloquean el IDE entero: el hilo de la UI se queda dentro del bucle
modal del dialogo y ni el IDE ni el bridge pueden seguir. El mas molesto es el
"Jobname Error" al reusar la etiqueta de un job.

`ModalGuard` (en el plugin) puede cerrar los **conocidos**, pero **por defecto no cierra
ninguno solo**: un modal lo contesta quien lo ve (o la tool `talend_studio_dismiss_dialogs`).

- Un hilo vigilante, **apagado por defecto**, revisa cada 1,2 s los shells del `Display` que no
  sean la ventana del workbench. Se activa con `"autoDismissModals": true` en
  `~/.talend-bridge/config.json` y hay que reiniciar Studio o recargar el plugin.
- Solo actua sobre dialogos conocidos (`Jobname Error`, `Invalid Job Name`, `Save Resource`,
  modulos de terceros): pulsa el boton que corresponde.
- Un dialogo desconocido se reporta en `dialogs` y se deja abierto. No se pulsan botones "seguros"
  ni se cierra el shell, y no se simulan teclas.
- Los shells de SWT **solo se tocan desde el hilo de la UI**: el vigilante usa
  `UiThread.sync(...)`. Si se llama `Display.getShells()` desde otro hilo, SWT lanza
  `Invalid thread access`.

Para pulsar un boton hay que lanzar el evento de seleccion, no llamar a `click()`: los
dialogos de JFace escuchan la seleccion, no el raton. Y el texto del boton lleva el mnemonic
("&Yes"), asi que hay que comparar sin el.

Verificado: un `MessageDialog` de JFace con el titulo "Jobname Error" se cierra en 0,3 s y
devuelve la respuesta "Si" cuando se invoca el guardian.

La tool `talend_studio_dismiss_dialogs` fuerza el cierre de los conocidos bajo demanda. Para ver
que hay abierto sin tocarlo, `talend_studio_ui_dialogs` (solo lectura).

## 14. El fin de la ejecucion de un job

Talend ejecuta cada job en una JVM aparte. `LaunchTrackerService` registra el arranque y tiene
que marcar el fin. En Windows no lo hacia (ver 14.1): las ejecuciones quedaban en `started`.

- **El evento de fin de Eclipse no sirve.** `DebugPlugin` tiene el listener del bridge
  registrado (verificado), pero no recibe el fin de estos lanzamientos: Talend lanza el proceso
  con `Processor.run()`, que devuelve un `java.lang.Process` y no pasa por el `ILaunch`.
  `Launch.isTerminated()` devuelve `false` si el launch no tiene procesos ni targets
  (bytecode de `org.eclipse.debug.core.Launch`), asi que tampoco sirve como senal.
- **La senal es el proceso del sistema operativo, observado desde el arranque.** Un hilo
  vigilante por lanzamiento (`observe` en `LaunchTrackerService`) busca el proceso del job cada
  3 s y, cuando aparece, espera a `ProcessHandle.onExit()`. Antes la busqueda solo ocurria dentro
  de `/launch/wait`: un job que terminaba antes de esa llamada no se detectaba nunca.
- **Limites:** un proceso que vive menos que el intervalo de sondeo (unos 3 s) puede no verse, y
  el launch queda `unobserved`. El `exitCode` no esta disponible: `ProcessHandle` no lo expone en
  Java 21, asi que el estado es `terminated_without_exit_code`. Con dos lanzamientos concurrentes
  del mismo job, la asignacion del proceso sigue el orden de arranque. Al recargar el plugin en
  caliente, los vigilantes se paran y los launches en curso pasan a `unobserved`.

La salida del job (las filas que imprime `tLogRow`) va a la consola de la vista Run de Studio
y **no** al log de la plataforma. El log de la plataforma solo tiene la linea de comandos con
la que se lanzo el job:

```
!MESSAGE 2026-10-20 18:47:31,907 INFO  org.talend.designer.core.runprocess.Processor  - Command line: C:/Talend/.../bin/java.exe ... prj_bancolombia.mcp_fase0_zero_0_1.MCP_Fase0_Zero --context=Default --stat_port=3642 %*
```

### 14.1 Trampa: la linea de comandos no llega a `ProcessHandle` en Windows

`ProcessHandle.info().commandLine()` devuelve vacio para los procesos ajenos cuando se lee desde
la JVM de Studio. Medido en la maquina de desarrollo (Windows 11, Talend 8.0.1, JDK Zulu 21): de
5 procesos `cmd.exe`, ninguno tenia linea de comandos visible. El ejecutable (`command()`) y el
instante de arranque (`startInstant()`) si estan disponibles.

Consecuencia: la busqueda por linea de comandos de `processesOfJob` nunca encontraba nada en
Windows. Esa era la causa de que las ejecuciones quedaran en `started`: 1.619 de 1.619 registros,
sin ningun `terminatedAt`, y 0 JVM de jobs vivas al comprobarlo. `/launch/wait` devolvia
`timedOut` pase lo que pase con el job.

La linea de comandos si se lee con WMI: `Get-CimInstance Win32_Process -Filter "CommandLine
LIKE '%nombre%'"`. `processesOfJob` la usa como respaldo en Windows. El nombre del job se valida
(`[A-Za-z0-9_.-]+`) antes de meterlo en el comando, y el comando va en `-EncodedCommand`
(base64 UTF-16LE): con las comillas en la linea de argumentos, PowerShell salia con codigo 1.

Trampa al probar: `timeout /t` no sirve para simular un job desde un `ProcessBuilder`, porque
falla con "Input redirection is not supported" y el proceso termina al instante. Usa
`ping -n N 127.0.0.1 >nul`.

### 14.2 Que devuelve la espera

`/launch/wait` termina cuando el vigilante marca el fin, o devuelve enseguida si el launch no
tiene vigilante (`unobserved`), o al expirar el timeout con `timedOut: true` y el estado actual.
Por eso el cliente debe mirar `terminated`, no `ok`. `talend_job_wait_run` lo aplica:
`terminated: true` solo si Studio lo confirma; `WAIT_TIMEOUT` si el job sigue; `WAIT_UNOBSERVED`
si no hay vigilante. Antes devolvia `terminated: true` aunque el bridge hubiera respondido
`timedOut: true`.

Verificado: un proceso de prueba que termina sin que nadie llame a `wait` queda
`terminated_without_exit_code`, con `terminatedAt` a 3,1 s del arranque, y el `wait` posterior
vuelve en 0 s. La prueba no lanza ningun job de Talend.
