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
## 23. Ejecutar un job y leer su salida

Talend ejecuta cada job en una JVM aparte y muestra el resultado en la vista Run,
que no se puede leer desde el bridge. Pero el codigo generado queda en el
workspace, en:

```
poms/jobs/process/<job>/<job>_<version>/
  target/classpath.jar      <- con el Class-Path completo en su MANIFEST
  target/classes/...        <- las clases compiladas
```

El `classpath.jar` lleva en su MANIFEST el `Class-Path` con las routines, las
librerias y las clases del job, asi que basta ponerlo en el classpath para
tener el entorno completo. Y la clase principal se deduce de las clases
compiladas: el fichero `<JobName>.class` dentro de `target/classes` dice el
paquete.

No siempre esta en `poms`: hay jobs cuyo proyecto Maven queda montado pero
vacio, y entonces el codigo generado aparece en un proyecto suelto del
workspace, `PRJ_<PROYECTO>_<JOB>_<VERSION>` (el job en mayusculas), con el mismo
layout (`src/main/java/...`, `target/classes`, `target/classpath.jar`). El
buscador del bridge mira primero `poms/jobs/process` y, si ahi no hay
`target/classpath.jar`, cae a esa carpeta. Ver la seccion 53.

Con eso el bridge relanza el job y devuelve su salida, que es lo que hace
falta para comprobar que el resultado es el esperado (el plan de pruebas lo
pide explicitamente: "la salida coincide con lo esperado, que defines tu
antes de ejecutar").

```java
java -Xms256M -Xmx1024M -Dfile.encoding=UTF-8 -Dstdout.encoding=UTF-8 \
  -cp <job>/target/classpath.jar \
  prj_bancolombia.mi_job_0_1.MI_JOB --context=Default
```

El `java` es el del propio runtime de Studio (`java.home`).

La tool es `talend_job_execute`, y devuelve el codigo de salida, la salida
estandar y la salida de error, con las lineas de la salida ya separadas.

**Ojo**: el proceso se relanza, no se intercepta. El job ya se ha ejecutado
una vez con `talend_job_run_by_name` (que compila y lanza); `talend_job_execute` lo
ejecuta otra vez para poder leer su salida.
## 24. Componentes que no generan codigo valido en Talend 8.0.1

El `tFileInputPositional` y el `tFileInputJSON` generan un job que **no
compila** cuando el job tiene un output con trigger de error:

```
The method tFileInputPositional_2_onSubJobError(Exception, String, Map<String,Object>)
is undefined for the type MI_JOB
```

**Por que**: el output genera el handler `tLogRow_2_error`, que llama al
metodo `onSubJobError` del componente que falla. Ese metodo solo se genera
para los componentes que tienen trigger de error, y un input no lo tiene.

Lo que decide es el `DIE_ON_ERROR` **del componente del catalogo**, que en
estos dos componentes viene en `true` (en el `tFileInputDelimited` viene en
`false`, y ese compila). El MCP pone el parametro del nodo a `false` (y el
`.item` lo refleja), pero el generador consulta el componente, no el nodo, y
el componente del catalogo es compartido: no se puede cambiar sin afectar a
todos los jobs.

**Como se salva**: usando el `tFileInputDelimited` en lugar de estos dos, o
esperando a que Talend lo corrija. No es un problema del MCP: el `.item` que
genera es correcto.

## 25. Descargar artefactos de Maven

Hay componentes cuyo runtime no viene con Studio. El `tFileInputJSON`, por
ejemplo, necesita `com.jayway.jsonpath:json-path:2.9.0`, y sin el el build
falla con:

```
El contenedor Maven Dependencies referencia biblioteca ...json-path-2.9.0.jar inexistente
Offline / Missing artifact com.jayway.jsonpath:json-path:jar:2.9.0
```

Studio usa como repositorio local el de su propia instalacion
(`<instalacion>/configuration/.m2/repository`), asi que descargar ahi es lo que
hace que el build lo encuentre. La tool `talend_studio_install_artifact` lo
hace desde Maven Central.

**Ojo**: el `tMap` necesita el modulo `talend-tmap-dataset-1.2.16.jar`, que
**no esta en Maven Central** (es de Talend Exchange y pide credenciales). Con el
instalador se comprueba enseguida: devuelve 404 para todos los group id
habituales (`org.talend.components`, `org.talend.libraries`, ...).
## 26. Que no puede entrar al hilo de la UI

Todo lo que corre en `UiThread.sync` ocupa el hilo de la interfaz de Studio: mientras dura, Studio
no pinta, no responde y los modales no se pueden cerrar (el sistema lo marca "No responde"). Por
eso la regla es: **al hilo de la UI solo entra lo que toca widgets o el modelo del job, y en
trozos de milisegundos.**

| Operacion | Donde corre | Por que |
|---|---|---|
| Alta, conexion, edicion, borrado de nodos; crear, abrir y borrar jobs | UI (trozo corto) | Tocan el editor y el modelo EMF |
| `talend_job_execute` (lanza una JVM y espera hasta minutos) | Hilo de trabajo HTTP | Solo lee el workspace; en la UI congelaba Studio todo lo que durara el job |
| `talend_studio_install_artifact` (descarga de Maven Central) | Hilo de trabajo HTTP | Es red y disco, sin widgets |
| `talend_studio_coverage` (1294 componentes) | Hilo de trabajo; **una llamada corta a la UI por componente** | Si el bucle entero iba en la UI, Studio quedaba congelado minutos |

Detalles de `UiThread.sync`:

- Espera con un `CountDownLatch`: despierta en el instante en que la UI termina (antes sondeaba
  cada 20 ms y eso se sumaba a cada llamada).
- Tiene tiempo maximo (10 s por defecto). Si vence, la accion que seguia en cola **se descarta**
  en vez de ejecutarse tarde.
- Si ya se esta en el hilo de la UI (`Display.getCurrent() != null`), ejecuta directo.

Al agregar una ruta nueva al bridge: si no toca widgets ni el modelo, no la envuelvas en
`UiThread.sync`. Si necesita la UI varias veces, haz una llamada corta por unidad de trabajo,
no una larga para todo.

## 27. Problemas de diseno de un job

Los avisos que Studio marca en el lienzo y lista en la vista Problemas (`No schema has been defined yet`,
`This component should have input link(s)`) viven en la clase estatica
`org.talend.designer.core.ui.views.problems.Problems`. La lista es **global** (todos los jobs abiertos) y
Studio solo la recalcula al editar, asi que para leerla desde el bridge:

1. `Problems.refreshProcessAllNodesStatus(process)` fuerza el recalculo del job.
2. `Problems.getProblemsBySeverity(ProblemStatus)` (`ERROR`, `WARNING`, `INFO`) devuelve los problemas.
3. Se filtran por `problem.getJobInfo().getJobName()`, porque la lista mezcla los jobs abiertos.
4. De cada `Problem`: `getDescription()`, `getNodeName()`, `getComponentName()`, `getType()`.

`JobProblems.java` lo hace y la tool es `talend_job_problems`. Verificado: un `tFileInputDelimited` sin
conectar da 3 avisos (sin schema, sin salida, y el `tLogRow` sin entrada) y con schema, `FILENAME` y la
conexion queda limpio. Son problemas de **diseno**; los de compilacion Java del codigo generado son
otra cosa (ver `/problems/markers` y la seccion 14).

Dato util al probar con `talend_studio_run_code`: `PlatformUI.getWorkbench().getActiveWorkbenchWindow()`
es `null` cuando Studio no tiene el foco; usa `getWorkbenchWindows()[0]`.

## 28. Compilar un job sin ejecutarlo

Studio genera el codigo antes de un Run con `ProcessorUtilities.generateCode` y luego comprueba los errores
de compilacion. Las dos cosas se pueden hacer sin lanzar el job (`JobCompiler.java`, tool `talend_job_compile`):

1. `ProcessorUtilities.generateCode(IProcess, IContext, statistics=false, trace=false, properties=true)`, con el
   contexto por defecto (`process.getContextManager().getDefaultContext()`). Tarda ~2 s en un job pequeno.
2. `JobErrorsChecker.checkLastGenerationHasCompilationError(true)`. **Esta clase esta en otro bundle**
   (`org.talend.designer.runprocess`): se carga con `Platform.getBundle(...).loadClass(...)`, no con el
   classloader de `org.talend.core`.
3. Si hay errores lanza `ProcessorException` con `Error Line: N` y `Detail Message: ...`; `generateCode` ya puede
   lanzarla por si mismo (el check interno es el de `generateBuildInfo`).

**Tiene que ir en el hilo de la UI.** `generateBuildInfo` llama a `JavaProcessor.syntaxCheck` ->
`TalendJavaEditor.validateSyntax`, que toca widgets; desde otro hilo da `SWTException: Invalid thread access`.
Studio lo hace igual, dentro de un `ProgressMonitorDialog` en el hilo de UI. Es la excepcion consciente a la regla
de la seccion 26: dura segundos, se pide explicitamente y la ruta usa un tiempo de espera de 180 s.

Verificado: un `tFileInputDelimited` con `FILENAME` sin comillas da `Syntax error on token ":"` (linea 874) y con
`literal: true` compila. Un `tFixedFlowInput` -> `tLogRow` compila sin errores.

**Lectura de los fallos:** un componente de salida a archivo sin `FILENAME` da `The constructor File() is
undefined`: es un parametro obligatorio sin rellenar, no un fallo del MCP. Lo mismo `FileWriter()` en
`tFileOutputJSON`. Al medir L4 hay que darle a cada componente sus parametros obligatorios.

## 29. El catalogo tiene una variante de cada componente por tipo de job

El catalogo de Studio (`IComponentsFactory.getComponents()`) devuelve **1294 entradas**, pero no son 1294
componentes distintos: el mismo nombre aparece una vez por tipo de job, y `IComponent.getPaletteType()` dice cual.

| `getPaletteType()` | Entradas | Para que job |
|---|---|---|
| `DI` | 897 | Standard (Data Integration) |
| `SPARK` | 166 | Spark Batch |
| `SPARKSTREAMING` | 171 | Spark Streaming |
| `STRUCTUREDSTREAMING` | 60 | Structured Streaming |

Las variantes **no son intercambiables**: tienen parametros distintos. Con `tFileOutputDelimited`, la variante
Standard declara `FILENAME` (`REQUIRED="true"`, tipo `FILE`) y la de Spark declara `FOLDER`
(`DIRECTORY_HADOOP`). Buscar "el primero que case" por nombre devolvia a veces la de Spark, y el job Standard
quedaba con parametros que no son suyos. Por eso:

- `TalendApi.findCatalogComponent(nombre)` busca la variante `DI` (con respaldo a la primera que case).
- `ComponentCatalog.list` devuelve por defecto solo `DI` y sin duplicados; `paletteType: "*"` devuelve todas y
  `byPaletteType` da el recuento.
- Los componentes de Spark/Streaming solo tienen sentido en un job de ese tipo, que el MCP aun no crea.

### Donde estan las definiciones

Cada componente tiene su definicion en disco: `plugins/org.talend.designer.components.localprovider_*/components/<nombre>/`
(Standard; tambien `sparkprovider` y `sparkstrprovider`), con `<nombre>_java.xml` (parametros, `REQUIRED`,
`DEFAULT`, `SHOW_IF`) y las plantillas `*.javajet` que generan el codigo. Son la fuente mas fiable para saber que
parametros exige un componente y como se usan, y se pueden leer sin abrir Studio.

### Leer los parametros de un componente suelto

`new Node(component)` necesita un proceso: su `init` le pide un nombre unico y da NPE si no lo hay. Se usa el
constructor `Node(IComponent, IProcess2)` con el proceso del job activo o, si no hay ninguno, el del job de
trabajo `MCP_Scratch` (se crea la primera vez). El nodo no se anade al job. Los parametros de cada elemento dicen
`required` (`isRequired()`), `show` (`isShow(lista)`) y `readOnly`: `isRequired` es muy generoso (tambien marca
casillas), asi que para rellenar se usa obligatorio **y** visible **y** editable **y** de tipo texto, archivo o
carpeta **y** con valor vacio.

## 30. La definicion de cada componente esta en el XML de la instalacion

Cada componente deja su definicion en el disco de la instalacion de Studio:

```
<studio>/plugins/org.talend.designer.components.<proveedor>_<version>/components/<nombre>/<nombre>_java.xml
```

Los proveedores son `localprovider` (Standard), `bigdata`, `tisprovider`, `tdqprovider`, `ipaas`,
`publish.cloud`, `sparkprovider`, `sparkstrprovider` y `structuredstreamprovider`. Cada uno trae su copia de
`<nombre>_java.xml` y las plantillas `*.javajet` que generan el codigo. **El XML es la fuente autoritativa de lo
que un componente exige**, y se puede leer sin abrir Studio.

### Que se lee de cada XML

| Que | Donde | Para que |
|---|---|---|
| Parametros | `<PARAMETERS>` y `<ADVANCED_PARAMETERS>` | Que hay que rellenar |
| Obligatorio | `REQUIRED="true"` | Sin esto el codigo no compila |
| Valor por defecto | `<DEFAULT>...</DEFAULT>` (elemento hijo, no atributo) | El valor con el que se rellena |
| Visibilidad | `SHOW`, `SHOW_IF`, `NOT_SHOW_IF` | Que parametros se ven de verdad |
| Valores de una lista | `<ITEMS><ITEM NAME= VALUE=/></ITEMS>` | Los valores posibles |
| Conexiones | `<CONNECTORS><CONNECTOR NAME= CTYPE= MAX_INPUT= MAX_OUTPUT=/></CONNECTORS>` | Que conexiones admite |
| Artefactos | `<CODEGENERATION><IMPORTS><IMPORT MVN= REQUIRED=/></IMPORTS>` | Lo que le hace falta instalado |
| Columnas de salida | `<RETURNS><RETURN NAME= TYPE=/></RETURNS>` | Que devuelve |
| Familia | `<FAMILIES><FAMILY>...</FAMILY></FAMILIES>` | En que grupo esta (puede estar en varias) |
| Arranca un flujo | `HEADER STARTABLE="true"` | Si se puede usar como origen |

Detalles que surprises y que costan tiempo:

- **El valor por defecto es un elemento hijo**, `<DEFAULT>";"</DEFAULT>`, y ya es un literal de Java: lleva sus
  comillas. Un `DEFAULT` de atributo es otra cosa (no existe en estos XML).
- **El conector tiene dos nombres**: `NAME` es el que se usa al conectar (`FLOW`, `REJECT`, `ITERATE`,
  `UNIQUE`...) y `CTYPE` es el tipo de enlace. El conector principal no lleva `NAME`: se llama como su tipo.
- **El `MAX_INPUT`/`MAX_OUTPUT` del conector principal**: `MAX_INPUT=0` significa que el componente no puede
  recibir flujo (es un origen); `MAX_INPUT>=1` significa que consume. El `MAX_OUTPUT` del conector principal
  suele valer 1, asi que **no dice por si solo si el componente produce**: hay que mirar si tiene un conector
  propio (`REJECT`, `UNIQUE`, `DUPLICATE`...). El `FLOW` del `tUniqRow` tiene `MAX_OUTPUT="0"`: sus filas salen
  por `UNIQUE`.
- **Las macros de Talend** (`__COMP_DEFAULT_FILE_DIR__`) y las referencias a contexto (`${...}`) no sirven como
  valor: hay que sustituirlas por una ruta real.
- **Los componentes de la generacion nueva no estan en el XML**: vienen en archivos `.car` (AWS, JDBC, Snowflake,
  Athena, Delta, DynamoDB, SQS...). Son 120 de los 897 Standard. Su definicion esta en el codigo Java, asi que
  para ellos la unica fuente es la API de Studio.

### Lo que dice el modelo de Studio, y como se compara con el XML

- Los componentes "de siempre" son `org.talend.designer.core.model.components.EmfComponent`. Su
  `getCONNECTORList()` devuelve los mismos conectores que el XML (`CONNECTORTypeImpl` con `getNAME`, `getCTYPE`,
  `getMAXINPUT`, `getMAXOUTPUT`, `getSHOWIF`, `getNOTSHOWIF`, `getBASESCHEMA`).
- Los de la generacion nueva son `org.talend.sdk.component.studio.ComponentModel` y su `getCONNECTORList()` es
  **null**: no declaran conectores en el modelo. Por eso el generador se queja con
  "Missing output connection for component JDBC#Input" cuando se compilan sueltos. La conexion se puede crear
  igual (con `ConnectionCreateCommand`) y el componente compila: lo que falta es el `tLogRow` de destino.

### Las tablas de los parametros (FORMATS, CONDITIONS, CRITERIA...)

Los parametros de tipo `TABLE` son la parte que faltaba para configurar los componentes de transformacion. El
XML los describe:

```xml
<PARAMETER NAME="FORMATS" FIELD="TABLE" REQUIRED="true" NUM_ROW="60" NB_LINES="5">
  <ITEMS BASED_ON_SCHEMA="true">
    <ITEM NAME="SIZE" VALUE="10" CONTEXT="LENGTH" />
    <ITEM NAME="PADDING_CHAR" VALUE="' '" />
    <ITEM NAME="ALIGN" FIELD="CLOSED_LIST">
      <ITEMS DEFAULT="LEFT">
        <ITEM NAME="LEFT" VALUE="'L'" />
      </ITEMS>
    </ITEM>
  </ITEMS>
</PARAMETER>
```

- `BASED_ON_SCHEMA="true"`: la tabla tiene **una fila por cada columna del schema**.
- `NB_LINES`: numero de filas cuando no depende del schema.
- Cada `ITEM` es una columna de la tabla, con su valor por defecto. Si es una lista cerrada (`FIELD="CLOSED_LIST"`),
  su valor por defecto es el del `ITEM` que marca `DEFAULT`.

**La tabla del nodo puede tener mas columnas que las del XML**: la `FORMATS` del `tFileOutputPositional` declara
cuatro (SIZE, PADDING_CHAR, ALIGN, KEEP) y en el nodo hay cinco, con `SCHEMA_COLUMN` delante. Por eso las filas
se tienen que alinear con los codigos del nodo (`getListItemsDisplayCodeName`), no con los del XML.

Sin filas, el codigo generado sale con un hueco: el `tFileOutputPositional` genera
`tempLengthBx<<` y da "Syntax error on token '<'". Con las filas puestas, compila.

### El orden en que hay que montar un componente

Para medir si un componente compila (L4), el componente no puede estar solo:

1. Se anade el componente.
2. Se rellenan sus parametros obligatorios (los del XML, con su valor por defecto cuando existe).
3. Si **consume** (`MAX_INPUT >= 1`), se anade un `tFixedFlowInput` **con schema** y se conecta. El schema va
   antes de conectar: al conectar, Talend rehace las tablas del componente con las del origen. Si el componente
   tiene schema fijo (el `tFileOutputRaw`, que solo escribe una columna `content`), el origen tiene que traer
   esas mismas columnas: si no, "content cannot be resolved or is not a field".
4. Se rellenan las tablas del plan, ahora que ya se sabe cuantas columnas tiene el schema.
5. Se compila. Si el fallo es "Missing output connection", se anade un `tLogRow` y se compila otra vez.
6. Se borra todo.

### Las condiciones de visibilidad

`SHOW_IF` y `NOT_SHOW_IF` usan la sintaxis de expresiones de Talend: comparaciones de un parametro con un valor
entrecomillado, unidas con `and` y `or`, agrupadas con parentesis. Se pueden evaluar en el MCP:

```
(APPEND=='false') and (SPLIT=='false')
```

Un parametro cuya condicion no se puede decidir (porque depende de otro que no se conoce) se rellena con su
valor por defecto: es inofensivo.

## 31. La cobertura con montaje: como se mide L3 y L4 de verdad

`scripts/coverage.ts` mide el catalogo Standard (897 componentes). Cada componente se crea, se configura con sus
parametros obligatorios, **se monta** (origen y destino), se compila y se borra. El plan de montaje lo calcula el
MCP, leyendo el XML de la instalacion (`planMount`): que parametros van y si hace falta un origen.

- `--family "File/Input,File/Output"`: mide solo esas familias.
- `--components a,b,c`: mide los componentes indicados.
- `--compile`: ademas genera el codigo y comprueba que compila (L4).
- `--cancel`: para la medicion en marcha.

El ritmo es de unos 4 s por componente (la primera medicion, sin montaje, iba a 19 s: lo que mas costa es
generar el codigo y que el job se ensucie).

Lo que se midio con el metodo viejo (sin parametros obligatorios ni montaje), y lo que se mide ahora:

| | Antes | Ahora |
|---|---|---|
| `tFileOutputDelimited` | No compilaba (`The constructor File() is undefined`) | Compila |
| `tFileOutputRaw`, `tFileOutputLDIF`, `tFileOutputProperties` | No compilaban (schema incompatible) | Compilan |
| `tFileOutputPositional` | No compilaba (`Syntax error on token '<'`) | Compila |
| `tFilterRow`, `tSortRow`, `tAggregateRow` | "El `.item` sale, no genera codigo" | Compilan |
| `JDBCInput` y los demas de la generacion nueva | `Missing output connection` | Compilan (con el `tLogRow` de destino) |

Lo que **no** se arregla con esto, y es un limite del entorno:

- `tFileInputARFF`, `tFileInputXML`, `tFileOutputARFF`: el componente esta escrito para otra version de Weka
  (`addStringValue(String)`, `initXPaths_0`) y la que trae Studio no encaja.
- `tFileInputMSXML`: el codigo generado sale con una llave sin cerrar.
- Los componentes de base de datos: necesitan una conexion real del repositorio para compilar.

## 32. Conectar bien: el nombre de la conexion y el del conector

Conectar dos nodos tiene **dos** nombres, y confundirlos rompe el job de formas muy distintas:

| Que | Donde | Ejemplo |
|---|---|---|
| El **conector** | El atributo `connectorName` de la conexion, y el `NAME` del `<CONNECTOR>` del XML | `FLOW`, `UNIQUE`, `DUPLICATE`, `REJECT`, `ITERATE`, `SUBJOB_OK` |
| El **nombre** de la conexion | El `label` de la conexion: es la variable de la fila en el codigo generado | `row1`, `row2`, `OnComponentOk`, `If`, `Iterate` |

### El nombre de la conexion es `row1`, `row2`... y es global al job

Es la variable de la fila en el codigo generado, y las tablas de los componentes la referencian: el
`tAggregateRow` guarda "row1.monto" en su tabla `OPERATIONS`, y el `tUniqRow` "row1.id" en su `UNIQUE_KEY`.

- El numero es **del job**, no del nodo: la numeracion se hace con las conexiones que ya tiene el proceso, no
  con las del nodo de destino. En los jobs reales se ve como "row1", "row2" repartidas por todo el job.
- Los triggers tienen nombre fijo: `COMPONENT_OK` -> "OnComponentOk", `SUBJOB_OK` -> "OnSubjobOk", `RUN_IF` ->
  "If", `ITERATE` -> "Iterate".
- **El nombre tiene que ser distinto del de la conexion de entrada del nodo.** El `tUniqRow` libera la fila de su
  conexion de salida (`<salida> = null;`) antes de leer la de entrada: si las dos se llaman "row1", el codigo
  generado lee una variable nula ("Cannot read field \"id\" because \"row1\" is null").

### No todos los componentes sacan las filas por el conector principal

El `tUniqRow` declara `<CONNECTOR CTYPE="FLOW" MAX_OUTPUT="0" MAX_INPUT="1"/>` (el principal, que no puede
emitir) y luego dos conectores mas: `UNIQUE` (las filas unicas) y `DUPLICATE` (las repetidas). Conectar la salida
por "FLOW" **no da error**: el job compila y no sale ninguna fila. El conector se saca del XML del componente.

Lo mismo pasa con las tablas: el `tUniqRow` tiene una tabla por columna del schema (`BASED_ON_SCHEMA="true"`), y
la columna que forma la clave se marca con `KEY_ATTRIBUTE="true"`. La tabla del `tSortRow` (`CRITERIA`) usa los
valores de su XML: `SORT` es "num"/"alpha"/"date" y `ORDER` es "asc"/"desc" (en minusculas). Con otros valores, el
generador falla con "Index 0 out of bounds for length 0".

### El formato de las tablas de transformacion (resuelto)

Con el job montado a mano y con estos valores, el `tUniqRow` y el `tSortRow` generan codigo que compila y
ejecuta:

| Componente | Tabla | Columnas | Filas |
|---|---|---|---|
| `tUniqRow` | `UNIQUE_KEY` | `SCHEMA_COLUMN`, `KEY_ATTRIBUTE`, `CASE_SENSITIVE` | Una por columna del schema. `SCHEMA_COLUMN` es **la conexion de entrada mas la columna** ("row1.id"), y `KEY_ATTRIBUTE` va a "true" en las columnas que forman la clave |
| `tSortRow` | `CRITERIA` | `COLNAME`, `SORT`, `ORDER` | `COLNAME` es **solo el nombre de la columna** ("monto"), sin el prefijo de la conexion. `SORT` es "num"/"alpha"/"date" y `ORDER` es "asc"/"desc" |

Los dos detalles que mas costan:

- El prefijo de la conexion: en el `tUniqRow` va ("row1.id") y en el `tSortRow` no ("monto"). Con el prefijo
  equivocado, el `tSortRow` falla con "Index 0 out of bounds for length 0" (busca la tabla del nombre de la
  conexion y no la encuentra).
- **El schema de salida va en el conector que le toca**: el `tUniqRow` tiene dos conectores de datos, `FLOW` (la
  entrada) y `UNIQUE` (la salida), y su schema de salida va en `UNIQUE`. Si se deja vacio, el codigo generado no
  tiene struct de salida y no compila ("monto cannot be resolved or is not a field").

### El `tAggregateRow`: dos tablas de metadata y una conexion que cambia de tabla

El `tAggregateRow` es el caso dificil: tiene una tabla de entrada y otra de salida, y las dos van en el conector
`FLOW`. Ademas, **la conexion guarda la tabla de metadata por referencia**: al rellenar el schema del nodo, la
tabla que tiene la conexion de entrada se sustituye, y el generador deja de encontrar las columnas de entrada
("inputColumn is null").

Lo que se ha probado:

- El schema de salida (las columnas que produce: las del `GROUPBYS` y las del `OPERATIONS`) tiene que estar en
  el nodo, y **la primera** de las tablas: si no, el generador no encuentra la columna de salida ("outputColumn is
  null").
- La tabla de entrada tiene que traer las columnas del origen.

Lo que falta: hacer que el relleno del schema **no** rompa la tabla que la conexion tiene asignada (habria que
fusionar el schema con el que ya tiene el nodo en vez de sustituirlo) y saber que nombre espera el generador
para la tabla de entrada. Queda como pendiente.

### El conector es el del origen, no tiene que existir en el destino

El `connectorName` de la conexion es el conector **de salida del origen**. El destino usa su conector de
entrada principal, que no tiene por que llamarse igual: el `REJECT` del `tFileInputDelimited` entra en el
`FLOW` de un `tLogRow`, y el `UNIQUE` del `tUniqRow` tambien.

Por eso, al conectar, hay que mirar:
- que el conector sea una salida **del origen** (y que pueda emitir: el `FLOW` del `tUniqRow` tiene
  `MAX_OUTPUT="0"`);
- que el destino tenga algun conector de entrada.

Conectar por un conector que el origen no tiene (o que no puede emitir) **no da error**: el job se guarda,
compila y no sale ninguna fila. La tool `talend_job_connect_nodes` lo comprueba con las definiciones del XML
y avisa (con `skipValidation` se puede saltarse).

Al conectar, Talend rehace las tablas del componente con las del origen y se pierde lo que se habia puesto antes.
Es lo que pasa con el `tMap` (su modelo se aplica al final) y con las tablas de transformacion: se conectan los
nodos y despues se rellenan las tablas.

## 33. Ejecutar un job y leer su salida

Para comprobar el resultado de un job (L5) hacen falta dos pasos, porque la vista Run de Studio no se puede leer:

1. **Generar y compilar**: el Run de Studio (`/automation/run-active-job`) genera el codigo, lo compila y lo
   ejecuta. Deja el job compilado en `<proyecto>/poms/jobs/process/<job>/<job>_<version>/`, con un
   `target/classpath.jar` que lleva el classpath completo en su MANIFEST.
   - El Run es **asincrono** y el tracker del bridge no ve la terminacion: no hay que esperarlo (`waitForTermination`
     se queda esperando el tiempo entero).
   - La launch config se crea sola si no existe (`MCP_L5_Humo 0.1`).
2. **Relanzar para leer la salida**: `/automation/job/execute` ejecuta el job ya compilado en otra JVM y devuelve
   su `exitCode` y sus lineas.

El script `scripts/execution-check.ts` hace los dos y compara la salida con la esperada. Los escenarios estan en
`tests/fixtures/talend/escenarios-l5.json`.

## 34. Los jobs de Big Data (Spark)

Un job de Spark no es un job Standard con otros componentes: se declara en tres sitios a la vez.

| Donde | Que |
|---|---|
| El `.item` | `<talendfile:ProcessType ... jobType="Big_Data_Batch" framework="Spark">` |
| El `.properties` | El item es un `<MapRedProperties:MapReduceProcessItem>` (no un `ProcessItem`) y la propiedad lleva `<additionalProperties key="FRAMEWORK" value="Spark"/>` |
| El repositorio | El item se registra con el tipo `PROCESS_MR` ("Big Data Batch"), no con `PROCESS` ("Job Designs") |

Y sus archivos van en `process_mr`, **sin carpeta propia**: `process_mr/<job>_<version>.item`, al lado de los demas.
Los jobs normales van en `process/<job>/<job>_<version>.item`.

El item de Big Data no lo crea el modelo base: es
`org.talend.designer.mapreduce.mapRedProperties.MapRedPropertiesFactory` (plugin `org.talend.designer.mapreduce`).
Y el mapa de propiedades de EMF (`EcoreEMap`) **no es un `java.util.Map`**: para anadir el `FRAMEWORK` hay que
llamarle al `put` por reflexion.

El MCP ya crea estos jobs con `jobType` y `framework` (`talend_job_create_in_studio`), y los archivos salen
identicos a los de un job de Spark hecho a mano. **Pero este workspace no los puede abrir**: ni el job de Spark del
usuario (`prueba_3_Spark`) ni el del MCP abren, con "No se pudo resolver el ProcessItem para ...item. Verifique
que el job este en el repositorio Talend activo". Es un estado del repositorio del proyecto (los items de Big
Data no estan indexados), no del MCP. Los 397 componentes de Spark y Streaming siguen sin poder usarse.

## 35. Conectar con una base de datos

En Talend 8 la conexion se hace con **dos nodos**: un componente de conexion (`tPostgresqlConnection`,
`tMysqlConnection`, `tJDBCConnection`...) y el componente que usa la conexion (`tPostgresqlInput`,
`tMysqlOutput`...).

| Nodo | Parametros |
|---|---|
| `tPostgresqlConnection` | `HOST`, `PORT`, `USER`, `PASS`, `DBNAME` (no `DATABASE`), `ENCODING` |
| `tPostgresqlInput` | `USE_EXISTING_CONNECTION` a "true", `CONNECTION` con el nombre unico del nodo de conexion, `TABLE` o `QUERY` |

Tres detalles que cuestan un rato:

- **El driver tiene que estar en el `.m2` de Studio**, con la version exacta que pide el build. El build
  avisa por el log ("missing jar:postgresql-42.7.13.jar") y sale un modal "Error found". Se instala con la
  tool de artefactos (`talend_studio_install_artifact`, que deja el jar en
  `<instalacion>/configuration/.m2/repository`).
- **La `QUERY` es un memo** y los memos no se entrecomillan solos (el codigo Java del `tJavaRow` va en crudo).
  Una consulta SQL si necesita comillas: hay que pedirlo con `literal: true`. Si no, el codigo generado sale
  como `String dbquery = select id from clientes;` y no compila.
- **La `CONNECTION` es una lista de componentes**: su valor va **en crudo**, sin comillas (`literal: false`). Con
  comillas, el codigo sale como `globalMap.get("conn_"tDBConnection_2"")` y no compila.

El Postgres de pruebas se levanta con Docker (`testdata/docker-compose.yml`, puerto 5433) y sus datos tienen una
trampa a proposito: una transaccion que apunta a un cliente que no existe. La clave foranea se anade al final de
la carga y "NOT VALID", para que la carga no falle.

## 36. Los contextos (los entornos) de un job

Un job tiene contextos: "Default", "produccion"... Cada contexto tiene las mismas variables con **su propio
valor**. Son lo que se edita en la pestana Contexts de Studio.

La API de Studio (paquete `org.talend.core.model.context`):

| Que | Como |
|---|---|
| El gestor | `process.getContextManager()` -> `JobContextManager` |
| Los contextos | `manager.getListContext()` (un `ArrayList` mutable) |
| El entorno por defecto | `manager.getDefaultContext()` |
| Un contexto | `manager.getContext(indice)`, `context.getName()`, `context.setName(n)` |
| Crear un contexto | `new JobContext(nombre)` (el constructor recibe el nombre) |
| Las variables | `context.getContextParameterList()`, `context.getContextParameter(nombre)` |
| Crear una variable | `new JobContextParameter()` y `setName`/`setType`/`setValue` |
| Avisar del cambio | `manager.setModified(true)` y `manager.fireContextsChangedEvent()` |

El MCP los edita con esa API (no escribiendo el XML a mano) y guarda el job con `JobPersistence.persist`, asi que
el `.item` queda como lo dejaria el IDE:

```xml
<context confirmationNeeded="false" hide="false" name="produccion">
  <contextParameter name="DB_HOST" promptNeeded="false" repositoryContextId="" type="id_String" value="db.produccion.local" internalId="..."/>
</context>
```

**Los valores no viajan en el codigo generado**: la clase `ContextProperties` del job generado declara los campos
("will be instanciated by MS") y los injecta el runtime. Por eso un job relanzado a mano (`java -cp classpath.jar`)
no ve los valores del contexto, aunque su build tenga el `contexts/Default.properties` con ellos. Para comprobar
un contexto hay que leerlo del modelo (`talend_job_contexts_list`), no de la salida del job.

El runtime los acepta como argumentos: `--context=NOMBRE` y `--context_type CLAVE=VALOR` (por cada variable). El
bridge los lee del modelo y se los pasa al relanzar, asi que un job con contextos si se puede comprobar.

## 37. Los contextos del proyecto (los items de tipo "Contexts")

Son los items de la carpeta `context` del proyecto: un `.item` con un `ContextType` por entorno (y sus
`contextParameter`) y un `.properties` con las referencias (`<context href="...#xmi:id"/>`).

| Que | Como |
|---|---|
| El tipo del item | `ERepositoryObjectType.CONTEXT` ("Contexts") |
| El item del repositorio | `PropertiesFactory.createContextItem()` |
| Un entorno | `TalendFileFactory.createContextType()` |
| Una variable | `TalendFileFactory.createContextParameterType()` |
| Las variables de un entorno | No estan en la contencion: estan en la caracteristica `contextParameter` del `ContextType` (con `eGet`), y la lista solo admite cambios cuando el item ya esta guardado |

Dos cosas que se-ahead por el camino:

- **El `eGet` hay que buscarlo por el tipo de su argumento**: `eGet` tiene sobrecargas (por indice y por
  caracteristica), y la clase del modelo puede venir de otro classloader (el del plugin y el del puente), asi que
  buscar el metodo por nombre y llamarlo con la caracteristica falla con "argument type mismatch".
- **Crear un contexto del proyecto por la API no funciona**: el item se registra (el `.properties` sale) pero el
  entorno no se puede enganchar (las referencias del item solo admiten cambios cuando ya esta guardado y no hay
  forma de forzarlo). Por eso la tool falla con un error claro y borra lo creado, en vez de dejar un contexto
  vacio en el proyecto. Crear y leer si se pueden hacer con la API; los entornos y sus variables se leen del
  `.item` de cada item.

Y el orden de los entornos: el que trae `defaultContext="Default"` en el `.properties` es el de por defecto.



## 38. El proyecto Maven duplicado: "duplicated in the reactor"

Cuando un job se borra y se vuelve a crear, Studio deja en el workspace **dos** proyectos Maven con el mismo
nombre, y entonces **ningun job compila**:

```
[ERROR] Project 'org.example.prj_bancolombia.job:MCP_Coverage:0.1.0' is duplicated in the reactor
```

Los dos sitios posibles, bajo `poms/jobs/process` del proyecto de Eclipse:

| Sitio | Cuando pasa |
|---|---|
| `process/mcp_coverage_0.1/` | El proyecto generado, junto a los demas jobs |
| `process/MCP_Coverage/mcp_coverage_0.1/` | El proyecto generado, dentro de la carpeta del job |

La carpeta se llama `<etiqueta>_<version>` y en minusculas (`mcp_coverage_0.1`), **no** la etiqueta. Por eso el
borrado del bridge no la encontraba: buscaba una carpeta llamada `MCP_Coverage` y seakia el proyecto por debajo,
y se dejaba el otro. El fallo era silencioso: el job se creaba, se guardaba y se montaba bien, pero el build
fallaba siempre, asi que la medicion de cobertura daba **0 compilados** sin que se entendiera el por que.

Arreglo: al borrar un job se borran **todos** los proyectos generados con ese nombre (haya item en el repositorio
o no), en los dos sitios. Y si aparece el error, se mira si hay dos carpetas con el mismo `pom.xml`.

## 39. El proceso viejo: el build compila el job que no es

Al borrar un job y volverlo a crear, el **editor del proceso anterior** puede seguir abierto en Studio. Entonces el
build (`ProcessorUtilities.generateCode`) usa el proceso viejo, cuyo `JobInfo` tiene el `projectFolderName` a null, y
el agregador de Maven lista el modulo sin la carpeta del job:

```
[ERROR] Child module .../poms/jobs/process/mcp_coverage_0.1 of .../poms/build-aggregator.pom does not exist
```

El proyecto Maven, en cambio, si esta en `poms/jobs/process/MCP_Coverage/mcp_coverage_0.1` (con la carpeta). O sea:
el error no es que falte el proyecto, es que **el build esta mirando el job anterior**.

Se ve tambien en el `JobInfo` que devuelve `ProcessorUtilities.getMainJobInfo()`: `getJobName` es el job nuevo y
`getProjectFolderName` es null (en un job sano, es la carpeta del job en el arbol del repositorio).

Al borrar un job hay que hacer dos cosas, y las dos estan en `JobRepository.delete`:

1. **Cerrar sus editores** (`closeEditorsOfJob`), para que no quede el proceso viejo.
2. **Borrar el proyecto Maven generado**, como proyecto de Eclipse (`IProject.delete`), no solo la carpeta: si se
   borra la carpeta y el proyecto de Eclipse sigue dado de alta, m2e se queda con su entrada en
   `workspacestate.properties` y el build de cualquier job falla con "El recurso .../pom.xml no existe".

## 39. El heap de Studio se llena y el IDE deja de responder

Una sesion de mediciones largas (unas 150 en total: las familias de archivos, las locales, MySQL y las que se
cancelaron) dejo a Studio **sin memoria**: el heap del JVM (4 GB) estaba al 100 % y el IDE se quedo colgado
(hacia el 100 % de CPU en varios nucleos, que es el recolector de basura en espiral). La interfaz no respondia, el
bridge tampoco (todas sus rutas esperan al hilo de la UI) y al final el proceso de Studio murio.

Como se ve:

```bash
jcmd <pid> GC.heap_info
# garbage-first heap   total 4194304K, used 4191494K   <- lleno
```

Que se llena, en este orden:

| Sospechoso | Por que |
|---|---|
| El codigo generado de cada job | Cada medicion compila el job de pruebas: quedan el proyecto Maven, su `target` y el codigo fuente generados. Con 150 mediciones son cientos de megabytes que Eclipse indexa (el hilo "Indexado Java" se dispara) |
| Los proyectos Maven que se borran a posteriori | Al borrar el proyecto de Eclipse, m2e actualiza su estado (`workspacestate.properties`) y el indexer vuelve a indexar |
| El `run_code` del bridge | Cada ejecucion cargaba las clases en un `URLClassLoader` que no se cerraba nunca: las clases compiladas se quedaban en el heap |

Que se hizo para que no vuelva a pasar:

1. **La medicion vigila la memoria**: `scripts/coverage.ts` consulta la memoria del JVM en cada vuelta y **cancela la
   medicion al 80 %** del heap, en vez de dejar que el IDE se quede sin memoria.
2. **Una ruta nueva para ver la memoria**: `/automation/memory` (y la tool `talend_studio_memory`) dicen cuanto
   heap se lleva, y con `gc: true` piden una recoleccion.
3. **El `run_code` cierra su classloader** al terminar.

Y la moraleja: **entre mediciones largas hay que reiniciar Studio**. Una medicion de 44 componentes tarda un minuto
y no pasa nada; tres o cuatro seguidas, con todo el codigo generado, pueden tumbar el IDE. Ademas, `jcmd <pid>
GC.run` recupera a un Studio que se ha quedado sin memoria (si el proceso no ha muerto todavia).

## 40. Los triggers: el conector va con el tipo del catalogo

Una conexion de trigger (el "On subjob ok" de un componente) tiene **dos** nombres, y aqui se confunden facil:

| Que | Atributo en el `.item` | Valor de un trigger |
|---|---|---|
| El **conector** | `connectorName` | `SUBJOB_OK`, `COMPONENT_OK`, `RUN_IF`... (el tipo del catalogo) |
| El **nombre de la conexion** | `label` | `OnSubjobOk`, `OnComponentOk`, `If`... |

Es decir, un trigger bien hecho se guarda asi:

```xml
<connection connectorName="SUBJOB_OK" label="OnSubjobOk" lineStyle="1"
            metaname="tDBOutput_2" source="tDBOutput_2" target="tDBCommit_2">
```

Con `connectorName="OnSubjobOk"` (el nombre "bonito") pasan tres cosas en cadena:

1. `Node.getConnectorFromName("OnSubjobOk")` devuelve `null`: la lista de conectores del nodo tiene
   `SUBJOB_OK`, no `OnSubjobOk`. El `ConnectionCreateCommand` revienta con
   `NullPointerException: nodeConnectorSource is null` (se ve en `.metadata/.log`), pero **despues** de haber
   metido la conexion en el modelo.
2. La conexion queda con `lineStyle="0"` (flujo de datos) y el `connectorName` que se le paso.
3. El generador la trata como flujo: copia la fila del origen en un struct del destino que no tiene columnas y
   el job no compila con `nombre cannot be resolved or is not a field`.

El comando saca el tipo de la linea de
`INodeConnector.getDefaultConnectionType()` del conector que se le pasa, asi que con el nombre del catalogo no
hace falta tocar el estilo a mano. Los estilos que se han medido en el `.item`, por si hay que comprobarlos:

| `lineStyle` | Tipo de conexion |
|---|---|
| 0 | `FLOW_MAIN` (`FLOW`) |
| 1 | `ON_SUBJOB_OK` (`OnSubjobOk`) |
| 4 | `ON_SUBJOB_ERROR` (`OnSubjobError`) |

Ojo: el `lineStyle` **no** es el ordinal del enum (en `EConnectionType`, `ON_SUBJOB_OK` es el 3 y
`ON_SUBJOB_ERROR` el 4). El enum tiene 24 constantes, y lo que va en el `connectorName` del `.item` es
`getName()`, no `name()`:

| `name()` | `getName()` |
|---|---|
| `FLOW_MAIN` | `FLOW` |
| `ON_SUBJOB_OK` | `SUBJOB_OK` |
| `ON_SUBJOB_ERROR` | `SUBJOB_ERROR` |
| `ON_COMPONENT_OK` | `COMPONENT_OK` |
| `ON_COMPONENT_ERROR` | `COMPONENT_ERROR` |
| `RUN_AFTER` | `AFTER` |
| `RUN_IF` | `RUN_IF` |
| `FLOW_REF` | `LOOKUP` |
| `FLOW_MERGE` | `MERGE` |
| `ITERATE` | `ITERATE` |

Todos los nodos llevan los conectores de trigger en su lista (`SUBJOB_OK`, `SUBJOB_ERROR`, `COMPONENT_OK`,
`COMPONENT_ERROR`, `RUN_IF`, `AFTER`...), aunque el componente no los use. Se consultan con
`node.getListConnector()` (`getConnectors()` no existe) y cada uno trae `getName()`, `getBaseSchema()` y
`getDefaultConnectionType()`.


## 41. El tAggregateRow: la primera tabla de metadata es la de salida

El `tAggregateRow` (y el `tAggregateSortedRow`) son componentes "virtuales": en el IDE son un par
(`tAggregateIn` + `tAggregateOut`) y su codigo se genera con las plantillas de esos dos. La plantilla
`tAggregateOut_main.javajet` saca la tabla de salida asi:

```java
List<IMetadataTable> mestadataTableListOut = node.getMetadataList();
outputMetadataTable = mestadataTableListOut.get(0);   // <-- la PRIMERA
outputColumns = outputMetadataTable.getListColumns();
```

La tabla de entrada, en cambio, sale de la **conexion**:

```java
inputMetadataTable = conn.getMetadataTable();
inputColumns = inputMetadataTable.getListColumns();
```

De ahi las cuatro reglas para configurar un agregado:

1. **La tabla de salida va la primera** de la lista de metadata del nodo. En el spec del bridge, el orden de
   `esquemas` es el orden de la lista: la primera entrada es la de salida.
2. **El origen se queda con una sola tabla**: la de salida del agregado. La tabla de entrada es la de la
   conexion, no hace falta declararla (y declararla crea una tabla suelta que no usa nadie).
3. **Las tablas del agregado (`GROUPBYS`, `OPERATIONS`) usan el nombre simple de la columna**, no
   `row1.columna`: la plantilla busca con `column.getLabel().equals(columnname)`. Y las funciones van en
   minusculas (`sum`, `count`, `max`...), porque las compara con `("avg").equals(fun)`.
4. **El numero de columnas del origen tiene que ser el mismo que el de la salida del agregado**. El generador
   del `tFileInputDelimited` asigna los valores del fichero por posicion contra el esquema del destino: si el
   origen tiene mas columnas que la salida del destino, falla con
   `Index N out of bounds for length N` (en `TFileInputDelimitedBeginJava.codeForValueToConnWithD`).

## 42. Conectar propaga el esquema del destino hacia atras

Al conectar dos componentes, Talend sincroniza el origen con el destino. Si el destino ya tiene un esquema
(el `tAggregateRow` con sus columnas de salida), **el origen se queda con esas columnas** y su tabla de
rechazo tambien. Es el comportamiento del IDE (alli sale un aviso), pero por API pasa en silencio.

Consecuencia: el esquema del origen hay que ponerlo **despues de conectar**, como hace el IDE. En el
arnes (`scripts/execution-check.ts`) el nodo se marca con `"schemaDespuesDeConectar": true`, y los
esquemas "despues" se aplican **con los origenes al final**: son los que se han quedado descolocados.

Ademas, la tabla de rechazo (`REJECT`) del origen queda con las columnas del destino, y el generador del
lector falla (`Index N out of bounds`). El bridge lo arregla solo: en `applySchema`, si la tabla de
rechazo tiene columnas que no son del propio nodo, se la deja con las dos de error (`errorCode` y
`errorMessage`).

## 43. El nombre de la columna en la base de datos: `setOriginalDbColumnName`

Un `IMetadataColumn` tiene tres nombres: la etiqueta (`getLabel`), el id (`getId`) y el nombre de la
columna en la base de datos (`getColumnName`). **No hay `setColumnName`**: el nombre de la BD se pone con
`setOriginalDbColumnName`.

Si no se pone, el `tDBOutput` genera el INSERT con los nombres de columna a null:

```sql
INSERT INTO "l5_salida" (null,null,null,null) VALUES (('1'::int4),('Ana'),('Bogota'),('100.5'::double precision))
```

que el Postgres rechaza con `column "null" does not exist`. Ojo: `getColumnName()` **cae en la etiqueta**
cuando no hay nombre de BD, asi que el sintoma (nombres a null) viene de otro sitio: el generador usa el
nombre de la BD, no el de la etiqueta.

El puente lo pone en los dos caminos que crean columnas: `ComponentConfigurator` (el `schema` de un
componente) y `SchemaOperations` (el `schema` con filas de un `tFixedFlowInput`). Si solo se pusiera en
uno, el esquema se contagia por la conexion y el bug vuelve.

## 44. Los parametros de lista no se entrecomillan

El IDE escribe los valores de un parametro de tipo lista **sin comillas** (`value="TRUNCATE"`) y
los de tipo `TEXT` o `DBTABLE` **con comillas** (`value="&quot;l5_salida&quot;"`). El puente los
entrecomillaba todos, y con las comillas ninguna comparacion de la plantilla encaja: el `TABLE_ACTION` de
un `tDBOutput` valia `"TRUNCATE"` y la accion de tabla no se ejecutaba (sin ningun error visible).

Lo mismo con `COMPONENT_LIST` y con `PREV_COLUMN_LIST` (la columna a normalizar de un `tNormalize`:
con comillas salia `fila."columna"`).

La regla del bridge es general: **si el tipo del campo acaba en `_LIST`, el valor va sin comillas**;
el resto, como hasta ahora. Ojo: esto es para los **parametros**. Los valores de las **celdas de una
tabla** tienen su propia regla (seccion 46).

## 45. Escribir en una base de datos: como se hace

El camino que funciona (probado contra un Postgres):

1. El `tDBOutput` (o `tPostgresqlOutput`) con `USE_EXISTING_CONNECTION=true` y la conexion compartida.
2. La conexion con `AUTO_COMMIT=true`. El `tDBOutput` no hace commit por su cuenta: escribe el lote al
   final (en la seccion "end" del componente) y, sin commit, al cerrar la conexion se pierde todo.
3. **No hay que encolar un `tPostgresqlCommit`**. Si se encola (conectado a la salida del output), se
   ejecuta **dentro del bucle de filas**: el output emite cada fila al downstream, el commit hace
   `commit()` y cierra la conexion, y el lote que se escribe al final falla con
   `This connection has been closed`.
4. `TABLE_ACTION` es un valor de la lista cerrada: `NONE`, `DROP_CREATE`, `CREATE`,
   `CREATE_IF_NOT_EXISTS`, `DROP_IF_NOT_EXISTS_AND_CREATE`, `CLEAR`, `TRUNCATE`. `DELETE` no existe.
5. Las columnas que se escriben van en la tabla `FIELD_OPTIONS` (cinco campos por columna: `SCHEMA_COLUMN`,
   `UPDATE_KEY`, `DELETE_KEY`, `UPDATABLE`, `INSERTABLE`). En el spec del arnes, `FIELD_OPTIONS` es un
   parametro de tipo TABLE: va en `tablas`, no en `parameters`.
6. `MAPPING` es el id del motor (`PostgreSQL`, `MySQL`...), no el nombre del componente.

## 46. Los valores de las celdas de tabla: los nombres sin comillas

Los valores de las **tablas** de un componente (las de metadata: `GROUPBYS`, `OPERATIONS`, `CONDITIONS`,
`CRITERIA`, `UNIQUE_KEY`, `MAPPING_JSONPATH`...) van al codigo generado como literales Java. El IDE
entrecomilla las que son literales y deja sin comillas las que son nombres.

Las celdas cuyo codigo es un **nombre** van sin comillas:

| Codigo de celda | Que es |
|---|---|
| `SCHEMA_COLUMN` | La columna del esquema |
| `COLNAME` | La columna que se ordena o se filtra |
| `INPUT_COLUMN` / `OUTPUT_COLUMN` | Las columnas de entrada y de salida de una transformacion |
| `FUNCTION` | La funcion de agregacion (`sum`, `count`...) |
| `OPERATOR` | El operador de una condicion (`>`, `=`...) |
| `SORT` / `ORDER` | Como se ordena (`num`, `desc`...) |
| `KEY_ATTRIBUTE` / `CASE_SENSITIVE` | Los flags de una clave unica |
| `PARAMETER_NAME` | El nombre de un parametro |
| `TARGET_COLUMN` | La columna destino |

Las demas van **como literales Java** (con comillas), como hace el IDE. Asi la consulta JSONPath de un
`tFileInputJSON` sale como `"$.clientes[*].id"` y compila: entrecomillada, el generador la buscaba con
las comillas dentro y no encontraba la ruta.

Los booleanos y los numeros tampoco llevan comillas (los reconoce el mismo codigo que los pone como
literales).

Donde esta: `ComponentConfigurator.valorDeCelda` (decide que hacer con cada celda) y
`ComponentConfigurator.esNombreDeCelda` (la lista de codigos que son nombres). Antes el bridge
entrecomillaba **todas** las celdas: por eso la consulta JSONPath salia mal.

Ojo: esta regla es para las celdas de una **tabla**. Los **parametros** tienen la suya (seccion 44:
sin comillas si el tipo acaba en `_LIST`).

## 47. El tFileList en Talend 8: no emite filas, deja valores en el globalMap

El `tFileList` se declara con el conector `FLOW` como `MAX_OUTPUT=0` y `MAX_INPUT=0`: **no emite
filas**. No hay ninguna columna `CURRENT_FILE` que rellenar, y por eso no se puede encadenar a un
`tLogRow` esperando datos.

Lo que hace es listar la carpeta y **dejar los valores en el `globalMap`**, con el nombre del
componente delante:

| Clave | Que es |
|---|---|
| `<uniqueName>_CURRENT_FILE` | El nombre del fichero |
| `<uniqueName>_CURRENT_FILEPATH` | La ruta completa |
| `<uniqueName>_CURRENT_FILEDIRECTORY` | La carpeta |
| `<uniqueName>_CURRENT_FILEEXTENSION` | La extension |
| `<uniqueName>_NB_FILE` | Cuantos ficheros ha listado |

El `uniqueName` es el del nodo (`tFileList_2`, no el nombre que le pone el arnes): para leer un valor
hay que ir al `globalMap` con esa clave.

Dos trampas:

1. **El `LIST_MODE` es el tipo de listado, no el orden**: `FILES`, `DIRECTORIES` o `BOTH`. Si se le
   pone `"ASC"`, el componente **no lista nada**: el codigo generado se queda con la lista vacia (sin
   error visible). El orden va en otros parametros (`ORDER_BY_FILENAME`, `ORDER_ACTION_ASC`).
2. Como no emite filas, el `tFileList` va **suelto** en el job (no conectado al flujo de datos). Para
   consumir sus valores, un `tJavaRow` (o cualquier codigo) lee el `globalMap`.

## 48. El tFileInputJSON: la raiz del bucle y el mapeo

Con `READ_BY=JSONPATH` (no `XPATH`):

1. **La raiz del bucle es el parametro `JSON_LOOP_QUERY`** (`$.clientes[*]`). `LOOP_QUERY` es del
   modo `XPATH`: con `JSONPATH` no se usa, y sin el `JSON_LOOP_QUERY` el componente no encuentra
   nada.
2. **El mapeo de columnas va en la tabla `MAPPING_JSONPATH`**, con dos columnas: `SCHEMA_COLUMN` (la
   columna del esquema) y `QUERY` (la ruta dentro del elemento, `$.id`). El valor de `QUERY` es un
   literal: va con comillas (seccion 46).
3. El **pom del job si hereda las librerias** que declara el componente (`json-path`, `json-smart`,
   `accessors-smart`, `slf4j`), si el nodo se crea con la API de Studio. Antes el build no las anadia
   y el codigo no compilaba (`org.json.simple.JSONValue cannot be resolved to a type`).

## 49. El tNormalize: la salida copia las columnas de la entrada por su nombre

El codigo generado del `tNormalize` copia las columnas de la salida desde las de la entrada **por el
mismo nombre**:

```java
row2.nombre = row1.nombre;
```

asi que **la salida tiene que declarar las mismas columnas que la entrada**. Si no, el error es
`apellido cannot be resolved or is not a field`.

Los dos parametros que importan:

| Parametro | Que es |
|---|---|
| `NORMALIZE_COLUMN` | La columna que se parte. Es de tipo `PREV_COLUMN_LIST`: va **sin comillas** (seccion 44) |
| `ITEMSEPARATOR` | El separador de los elementos (`;`) |

El componente **multiplica filas**: una por cada elemento de la columna, repitiendo las demas.

| Entrada | Salida |
|---|---|
| `nombre=Ana`, `etiquetas=rojo;verde` | `Ana|rojo` y `Ana|verde` |
| `nombre=Jose`, `etiquetas=azul` | `Jose|azul` |

## 50. El tJavaRow: el codigo se inserta tal cual

El codigo del `tJavaRow` (el parametro `CODE`) se inserta **tal cual** en el job, sustituyendo
`input_row` y `output_row` por el **nombre de las conexiones** (`row1`, `row2`...):

```java
output_row.nombre_mayus = input_row.nombre.toUpperCase();
```

La fila de entrada sale de la **conexion** y la de salida, del **esquema del nodo** (por eso el
esquema del `tJavaRow` hay que ponerlo despues de conectar).

**Trampa**: si una columna del esquema es entera y **no admite nulos**, el codigo generado hace
`row.id != null` sobre un `int`, y eso no compila. Usa columnas `String` (o que admitan nulos).

## 51. Al compilar: `Child module ... does not exist` (el agregador Maven y el heap)

Studio compila cada job con Maven a traves de un agregador que genera al vuelo. Con el heap cargado
ese agregador sale mal: referencia un modulo que ya no existe (el de un job que se borro) y
**todas** las compilaciones siguientes fallan con el mismo error, aunque el job este bien:

```
[ERROR] Child module C:\...\poms\jobs\process\mcp_coverage_0.1 of C:\...\poms\build-aggregator.pom does not exist
```

Paso midiendo 77 componentes de golpe: tras unos 33, el agregador quedo apuntando a un proyecto
que se habia borrado y los 42 siguientes fallaron con ese texto. El error es del build, no del
componente: al repetir esos 42 en tandas, con el heap por debajo del 60 %, **compilaron todos**.

Que hacer:

- **La causa de fondo es el heap.** `scripts/coverage.ts` fuerza un recolector cuando pasa del
  60 % (ver abajo) y corta al 80 %; asi una tanda de 21 componentes termina sobrada. Sin el
  recolector se rompia al segundo componente.
- Medir **por tandas** (una familia o dos por corrida), no las 17 de una vez.
- Si aun asi aparece el error, lo medido en esa tanda no vale: **repetir esos componentes en una
  corrida nueva**. No hay que recrear el job ni reiniciar Studio: el agregador se regenera al
  volver a compilar (fue lo que se hizo con los 42, y compilaron).

El sintoma se reconoce porque `error_compilacion` trae `Child module ... does not exist` y no un
error de Java.

### La memoria: se puede forzar una recoleccion

El endpoint `/automation/memory` acepta `{"gc": true}` y llama a `System.gc()`. Ojo: **los
porcentajes que devuelve son los de antes de recolectar** (mide y luego recoge), asi que hay que
volver a consultarlo para ver el efecto real:

```
POST /automation/memory {"gc": true}  ->  {"usedPercent": 83, "gc": true}
POST /automation/memory {}            ->  {"usedPercent": 51}
```

`scripts/coverage.ts` lo aprovecha: cuando el heap pasa del 60 % pide una recoleccion y usa el
valor posterior para decidir si cancela (corta al 80 %). Sin el recolector, una corrida de 21
componentes se quedaba en 2; con el, la tanda avanza mucho mas antes de necesitar un reinicio.

## 52. El driver de la base no hace falta para compilar, solo para ejecutar

Los componentes de base de datos declaran el driver en los `IMPORT` obligatorios del XML:

```xml
<IMPORT NAME="Driver-DB2" MODULE="db2jcc4.jar" MVN="mvn:org.talend.libraries/db2jcc4/6.0.0" REQUIRED="true" />
```

De ahi se deduce (mal) que sin ese jar el componente no compila. **Si compila**: el codigo que genera
Talend no usa los tipos del driver, lo carga por nombre al ejecutar. Medido con las ocho familias de
`DB Specifics` que no tienen driver en el `.m2` (DB2, Greenplum, Informix, Ingres, Netezza, Sybase,
Teradata y Vertica): **102 componentes, 101 compilan** sin instalar nada.

Lo que el jar resuelve es la **ejecucion** (L5): sin driver y sin servidor, ese job no corre.

La consecuencia para la medicion: L4 de las familias de base de datos se puede medir entera sin
descargar drivers; lo que no se puede prometer es L5. El unico fallo de esas ocho familias fue
`tIngresBulkExec`, y no es el driver: el codigo generado referencia una variable que Talend no
declara (`executableFilePath_tDBBulkExec_4 cannot be resolved`), que es un fallo de generacion del
componente.

Como se consulta que pide un componente, sin abrir el IDE:

```powershell
# El driver (y demas artefactos) que exige un componente
Select-String -Path <plugins>\...\components\tTeradataInput\TeradataInput_java.xml -Pattern 'MVN="[^"]+"[^>]*REQUIRED="true"'
```

Solo cuentan los `IMPORT` con `REQUIRED="true"` (los que llevan `REQUIRED_IF` son condicionales).

## 53. Un trigger solo se genera si sale del **arranque** del subjob

El generador de Studio emite la llamada al destino de un trigger dentro del metodo del **primer componente**
del subjob (el que la plantilla reconoce con `INode.isDesignSubjobStartNode()`). Un trigger que sale de un
componente de en medio del flujo **se guarda en el job, compila y no se ejecuta nunca**: no hay aviso, la
conexion esta ahi con su `lineStyle="1"` y el destino simplemente no aparece en el `main` generado.

Medido con tres jobs de dos o tres nodos:

| Job | Conexion | Codigo generado |
|---|---|---|
| `tJava_2` -> `tJava_4` (`SUBJOB_OK`) | el origen es el arranque | `tJava_4Process(globalMap);` dentro de `tJava_2Process` |
| `tFixedFlowInput` -> `tLogRow`, `tLogRow` -> `tJava` | el origen esta a mitad de flujo | nada; `tJava_2Process` no se llama en ningun sitio |
| `tFixedFlowInput` -> `tLogRow`, **`tFixedFlowInput`** -> `tJava` | el origen es el arranque | `tJava_2Process(globalMap);` al final del metodo del subjob, despues del `tLogRow` |

De ahi la regla practica: **el trigger se dibuja desde el primer componente del subjob**, no desde el ultimo.
Para un commit explicito, el `tDBCommit` se cuelga del `tFixedFlowInput` (o del componente de arranque que sea),
no del `tDBOutput`: la llamada se emite al final del subjob, cuando la escritura ya ha terminado.

El bridge devuelve un aviso (`warnings`) cuando el origen de un trigger no es el arranque del subjob, porque el
fallo es mudo.

El otro detalle es el orden de las conexiones: el generador recorre las salidas del arranque y emite el flujo
y el trigger en la misma pasada; por eso el nombre de la conexion del trigger (`OnSubjobOk`) no puede coincidir
con el de la fila.

### El destino de un trigger tiene que poder arrancar su propio subjob

`ConnectionManager.canConnectToTarget` rechaza las conexiones `ON_SUBJOB_OK` y `ON_SUBJOB_ERROR` cuando el
destino no es el arranque de su propio subjob:

```java
if (!target.getUniqueName().equals(target.getDesignSubjobStartNode().getUniqueName())) {
  return false;
}
```

Un `tFileOutputDelimited`, un `tDBOutput` o un `tLogRow` necesitan entrada, asi que no arrancan subjob: si se
les cuelga el trigger directamente, **Studio no crea la conexion**. El patron correcto es colgar el trigger de
un componente que pueda empezar subjob (`tFixedFlowInput`, `tJava`, `tDBCommit`...) y, si el manejador tiene que
escribir o transformar, montar debajo un subjob normal (`tFixedFlowInput` -> `tFileOutputDelimited`).

Y el rechazo es **mudo**: `CommandStack.execute` comprueba `canExecute()` y, si devuelve `false`, no hace nada y
no lanza. Por eso el bridge ahora llama a `canExecute()` antes de ejecutar (y falla con un mensaje que explica
el motivo) y despues comprueba que la conexion esta en el modelo (`target.getIncomingConnections()`); antes
respondia `ok` sin haber conectado nada.

### Un fallo no siempre dispara el trigger de error

Medido con dos jobs iguales salvo el origen del fallo:

| Fallo | Resultado |
|---|---|
| `tDie` en el flujo | el manejador de `SUBJOB_ERROR` corre y el job termina con codigo 1 |
| `tFileInputDelimited` con un fichero que no existe | el job registra `[ERROR]`, **no** ejecuta el manejador y termina con codigo **0** |

Para probar un trigger de error hace falta un fallo que lance de verdad (`tDie`, `tAssertCatcher`...). Un
`tFileInputDelimited` sin fichero deja el subjob a medias sin pasar por el manejador.

### El orden importa: primero los flujos, despues los triggers

`canConnectToTarget` tambien rechaza un **flujo** cuando el arranque del subjob ya tiene un trigger de subjob
(`ON_SUBJOB_OK`/`ON_SUBJOB_ERROR`) y el destino del flujo no puede arrancar subjob. Es decir: si primero se
cuelga el trigger y despues se intenta conectar el flujo, la conexion de datos falla. Se montan primero las
conexiones de datos y al final los triggers.

## 54. Donde acaba el codigo generado de un job

Hay dos sitios posibles y no depende del tipo de job sino del estado del proyecto Maven:

| Carpeta | Cuando aparece |
|---|---|
| `poms/jobs/process/<JOB>/<job>_<version>/` | lo normal: el proyecto Maven del job esta montado y se genera ahi |
| `PRJ_<PROYECTO>_<JOB>_<VERSION>/` (en la raiz del workspace, job en mayusculas) | el proyecto Maven del job existe pero esta **vacio**; el generador deja el codigo en un proyecto suelto con el mismo layout |

En los dos casos el layout es el mismo (`src/main/java/<paquete>/<Job>.java`, `target/classes`,
`target/classpath.jar`). Lo que cambia es donde hay que buscar el `classpath.jar` para relanzar el job a mano:
si solo se mira `poms`, un job que se ha generado en el proyecto suelto "no esta compilado" aunque acabe de
compilarse y ejecutarse desde el IDE.

El sintoma tipico: en `poms/jobs/process/<JOB>/` hay una carpeta `mcp_<job>_0.1` vacia (sin `src` ni `target`)
y el `MCP_<JOB>.java` esta en `PRJ_<PROYECTO>_MCP_<JOB>_0.1/src/main/java/...`.

## 55. Studio bloquea el `classpath.jar` del job que ha cargado

Cuando Studio carga las clases de un job en su propia JVM (el `Run` remoto o embebido), el
`target/classpath.jar` se queda abierto mientras viva Studio. El siguiente build intenta limpiar la carpeta
y falla antes de generar nada:

```
java.nio.file.FileSystemException: ...\target\classpath.jar: El proceso no tiene acceso al archivo.
  at org.talend.designer.runprocess.java.TalendProcessJavaProject.cleanFolder
  at org.talend.designer.maven.tools.MavenPomSynchronizer.cleanMavenFiles
```

La carpeta se queda con el `pom.xml`, `src/main/java` **vacio** y un `classpath.jar` de 1 KB (solo el
manifiesto). A partir de ahi el job responde `No se encontro la clase principal del job en target/classes`
en todos los intentos, `compile` contesta `compiles: true` porque no hay nada que compilar y la carpeta
tampoco se puede borrar desde fuera (`Remove-Item` da acceso denegado). Lo unico que lo suelta es
**reiniciar Studio**: no hay forma de liberar el jar desde el MCP.

Medido con un job de tres nodos (`tFixedFlowInput` -> `tWarn` -> `tLogRow`): el primer Run lo dejo bloqueado
y los builds siguientes ya no generaron codigo.

Consecuencia practica: no lanzar `executeJob` mientras Studio esta compilando ese job. El arnes lo hace para
saber si el build ha terminado, y justo ahi esta el riesgo: abre el jar en el momento en que Studio lo va a
reemplazar.

