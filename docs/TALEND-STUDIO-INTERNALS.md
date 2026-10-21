# Internals de Talend Studio

Referencia de las APIs internas de Talend Studio 8.0.1 que usa el bridge. Todo lo que está
aquí se verificó leyendo el bytecode de los jars de Studio (no hay código fuente disponible)
o ejecutando el flujo y observando el resultado.

Sirve para dos cosas:

1. Explicar por qué el bridge hace las cosas como las hace, para que no se rompan a ciegas.
2. Servir de punto de partida cuando haya que explorar una API interna nueva.

## 1. Entorno y rutas

| Qué | Ruta |
|---|---|
| Talend Studio | `C:\Talend\8.0.1\studio` |
| Workspace | `C:\Talend\8.0.1\studio\workspace` |
| Log de errores de Eclipse | `C:\Talend\8.0.1\studio\workspace\.metadata\.log` |
| Jars de plugins | `C:\Talend\8.0.1\studio\plugins` |
| JDK que trae Studio (21) | `C:\Talend\8.0.1\zulu21.50.19-ca-jdk21.0.11-win_x64\bin` |
| Proyecto Talend real | `...\workspace\talendbancolombia-963626413\PRJ_BANCOLOMBIA` |
| Config del bridge | `%USERPROFILE%\.talend-bridge\config.json` |
| Token del bridge | `%USERPROFILE%\.talend-bridge\token` |
| Historial de launches | `%USERPROFILE%\.talend-bridge\launch-runs.txt` |

El label técnico del proyecto es `PRJ_BANCOLOMBIA`. El label visible (`getLabel()`) es
distinto del técnico (`getTechnicalLabel()`), y Talend usa uno u otro según el atributo de la
launch config.

## 2. Metodo de investigacion

No hay fuentes de Talend, solo jars. El metodo que funciono:

```bash
# 1. Localizar la clase dentro de los jars de plugins
Add-Type -AssemblyName System.IO.Compression.FileSystem
$z = [System.IO.Compression.ZipFile]::OpenRead("...\plugins\org.talend.designer.core_8.0.3.jar")
$z.Entries | Where-Object { $_.FullName -eq "org/talend/designer/core/debug/JobLaunchShortcut.class" }

# 2. Desensamblar con el JDK de Studio
& "C:\Talend\8.0.1\zulu21.50.19-ca-jdk21.0.11-win_x64\bin\javap.exe" \
    -p -c -constants -cp "...\plugins\org.talend.designer.core_8.0.3.jar" \
    org.talend.designer.core.debug.JobLaunchShortcut
```

Notas praticas:

- `-c` imprime el bytecode, que es donde se ven los nombres de clase, metodo y string usados.
- Las clases internas se referencian con `$`: `DesignerUtilities$1`, `JobLaunchConfigurationDelegate$1$1`.
- Pasar el jar completo en `-cp` evita tener que extraer la clase a disco.
- Para saber como se conecta una extension, el `plugin.xml` dentro del jar es la fuente de verdad:

```bash
$z.Entries | Where-Object { $_.FullName -eq "plugin.xml" }
```

- Los logs de Eclipse dan el stack trace real, que a veces aclara mas que el bytecode.

## 3. Tipos Java de columna

Talend solo reconoce un conjunto cerrado de identificadores de tipo Java para las columnas de
schema. Usar uno que no existe rompe la generacion de codigo con:

```
java.lang.IllegalArgumentException: Unknown java id type : 'id_Decimal'
    at org.talend.core.model.metadata.types.JavaTypesManager.getJavaTypeFromId(JavaTypesManager.java:273)
    at org.talend.designer.codegen.translators.common.Subprocess_headerJava.generate(Subprocess_headerJava.java:526)
```

`JavaTypesManager.getJavaTypeFromId` busca en un mapa `idToJavaType` y lanza
`IllegalArgumentException` si no encuentra el id. La clase declara estos tipos:

`BOOLEAN`, `BYTE`, `BYTE_ARRAY`, `CHARACTER`, `DATE`, `DOUBLE`, `FLOAT`, `INTEGER`, `LONG`,
`SHORT`, `STRING`, `DYNAMIC`, `LIST`, `BIGDECIMAL`, `PASSWORD`, mas `FILE`, `RESOURCE`,
`DIRECTORY`, `VALUE_LIST` y `OBJECT`.

Los identificadores que se pueden escribir en un `.item` (`type="id_*"`) son:

| Identificador | Uso tipico |
|---|---|
| `id_String` | texto |
| `id_Integer` | entero de 32 bits |
| `id_Long` | entero de 64 bits |
| `id_Double` | decimal de 64 bits |
| `id_Float` | decimal de 32 bits |
| `id_BigDecimal` | decimal de precision arbitraria |
| `id_Boolean` | booleano |
| `id_Byte` | byte |
| `id_Short` | corto |
| `id_Character` | caracter |
| `id_Date` | fecha |
| `id_Password` | texto enmascarado |
| `id_Dynamic` | tipo dinamico |

`id_Decimal` **no existe**. El decimal de Talend es `id_BigDecimal`.

Como descubrir la lista sin fuente: contar los `type="id_*"` que ya usan los jobs reales del
proyecto. En `PRJ_BANCOLOMBIA` la distribucion era `id_String` 813, `id_Integer` 203, `id_Long`
93, `id_Date` 88, `id_BigDecimal` 48, `id_Boolean` 15, `id_Password` 14, `id_Dynamic` 3, y un
`id_Decimal` invalido. Esa muestra es la fuente de verdad de que `id_Decimal` es un error y no
una variante aceptada.

El MCP normaliza el tipo en `src/talend/job-generator.ts` con `normalizeColumnType()`, que mapea
alias en ingles (`decimal`, `numeric`, `bigint`, `timestamp`...) al identificador correcto y
cae a `id_String` cuando no reconoce el valor.

## 4. Anatomia de un `.item` de job

```xml
<talendfile:ProcessType xmi:id="_ElxdZ28OsJ5nPSlm67XcgY" defaultContext="Default" jobType="Standard">
  <context confirmationNeeded="false" hide="false" name="Default">
    <contextParameter xmi:id="..." name="DEFAULT" type="id_String" value=""></contextParameter>
  </context>
  <node xmi:id="..." componentName="tFileInputDelimited" componentVersion="0.102" posX="200" posY="100">
    <elementParameter field="TEXT" name="UNIQUE_NAME" value="tFileInputDelimited_1"></elementParameter>
    <elementParameter field="TEXT" name="FILENAME" value="C:/.../clientes.csv"></elementParameter>
    <metadata connector="FLOW" label="id" name="id" xmi:id="...">
      <column name="id" type="id_Integer"></column>
      <column name="monto" type="id_BigDecimal"></column>
    </metadata>
  </node>
  <node xmi:id="..." componentName="tLogRow" componentVersion="0.101" posX="520" posY="100">
    ...
  </node>
  <connection xmi:id="..." source="tFileInputDelimited_1" target="tLogRow_1" connectorName="FLOW">
    ...
  </connection>
</talendfile:ProcessType>
```

Puntos que importan:

- El schema de cada componente vive en `<metadata>` y sus `<column type="id_*">`.
- El `componentVersion` importa: si no coincide con la version del catalogo, Studio puede no
  resolver los parametros del componente.
- Los paths dentro del `.item` son absolutos y con `/`, no con `\`.

## 5. Layout del proyecto Talend

| Carpeta | Contenido |
|---|---|
| `process/` | jobs (`.item`) y joblets |
| `context/` | contextos (`.item` mas `.properties`) |
| `metadata/` | conexiones, schemas, reglas de DQ |
| `code/` | `routines/`, `beans/`, `snippets/`, `routinesjar/`, `beansjar/` |
| `poms/jobs/process/<job>/` | proyecto Maven generado para cada job |
| `poms/jobs/process/<job>/src/main/java/` | el `.java` generado del job |
| `temp/` | staging de builds, `lib/` con las dependencias |
| `docs/`, `documentations/` | documentacion |
| `tests/` | tests de contexto |

El codigo Java generado queda en
`poms/jobs/process/mcp_fase0_raiz_0.1/src/main/java/prj_bancolombia/mcp_fase0_raiz_0_1/MCP_Fase0_Raiz.java`.
Si ese archivo esta vacio (0 bytes), la generacion fallo antes de escribirlo: esa es una senal
rapida para detectar un fallo de generacion sin mirar el log.

## 6. Como ejecuta un job Talend Studio

Este es el flujo real, deducido del bytecode. Es la parte que mas surprising y que mas bugs
causo.

### 6.1 Tipo de launch config

Definido en el `plugin.xml` de `org.talend.designer.core`:

```xml
<launchConfigurationType
      name="Perl Local"
      delegate="org.talend.designer.core.debug.JobLaunchConfigurationDelegate"
      modes="run"
      public="true"
      id="org.talend.designer.runprocess.jobLaunchConfiguration">
```

El shortcut que Studio registra es
`org.talend.designer.core.debug.JobLaunchShortcut` (id
`org.talend.designer.runprocess.debug.JobLaunchShortcut`).

### 6.2 Atributos de la launch config

`JobLaunchShortcut.createConfiguration(ProcessItem)` es la referencia canonica de como se crea
una launch config de Talend:

| Atributo | Valor | Nota |
|---|---|---|
| `TALEND_JOB_NAME` | `property.getLabel()` | label del job, no el nombre tecnico |
| `TALEND_JOB_ID` | `property.getId()` | id interno, no el label |
| `TALEND_JOB_VERSION` | `property.getVersion()` | por ejemplo `0.1` |
| `JOB_PROJECT_TECH_LABEL` | `project.getTechnicalLabel()` | por ejemplo `PRJ_BANCOLOMBIA` |
| `CURRENT_PROJECT_NAME` | `project.getLabel()` | visible, no tecnico |

`CURRENT_PROJECT_NAME` no lo usa el delegate, pero `JobLaunchShortcut.findLaunchConfiguration` lo
compara contra `ProjectManager.getCurrentProject().getLabel()` para decidir si reutiliza una
config existente. Ademas el shortcut valida con `ProcessUtils.isInProject(techLabel, property)`.

### 6.3 La config no se persiste en disco

El shortcut crea la config asi:

```java
ILaunchConfigurationWorkingCopy config = type.newInstance(null, uniqueName);
```

El contenedor es `null`, no la raiz del workspace. Con contenedor `null` Eclipse mantiene la
config solo en memoria del launch manager y **no escribe ningun archivo `.launch`**. Por eso no
existe ningun `.launch` en `C:\Talend`: es el comportamiento correcto, no un bug.

El nombre unico se genera con
`manager.generateUniqueLaunchConfigurationNameFrom(label + " " + version)`.

### 6.4 El delegate

`JobLaunchConfigurationDelegate.launch(config, mode, launch, monitor)`:

1. Lee `TALEND_JOB_ID`, `TALEND_JOB_NAME`, `TALEND_JOB_VERSION`, `JOB_PROJECT_TECH_LABEL`.
2. `DesignerUtilities.findProcessFromEditors(projectLabel, jobId, jobVersion)`: recorre los
   editores abiertos de la pagina activa, y para cada `JobEditorInput` compara
   `process.getId()`, `process.getVersion()` y el technical label del proyecto. Devuelve el
   primer match.
3. Si no lo encuentra, `findProcessFromRepository(projectLabel, jobId, jobVersion)`: hace
   `ItemCacheManager.clearCache()` y luego
   `ItemCacheManager.getProcessItem(projectLabel, jobId, jobVersion)`, y de ahi saca el proceso
   con `IDesignerCoreService.getProcessFromItem(item)` o con
   `new ProcessEditorInput(processItem, true, true, true).getLoadedProcess()`.
4. Si tampoco lo encuentra, escribe en el log
   `Job <nombre> can not be found. Maybe it is removed.` y termina. Este mensaje es de nivel
   INFO, no de error, asi que es facil pasarlo por alto.
5. Si lo encuentra, agenda un `Job` de Eclipse (`JobLaunchConfigurationDelegate$1`) con regla
   `modifyRule` sobre el `IProject` del proyecto.

El `Job` agenda hace `Display.asyncExec(...)` con un `Runnable`
(`JobLaunchConfigurationDelegate$1$1`) que ejecuta, en este orden:

```java
runProcessService.setActiveProcess(p);   // fija el proceso activo
runProcessService.refreshView();         // ProcessView.refresh()
runProcessService.getRunProcessAction().run();
```

`RunProcessAction.run()` termina en
`ProcessView$RunAction.run()`, que hace
`processComposite.getProcess().exec()`.

### 6.5 La regla de oro

**El delegate no ejecuta el proceso que uno le pasa: ejecuta el proceso que esta enlazado al
`ProcessComposite` de la pestana Run.** El `process` que el delegate resolvio solo se usa para
`setActiveProcess()` y para `refreshView()`, que es lo que hace que la pestana Run se rebinde.

Esto explica un fallo que costó horas: si el proceso que se quiere ejecutar no es el que quedo
en el composite de la pestana Run, se ejecuta otro. En una sesion de pruebas, el job que se
lanzo seguia fallando con el schema de otro job porque la pestana Run apuntaba al job viejo.

`ProcessView.refresh(boolean)` actualiza el `RunProcessContext` estatico, pasa el contexto al
`ProcessManager` y recalcula la categoria del composite. `ProcessView.createDynamicComposite(...)`
es el que crea el `ProcessComposite` nuevo cuando la categoria es `BASICRUN`.

### 6.6 Preflaunch de Eclipse

`JobLaunchShortcut` no llama `config.launch(...)` directamente. Usa
`DebugUITools.launch(config, mode)` y antes desactiva dos preferencias:

| Preferencia | Valor | Motivo |
|---|---|---|
| `org.eclipse.debug.ui.build_before_launch` | `false` | no reconstruir el proyecto antes de correr |
| `org.eclipse.debug.ui.save_dirty_editors_before_launch` | `never` | no guardar editores sucios |

El bridge hace `config.launch("run", new NullProgressMonitor(), true)`. La diferencia con
`DebugUITools.launch(config, mode)` es que esta ultima no dispara el dialogo de build ni el de
guardar editores sucios, que es justo lo que el shortcut desactiva con las preferencias de la
tabla anterior.

## 7. El problema del modelo en memoria

Este es el hallazgo mas importante para el MCP, y no aparece en ninguna documentacion de
Talend porque el MCP escribe los `.item` por fuera del IDE.

**Studio no relee el archivo `.item` cuando cambia en disco.** El modelo EMF vive en el
repositorio de Talend (`ProxyRepositoryFactory` y su `XmiResourceManager`), y los recursos EMF
tienen cache propia. Limpiar `ItemCacheManager` no alcanza.

Escenario reproducido:

1. El MCP escribe `MCP_Fase0_Raiz_0.1.item` con `monto` de tipo `id_String` (correcto).
2. Se cierra el editor, se refresca el workspace y se reabre el editor.
3. Se lanza el job.
4. Talend falla con `Unknown java id type : 'id_Decimal'`, que es el tipo **anterior** del
   archivo.

El paso 3 usa el proceso que Studio tiene en memoria, no el del disco. Por eso el error seguia
apareciendo aunque el `.item` en disco ya estuviera bien.

### APIs de recarga

En `org.talend.core.repository.utils.XmiResourceManager` (bundle `org.talend.core.repository`) hay:

```java
Property loadProperty(IResource resource);
Property forceReloadProperty(Property property);
```

`loadProperty` es la que sirve: descarga el recurso EMF del item del `ResourceSet` y lo vuelve a
leer del disco. `forceReloadProperty` hace lo mismo pero partiendo de un `Property` que ya se
tiene en la mano.

Para llegar al `XmiResourceManager` hay que pasar por
`ProxyRepositoryFactory.getInstance().getXmiResourceManager()`. El metodo devuelve `Object`, asi
que el acceso es por reflexion.

El orden correcto es:

1. Cerrar el editor del job (si estaba abierto).
2. Recargar el item: `loadProperty(archivo)`.
3. Limpiar `ItemCacheManager`.
4. Abrir el editor. Ahora ya carga el schema nuevo.
5. Lanzar.

El bridge hace los pasos 2 y 3 dentro de `openResource`, antes de abrir el editor. Es el punto
correcto: si se recarga despues, el editor ya tiene el proceso viejo en memoria y el delegate lo
usa ese.

### El componente `tLogRow` necesita el parametro `LENGTHS`

Con el schema ya corregido, el job falla en la generacion de codigo con:

```
java.lang.NumberFormatException: For input string: "Main1100Main1"
    at org.talend.designer.codegen.translators.logs_errors.TLogRowBeginJava.generate(TLogRowBeginJava.java:440)
```

La causa es que `tLogRow` necesita un parametro `LENGTHS`: una tabla con un par
`SCHEMA_COLUMN`/`LENGTH` por cada columna del schema.

```xml
<elementParameter field="TABLE" name="LENGTHS" show="false">
  <elementValue elementRef="SCHEMA_COLUMN" value="id" id="0"></elementValue>
  <elementValue elementRef="LENGTH" value="10" id="1"></elementValue>
  <elementValue elementRef="SCHEMA_COLUMN" value="nombre" id="2"></elementValue>
  <elementValue elementRef="LENGTH" value="10" id="3"></elementValue>
</elementParameter>
```

Todos los `tLogRow` de los jobs reales del proyecto lo tienen. Sin el, el generador hace
`Integer.parseInt` sobre un valor vacio y revienta con `NumberFormatException`.

Ademas, un `tLogRow` al final de un flujo no declara schema propio, pero lo necesita para armar
`LENGTHS`. El MCP lo resuelve heredando el schema del componente que le manda el flujo.

## 8. Referencia de clases

| Clase | Bundle | Para que sirve |
|---|---|---|
| `org.talend.designer.core.debug.JobLaunchConfigurationDelegate` | `org.talend.designer.core` | delegate de la launch config de job |
| `org.talend.designer.core.debug.JobLaunchShortcut` | `org.talend.designer.core` | como crear y reutilizar la config |
| `org.talend.designer.core.utils.DesignerUtilities` | `org.talend.designer.core` | `findProcessFromEditors` |
| `org.talend.designer.runprocess.ui.actions.RunProcessAction` | `org.talend.designer.runprocess` | accion de ejecutar de la pestana Run |
| `org.talend.designer.runprocess.ui.views.ProcessView` | `org.talend.designer.runprocess` | vista Run, `refresh()`, `processComposite` |
| `org.talend.designer.runprocess.ui.ProcessComposite` | `org.talend.designer.runprocess` | composite que ejecuta y muestra la consola |
| `org.talend.designer.runprocess.DefaultRunProcessService` | `org.talend.designer.runprocess` | `setActiveProcess()`, `refreshView()` |
| `org.talend.designer.runprocess.ItemCacheManager` | `org.talend.core.runtime` | cache de `ProcessItem` por id |
| `org.talend.core.model.metadata.types.JavaTypesManager` | `org.talend.core.runtime` | tipos Java validos de columna |
| `org.talend.designer.core.ui.editor.ProcessEditorInput` | `org.talend.designer.core` | input de editor de job, `getLoadedProcess()` |
| `org.talend.core.ui.editor.JobEditorInput` | `org.talend.core.runtime` | clase base del input de editor |
| `org.talend.repository.ProjectManager` | `org.talend.core.runtime` | proyecto actual, technical label |
| `org.talend.core.repository.model.ProxyRepositoryFactory` | `org.talend.core.repository` | acceso al repositorio EMF, `getXmiResourceManager()` |
| `org.talend.core.repository.utils.XmiResourceManager` | `org.talend.core.repository` | `loadProperty(IResource)`, `forceReloadProperty(Property)` |
| `org.talend.core.runtime.CoreRuntimePlugin` | `org.talend.core.runtime` | `getProxyRepositoryFactory()` |

## 9. Log de errores de Eclipse

Formato del `.metadata/.log`:

```
!ENTRY org.talend.platform.logging 4 0 2026-10-20 14:16:40.279
!MESSAGE 2026-10-20 14:16:40,278 ERROR org.talend.commons.exception.CommonExceptionHandler  - Failed to generate code.

!STACK 0
org.talend.designer.runprocess.ProcessorException: Failed to generate code.
	at ...
```

- El `4` del `!ENTRY` es el nivel (2 warning, 4 error). El `1` es info.
- El bundle aparece en el `!ENTRY`; el logger real, en el `!MESSAGE`.
- Los `!STACK 0` van aparte, con su propia numeracion.

Para saber si un error es de una ejecucion concreta, comparar el timestamp del `!MESSAGE` con
el timestamp del launch. El bridge genera ids de launch con `System.currentTimeMillis()` al
inicio (`launch_<epoch_ms>_<nombre>`), lo que permite correlacionar de forma exacta.

Ojo con esto: durante las pruebas se filtraron los errores por un rango de horas y se perdio
un error que si era del run en curso. El error que se buscaba estaba a 259 ms del launch, no
en la hora que se filtraba.

## 10. Recetas de diagnostico

**Ver el tipo real de un job en disco:**

```powershell
Select-String -Path "<job>.item" -Pattern 'type="id_' | ForEach-Object { $_.Line.Trim() }
```

**Ver el codigo generado de un job:**

```powershell
Get-ChildItem "<proyecto>\poms\jobs\process" -Recurse -Filter "*.java" |
  Sort-Object LastWriteTime -Descending | Select-Object -First 5 LastWriteTime, FullName
```

Un `.java` de 0 bytes significa que la generacion fallo.

**Ver si hay un proceso java de Talend corriendo:**

```powershell
Get-Process java -ErrorAction SilentlyContinue | Select-Object Id, CPU
```

**Comparar timestamps de launch contra entradas del log:**

```powershell
[DateTimeOffset]::FromUnixTimeMilliseconds(1792523800019).ToLocalTime()
Select-String -Path "<workspace>\.metadata\.log" -Pattern "^!ENTRY" |
  ForEach-Object { ($_.Line -split " ")[5] } | Select-Object -Unique
```

**Buscar un tipo invalido en todo el workspace:**

```powershell
Get-ChildItem <workspace> -Recurse -File | ForEach-Object {
  $m = Select-String -Path $_.FullName -Pattern "id_Decimal" -SimpleMatch -List -ErrorAction SilentlyContinue
  if ($m) { $_.FullName }
}
```

Este ultimo es el que destapo el problema: el `.item` del job en ejecucion ya estaba bien,
pero existia un `id_Decimal` en el `.item` de un job viejo, y el composite de la pestana Run
seguia apuntando a ese.

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

`ModalGuard` (en el plugin) los cierra solo:

- Un hilo vigilante revisa cada 1,2 s los shells del `Display` que no sean la ventana del
  workbench.
- Para los dialogos conocidos (`Jobname Error`, `Invalid Job Name`, `Save Resource`) pulsa
  el boton que corresponde.
- Para los que no conoce, pulsa el primer boton de una lista de botones seguros
  (`Yes`, `OK`, `Accept`, `Save`...). Un modal bloqueando el IDE es peor que pulsar un boton.
- Los shells de SWT **solo se tocan desde el hilo de la UI**: el vigilante usa
  `UiThread.sync(...)`. Si se llama `Display.getShells()` desde otro hilo, SWT lanza
  `Invalid thread access`.

Para pulsar un boton hay que lanzar el evento de seleccion, no llamar a `click()`: los
dialogos de JFace escuchan la seleccion, no el raton. Y el texto del boton lleva el mnemonic
("&Yes"), asi que hay que comparar sin el.

Verificado: un `MessageDialog` de JFace con el titulo "Jobname Error" se cierra solo en 0,3 s
y devuelve la respuesta "Si".

La tool `talend_studio_dismiss_dialogs` fuerza el cierre bajo demanda.

## 14. El fin de la ejecucion de un job

Talend ejecuta cada job en una JVM aparte. `LaunchTrackerService` registra el arranque, pero
nadie lo cerraba: las ejecuciones se quedaban siempre en `started`.

- **El evento de fin de Eclipse no sirve.** `DebugPlugin.addDebugEventListener` no recibe
  nada para estos lanzamientos: Talend lanza el proceso con `Processor.run()`, que devuelve un
  `java.lang.Process` y no pasa por el `ILaunch` de Eclipse.
- **La senal que si funciona es el proceso del sistema operativo.** Se buscan los procesos
  cuya linea de comandos contenga el nombre del job (la clase java del job es
  `prj_bancolombia.mcp_fase0_zero_0_1.MCP_Fase0_Zero`) y se espera a que muera con
  `ProcessHandle.onExit()`.
- **Limite:** un job que termina en menos de 50 ms se escapa del sondeo. Para esos, la salida
  hay que sacarla de otro sitio (ejecutando el jar generado a mano).

La salida del job (las filas que imprime `tLogRow`) va a la consola de la vista Run de Studio
y **no** al log de la plataforma. El log de la plataforma solo tiene la linea de comandos con
la que se lanzo el job:

```
!MESSAGE 2026-10-20 18:47:31,907 INFO  org.talend.designer.core.runprocess.Processor  - Command line: C:/Talend/.../bin/java.exe ... prj_bancolombia.mcp_fase0_zero_0_1.MCP_Fase0_Zero --context=Default --stat_port=3642 %*
```

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

- **La salida de la consola del run no esta expuesta por el bridge.** El job imprime las filas
  en la vista Run de Studio y no en el log de la plataforma. Para comprobar la salida de
  forma automatica hay dos vias: leer el `StyledText` del `ProcessComposite` (API restringida
  de Talend) o ejecutar el jar generado a mano con el comando que Talend deja en el log.
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

## 19. Estructura del codigo del bridge

El paquete `automation` del plugin quedo dividido por responsabilidades, para
que tocar una cosa no obliga a tocar todo lo demas:

| Clase | Que hace |
|---|---|
| `JobOperationsService` | Fachada: coordina y envuelve en el sobre de respuesta. |
| `JobRepository` | Crear, borrar y abrir jobs del repositorio de Talend. |
| `NodeOperations` | Alta, edicion, conexion y borrado de componentes. |
| `SchemaOperations` | Schema del nodo y tablas de datos de los componentes. |
| `ComponentConfigurator` | Configuracion declarativa (parameters, tables, schema). |
| `MapperConfigurer` | El modelo del tMap (adaptador del componente). |
| `JobPersistence` | Guardar el modelo en el `.item`. |
| `ComponentCatalog` | Parametros de los componentes del catalogo. |
| `TalendApi` | Acceso al IDE por reflexion (editor, proceso, nodo, componente). |
| `TalendClasses` | Carga de clases de Talend desde los bundles de OSGi. |
| `JsonSpec` | Lectura del spec JSON de las operaciones. |
| `ColumnTypes` | Tipos Java de columna y sus alias. |

## 20. Instalar el plugin: caliente o con p2

- **Con Studio corriendo**: `bun run scripts/start.ts --install-bridge`
  publica el jar en `~/.talend-bridge/hot/bridge.jar` y el plugin lo recarga
  solo.
- **Con Studio parado**: el mismo comando lo instala con p2.

**No hay que copiar el jar a mano** en `studio/plugins/`: el nombre del
archivo tiene que coincidir con la version del MANIFEST, y si no, Eclipse
carga el bundle sin resolver sus dependencias y todo falla con
`ClassNotFoundException: org.eclipse.draw2d.geometry.Point cannot be found`.