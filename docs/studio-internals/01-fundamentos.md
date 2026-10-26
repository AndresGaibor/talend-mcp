# Internals de Talend Studio: Entorno, ejecucion y modelo

[Indice completo](../TALEND-STUDIO-INTERNALS.md)

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
