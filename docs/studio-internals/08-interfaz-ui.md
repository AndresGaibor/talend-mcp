# Internals de Talend Studio: Interfaz de usuario

[Indice completo](../TALEND-STUDIO-INTERNALS.md)

Este archivo describe la interfaz de Talend Studio 8.0.1 tal como la ve un agente: menus,
pestanas, paneles, perspectivas y los dialogos que aparecen en cada flujo. Cada seccion dice si
el dato se verifico en vivo, se leyo del codigo o de los bundles, o no se pudo ver.

Para repetir el inventario en vivo, usa el tool `talend_studio_ui_inventory` (requiere
`unsafeActions: true` y tarda unos 15 s, casi todo en recorrer los bundles).

## 72. Inventario de la interfaz

**Verificado en vivo** con `talend_studio_ui_inventory` (Studio abierto, perspectiva Integration).

- **Barra de menus:** Archivo, Editar, View, Ventana, Ayuda. *Archivo* tiene Guardar (Ctrl+S,
  deshabilitado si el editor activo no tiene cambios), Guardar todo, Guardar como, Cerrar,
  Cerrar todos, Imprimir, Importar, Exportar, Edit Project properties, Switch Project or
  Workspace, Restart y Salir. *Ayuda* tiene Help Center, Welcome, Ask the community, Academy,
  Support, About, Get started y What's new. *View* y *Ventana* se rellenan al abrirse: no vienen
  en el inventario.
- **Perspectivas (13):** Integration (la de Talend), Profiling (DQ), Git, Git Merge, Data
  Explorer, Drools, Depurar, Java, Examinar Java, Jerarquia de tipos, Sincronizacion, Resource y
  XML.
- **Barra de herramientas principal:** Feature Manager, Merge Reference Projects, Project
  settings, Detectar y actualizar todos los trabajos, Import Demos, Export Items, Import Items,
  Designer color settings, Undo/Redo, Toggle SubJobs, Select/Move mode, Abrir perspectiva,
  Cancelar operacion actual, progreso de segundo plano y Palette.
- **Panel izquierdo, "Repositorio":** arbol con Job Designs, Contexts, Codigo, SQL Templates,
  Metadata, Documentation, Recycle bin y Referenced project. Debajo, el estado Git: rama, un
  indicador de commits pendientes ("Commit ↓6") y, en el momento de la sonda, el banner
  "Connection lost. Do you want to reconnect?".
- **Pestanas del editor:** Welcome y una pestana por job abierto. Un asterisco marca el job con
  cambios sin guardar. Dentro de cada job hay dos pestanas: **Designer** (lienzo GEF) y **Code**
  (codigo generado).
- **Panel inferior de un job:** Trabajo (Job Settings), Context, Component, Run, Test Cases,
  Cloud Artifact, Talend Git Staging y Modules.
  - *Trabajo* tiene una lista lateral de 5 secciones (sin texto legible desde el inventario),
    los campos Nombre, Author, Version, Creacion, Update, Job Type, Framework y Status,
    Description y Purpose, un editor Markdown de documentacion y un panel de asistente IA.
  - *Context* tiene los botones *Manage variables* y *Manage environments* y una tabla de
    contextos (NatTable).
  - *Run* tiene los botones Run, Kill, Clear, Lineage Testing, Line limit, Wrap y ">>", y una
    tabla Nombre | Valor.
  - *Talend Git Staging* tiene la rama, Show Path, Show Technical Files, History, Author,
    Committer, Commit y Commit and Push.
  - *Cloud Artifact* y *Modules* no se crean hasta que se abren: el inventario no las toca,
    porque abrir Cloud Artifact puede conectar con Talend Cloud.
- **Otras vistas:** Esquema (outline) y Visor codigo. Registradas aunque cerradas: Problems,
  Jerarquia de trabajos, Compare Result, Conflicts Navigator, Git History, Bookmarks, y las de
  DQ (Pattern Test, Synonym Index, DQ Repository, Detail view). Hay 80 vistas registradas, 21
  de Talend.
- **Preferencias:** el comando esta activo. Las paginas se leen de las clases del bundle:
  Designer (apariencia, colores, fuentes, contexto, documentacion, import/export, favoritos),
  RunProcess (Log4j, shells bat/ps1/sh), servidores remotos (SSL incluido), Git y Core
  (i18n, formatos de componentes).

## 73. Dialogos, asistentes y errores por flujo

**Leido de los bundles** (`org.talend.*`): los nombres de clase dicen para que sirve cada
dialogo, pero **no se abrio ninguno**. La columna del bridge dice que puede hacer el bridge hoy.

| Flujo | Dialogos y asistentes (clase) | Bridge |
|---|---|---|
| Error de job o de generacion | `designer.core.ErrorMessageDialog`, `runprocess.ErrorDetailDialog`, `core.ui.StudioEventDetailsDialog`, vista `StudioLogView`, vista Problems | Sin ruta. El MessageBox nativo de generacion lo cierra el guardian con Enter |
| Ejecucion | Vista Run (`ProcessView`), `ProcessDebugDialog`, `LineageTestingConfigDialog`, `PromptDialog`, `FindDialog`, `JavaCompatibilityDialog` | `/launch/*` y `/automation/run-active-job` |
| Publicar en Talend Cloud | `publish.cloud`: `PublishWizard`, `PublishWizardPage`, `EnvironmentInfoDialog`, `PublishWarningMessageDialog`; vista Cloud Artifact | Sin ruta |
| Deploy a servidor remoto | `runprocess.remote`: `DeployJobWizard`; preferencias de servidores y SSL | Sin ruta |
| Instalar features | `studiolite.p2.featmanage.ui`: `FeatManageUIInstallWizard`, `FeatManageProvisioningWizardDialog`, `AcceptLicensesWizardPage`, `P2LoginDialog`, `ShowRequiredFeatureDialog`, `MergeFeaturesDialog`; `studiolite.p2.api`: `JreRequirementDialog`, `Java17RequirementDialog` | Sin ruta. El comando esta activo, pero `allowCommands` solo permite los de guardar |
| Modulos de terceros | `core.ui.ModuleListDialog`; el dialogo "third party modules" | `/workbench/modules/install` pulsa "Download and install all modules available" |
| Editar el job | `designer.core`: `ComponentChooseDialog`, `ChooseJobletDialog`, `ConfigureConnParamDialog`, `ConnectionTableAndSchemaNameDialog`, `FilterColumnDialog`, `ContextParameterWizard`, `DependenciesContextSelectionDialog`; `core.ui`: `MetadataDialog`, `SelectRepositoryContextDialog`, `ContextSetConfigurationDialog`, `ObjectSelectionDialog` | Si, sin dialogos: `/automation/nodes/*`, `/automation/job/contexts/*`, `/automation/repository/*` |
| Git | `repository.gitprovider.ui`: `GitCommitWizard`, `CheckoutBranchDialog`, `PullAndMergeDialog`, `PushResultDialog`, `GitCredentialDialog`, `UpdateProjectWizard`, `DetectConflictsDialog`; `gitmerge.ui`: `TalendStagingView`, `GitConflictsTreeView` | Sin ruta |
| Importar y exportar | `items.importexport.ui`: `ImportItemsWizard`, `ShowErrorsDuringImportItemsDialog`; DQ: `ExportForExchangeWizard` | Sin ruta |
| Tests | `testcontainer.core.ui`: `NewTestContainerWizard`, `EditTestCasePropertiesWizard` | Sin ruta |
| Workspace | `core.ui`: `ChooseWorkspaceDialog`, `CapabilityCheckDialog` | Sin ruta |
| Jobname Error, Save Resource | Dialogos de Talend, sin clase propia en el inventario | `ModalGuard`, ver seccion 74 |

## 74. Modales que el guardian cierra solo

`ModalGuard` (`workbench/ModalGuard.java`) revisa los shells visibles cada 1,2 s y pulsa el boton
de cada dialogo conocido. Los titulos y botones vienen de `KNOWN_DIALOGS`.

| Dialogo (titulo contiene) | Boton que pulsa |
|---|---|
| `Jobname Error` / `Job Name Error` | **Yes**: reemplaza el job existente |
| `Invalid Job Name` | OK, Yes |
| `Save Resource` / `Guardar recursos` | **Yes** / Guardar |
| `third party modules` / `modulos de terceros` | Cerrar. No instala nada |
| Progreso (`progress`, `compilando`, `cargando`...) | No lo toca; lo cancela si lleva mas de 30 s abierto |
| Cualquier otro con un boton seguro | El primero de: Yes, Si, OK, Accept, Continue, Save, Close... |
| Diálogo nativo de Windows (`MessageBox`) | Enter, tras 3 intentos seguidos con la UI ocupada |

**Riesgos de este comportamiento** (decision del autor del plugin; no se cambio):

- `Jobname Error` responde **Yes**, asi que reemplaza el job existente sin preguntar.
- `Save Resource` responde **Yes**: guarda los cambios pendientes de ese dialogo, incluidos los
  de un job que el agente no toco. Con un job sucio abierto, lo guarda.
- El boton de un dialogo desconocido sale de `SAFE_BUTTONS`, que incluye **OK**. Deducido del
  codigo, **no probado**: un dialogo de Preferencias, que tiene OK, se cerraria pulsando OK.
- Enter en un dialogo nativo es a ciegas: no se sabe que boton es el predeterminado.

`talend_studio_dismiss_dialogs` (`/workbench/dialogs`) ejecuta esta misma logica bajo demanda. **No
es de solo lectura**: su descripcion lo dice ahora.

## 75. Como inspeccionar la interfaz sin tocarla

- **Lo que ya esta en pantalla:** `talend_studio_ui_inventory`. Corre dos sondas (ver abajo) y
  devuelve menus, pestanas, paneles, tooltips de barras, arboles, shells visibles, perspectivas,
  vistas y dialogos por bundle.
- **Lo que no se puede ver sin abrirlo:** el contenido de los dialogos del cuadro de la seccion
  73. Abrirlos puede tener efectos (Publicar y Feature Manager conectan a red), asi que se
  documentan por su clase y no por su contenido.

Las sondas (`src/talend/studio/tools-job-operations/studio-ui-inventory-probes.ts`):

- `TalendUiWidgetProbe` corre en el hilo de la UI (`uiThread: true`) y solo lee widgets.
- `TalendUiRegistryProbe` corre fuera del hilo de la UI: recorrer los 282 bundles es lento y
  bloquearia Studio.

La prueba `tests/talend/studio-ui-inventory.test.ts` comprueba que ninguna sonda llame a
`notifyListeners`, `doClick`, `pressButton`, `setSelection`, `.close()`, `.save(`, `execute(` ni
similares. Si anades una sonda, mantenla con ese criterio.

## 76. Lo que no se pudo ver

- Las secciones laterales de *Trabajo* y de *Component* (los `ListElement` no exponen texto).
- *Cloud Artifact* y *Modules*: no se crean hasta abrirlas.
- Los menus *View* y *Ventana*: se rellenan al abrirse.
- El contenido de cualquier dialogo de la seccion 73.
- La paleta GEF de la pestana Designer (es un lienzo, no widgets SWT).

## 77. Control de dialogos desde el flujo

**Verificado en vivo** en Studio 8.0.1, con un dialogo de prueba que no hace nada al pulsarse.

Antes de actuar, el flujo comprueba si Studio tiene un dialogo abierto:

| Tool | Que hace antes de actuar |
|---|---|
| `talend_job_run_by_name` (sin `dryRun`) | Si hay un dialogo modal que no es progreso, para con `STUDIO_DIALOG_OPEN` antes de lanzar |
| `talend_job_compile` | Lo mismo, antes de generar el codigo |
| `talend_studio_install_modules` | Lee que modulos lista el dialogo antes de pulsar. Si no hay ninguno, `NO_MODULES_DIALOG` |
| `talend_studio_ui_dialogs` | Lista los dialogos y marca cuales bloquean. Solo lectura |

La comprobacion usa `GET /workbench/dialogs/list` (`DialogListService`). Lee widgets en el hilo de la
UI y no compila nada: responde en 20 a 70 ms. Antes se hacia con `run-code`, que tardaba unos 7 s
por llamada aunque el codigo no hiciera nada: cada `run-code` compila el codigo y arma el classpath.
Con un plugin anterior que no tiene el endpoint, la comprobacion vuelve a `run-code` sola.

### Automatico con `installMissing:true`

Si lo unico que bloquea es el dialogo de modulos de terceros, `talend_job_run_by_name` (y
`talend_job_compile`) pulsa "Download and install all modules available", espera a que Studio quede
libre (hasta 120 s) y continua. Cualquier otro dialogo se devuelve tal cual, sin tocarlo. La respuesta
indica `autoInstalledModules`.

Verificado con un dialogo imitado: titulo "Third party modules", un boton de descarga sin efecto y un
"Cerrar" que cierra la ventana. `run_by_name` espero 30,4 s, a que el guardian cerrara el dialogo, y
continuo hasta el lanzamiento. Ese lanzamiento fallo con `LAUNCH_NOT_FOUND` porque la configuracion no
existia, asi que no se ejecuto ningun job. No se descargo nada.

### Lo que no se resuelve sin preguntar

- **Fallo cerrado.** Si la comprobacion no puede hacerse, `run_by_name` y `compile` no actuan: devuelven
  `STUDIO_DIALOG_CHECK_FAILED`. Solo `ignoreDialogs: true` lo salta, a sabiendas. Antes seguian en
  silencio: en una prueba, `run_by_name` lanzo con la comprobacion caida, porque el bridge no respondio.
- **Dependencias Maven.** `compile` con `installMissing` descarga las coordenadas `Missing artifact g:a:v`
  de Maven Central y vuelve a compilar. El `tMap` no se resuelve asi: `talend-tmap-dataset` no esta en
  Maven Central (seccion 25 de INTERNALS 05). Para ese caso sirve el dialogo de modulos de Studio.
- **Ventana del guardian.** El dialogo de modulos se cierra a los 30 s si nadie lo atiende. Por eso el
  flujo responde `STUDIO_DIALOG_OPEN` con la accion a tomar, y con `installMissing` lo atiende en el
  mismo paso.

### Trampas

- Un dialogo de prueba tiene que cerrarse de verdad al pulsar un boton. Si su boton no tiene listener,
  el guardian lo "pulsa" sin efecto y el dialogo se queda abierto: la prueba parece un fallo del flujo.
- `run-code` no sirve para comprobaciones frecuentes: el coste base son ~7 s aunque el codigo sea trivial.

## 78. Dependencias que faltan: deteccion

`findMissingArtifacts` (`missing-artifacts.ts`) lee el texto de la compilacion. Reconoce dos formas:
`Missing artifact g:a:jar:v` (con coordenada) y `...jar inexistente` (solo el nombre del jar). Un jar sin
groupId se senala, pero no se descarga: no hay coordenada que pedir a Maven Central.

Cubierto por tests del parser y de la orquestacion (`compileWithDependencies`) con un bridge falso. No
se probo en vivo con un job que tenga una dependencia faltante, porque no hay un job de prueba sin efectos
externos que la necesite.

## 79. Latencia del harness L5 y fallos que parecian "sin salida"

Medido con `L5_TIEMPOS=1` (`scripts/l5/tiempos.ts`) en un caso de cuatro nodos (`replicar filas`):

- Crear el job: 1,2-1,6 s. Es Studio abriendo el editor; no es el numero de llamadas.
- Abrir el job: 0,25-0,65 s. Espera a que el editor termine de abrirse. Quitar la llamada no ahorra
  nada: el mismo tiempo pasa a la primera adicion de nodo.
- Nodos y conexiones: ~0,3 s en total (25-46 ms por llamada). Agrupar llamadas en una sola peticion
  quitaria solo esos milisegundos.
- Run de Studio: 2,0-4,9 s. Incluye el build de Maven y el JVM del job. En los registros de lanzamiento
  el Run mas rapido termina en ~2,5-3,4 s; el reparto build/JVM es una estimacion, no una medida separada.
- `executeJob`: ~1,4 s. Es la JVM del job; devuelve `stdout`, `stderr` y `exitCode`.
- Borrar el job al final: ~0,3 s.

Total tipico: 8-9 s, con variacion de 8 a 13 s segun el estado de Studio. La ultima medida de cuatro casos
distintos dio 10,5-11,8 s; la sesion de Studio llevaba muchos Runs seguidos. No se ha comprobado la causa.

Causas de los fallos y de la espera, en orden de impacto:

1. tMap "salida con codigo 1, sin salida": el `LINK_STYLE` queda vacio (el XML del componente tiene
   `ITEMS DEFAULT=""`). Cada Run abria el dialogo "Error found" y el guardian lo cerraba con Continue,
   asi que el job corria con el tMap mal configurado. Se pone `AUTO` al crear el nodo
   (`fixMapLinkStyle`).
2. `exitCodeOf` esperaba 10 s por un `IProcess` que este tipo de lanzamiento nunca registra: medido, un Run
   de un job de ~3 s quedaba en 13 s. Ahora sin procesos devuelve `null` al momento.
   Los Runs que quedaban en `started` 120 y 157 s: solo se ha demostrado una causa (el punto 3). Para los
   otros no se sabe por que el observador no vio el fin del job. Se sospecho del primer `java` hijo de
   Studio, pero no esta comprobado; el cambio a `elegirJob` (WMI) es una defensa, no un arreglo verificado.
3. Job con configuracion erronea: Studio lanza `ProcessorException: has wrong configuration` antes de
   arrancar el JVM, y el observador esperaba 120 s. El chequeo de diseno previo al Run lo corta en ~5 s
   con el error real (`tConvertType`: "Type mismatch").
4. Segun el codigo, el Run de compilacion (`compilarEnStudio`, `runActiveJob` con `dryRun: false`) lanzaba el
   job otra vez, y el `executeJob` lo relanzaba de nuevo. Ya no se lanza el Run de compilacion cuando el Run
   anterior dejo el `classpath.jar`. No se ha medido cuantas veces se ejecutaba el job antes del cambio.
5. `executeJob` descartaba el `stderr`, asi que la causa de un job que fallaba se veia como "sin salida".
   Ahora se pasa a la interpretacion.

Actualizacion (seccion 80): los errores "must have at least one value" eran falsos positivos de la vista
Problemas, leida antes de que Studio actualizara sus marcas. Ver la seccion 80.

Pendiente, sin resolver:

- `tConvertType`: "Type mismatch: cannot convert from String to double" en el `tFixedFlowInput`. Hipotesis: el
  schema de salida (`id_Integer`/`id_Double`) se propaga al origen al conectar. Sin probar.
- Un caso observado sin explicar: el Run devolvio en 2,0 s y la ejecucion tardo 8,3 s. Esto sugiere que
  `executeJob` reintento porque el build no habia terminado (su bucle espera 5 s por intento al ver
  "no esta compilado"). No se ha confirmado, y ya no aplica: el harness ya no usa el Run.

## 80. Construir sin ejecutar: `/automation/job/build`

Lo que se descubrio al quitar el Run de la construccion del harness:

- **El falso positivo de Problemas.** Los errores "must have at least one value" (`tRowGenerator`,
  `tUniqRow`, `tSetGlobalVar`) salian de `talend_job_problems` leido justo despues del montaje. Studio
  actualiza esas marcas de forma asincrona: pasado un rato, o tras generar el codigo, el mismo job esta
  limpio. Comprobado: `tSetGlobalVar` ejecutado con `executeJob` imprime `Talend` con codigo 0, y
  `tUniqRow` imprime sus 3 filas. Por eso el chequeo de diseno se hace ahora despues de construir.
- **Como se construye sin Run.** `ProcessorUtilities.generateCode` en la sobrecarga de siete argumentos
  (`process, context, false, false, true, opciones, monitor`) con `GENERATE_MAIN_ONLY | GENERATE_WITHOUT_COMPILING`
  (2 | 32) genera el codigo sin lanzar build. Sin esa opcion, el quinto argumento (`true`) hace que Talend lance
  un build de Maven para la informacion de build (`generateBuildInfo`): 7-10 s por job. Se comprobo con un
  volcado de hilos de Studio, donde el hilo de UI esperaba en `MavenCommandLauncher`. El job principal se
  compila despues con `javac` (`ToolProvider`) a `target/classes`, con sus recursos copiados. Un auxiliar
  (tRunJob) si se construye con Maven (`buildModules`): su padre lo resuelve desde el `.m2`. El endpoint
  `POST /automation/job/build` devuelve `compiles`, `built`, `error` (linea y mensaje), `metodo` y los tiempos.
- **El `target/classpath.jar` no lo escribe el build.** Tras `buildModules` sale `target/classes` pero no el
  jar, y `executeJob` falla con "no existe target/classpath.jar". Es un jar sin clases cuyo MANIFEST tiene
  `Class-Path` con `target/classes/`, `src/main/ext-resources/`, las rutinas del proyecto y las librerias.
  Studio calcula la lista en `initJobClasspath` (campos `windowsClasspath`/`unixClasspath`), pero en modo
  relativo (`../lib/X.jar`). El Run escribe rutas absolutas, asi que `JobBuilder` fuerza
  `useRelativeClasspath=false` y resuelve cada `X.jar` contra el `.m2` de Studio por nombre (exacto o
  `X-<version>.jar`), excluyendo `-sources` y `-javadoc`. Sin `system-routines` la JVM falla con
  `NoClassDefFoundError: routines/system/api/TalendJob`.
- **Limite conocido.** El jar se escribe con las librerias que Studio calcula, resueltas por nombre contra
  el `.m2`. Un job con una libreria sin version en el `.m2` no la encontrara y fallara en ejecucion con
  `NoClassDefFoundError`. Comprobado con los jobs de la suite que usa el harness, no con todos los componentes.
- **Medido.** Caso de cuatro nodos (`quitar duplicados`, 5,6 s): montaje 2,4 s (crear 1,1, abrir 0,2),
  `construir` 1,2 s (generar 0,22, classpath 0,38, javac 0,55), `executeJob` 0,7 s, borrado 1,3 s. Antes, con el
  build de Maven dentro de la generacion, `construir` tardaba 8-9 s. La suite de transformaciones (16 casos, en
  secuencia) paso 14 de 15 en 138 s.
- **Solapar casos no funciona.** Se probo montar el caso N+1 mientras se ejecuta el N. Un borrado concurrente con el
  build del siguiente dejo el workspace con un proyecto (el hijo de un tRunJob) registrado sin carpeta, y toda la
  suite fallo (0 de 15). Se revirtio: el bucle es secuencial.
- **Los auxiliares no se borran al terminar.** El pom del padre referencia al hijo. Borrarlo deja el proyecto
  de Eclipse sin carpeta: el log muestra `Failed to retrieve children ... no existe`, y el build de cualquier job
  falla con `El recurso .../pom.xml no existe`. Ahora la limpieza borra solo el job principal; el auxiliar se
  reemplaza en el siguiente montaje (`createJob` con `replace`). El caso de tRunJob pasa en ~30 s (volumen).
- **Las dependencias de un padre no estan en el campo de classpath.** El jar del hijo viene en el pom del padre
  (`groupId=org.example.prj_bancolombia.job`). Se resuelve en el `.m2` por coordenada (`dependenciasDelPom`).
- **`tConvertType` (resuelto, seccion 81).** El error `String cannot be converted to int` en el `row1Struct`
  venia de que, al conectar, el esquema del destino se propaga hacia atras al origen. El origen (un
  `tFixedFlowInput` con filas) necesita `schemaDespuesDeConectar`, que vuelve a poner su esquema tras conectar.

## 81. Vistas abiertas y tiempo por job

Con el build sin Maven (seccion 80), el tiempo que quedaba en cada caso estaba en la UI de Studio. Se midio
con volcados de hilos de la JVM de Studio (`jstack` sobre el hilo `main`), varias veces por operacion.

- **La vista de Job Settings cuesta ~1,5 s por borrado de job.** Al borrar, Studio cambia la seleccion y
  `JobSettingsView.selectionChanged` reconstruye las pestanas, incluido el editor Markdown de la documentacion
  del job (`MarkdownEditorComposite`). Con la vista oculta el borrado baja de 1,5-1,8 s a 0,35 s. El bridge
  tenia `show-view` pero no ocultar: se anadio `POST /workbench/hide-view` (`WorkbenchService.hideView`).
  El harness la oculta al empezar y la vuelve a mostrar al terminar, solo si estaba abierta (con
  `L5_VISTAS=conservar` no toca el IDE).
- **Crear un job cuesta ~1 s, y no se puede evitar sin cambiar el modelo.** Cada job abre su editor, y el editor
  construye la paleta de componentes (`TalendEditorPaletteFactory.createPalette`). Reutilizar un editor entre
  casos exigiria cambiar de job sin cerrar el editor: no se ha intentado.
- **Un caso de cuatro nodos ahora tarda 3,6-5,2 s.** Creacion ~1,0-1,6 s, apertura 0,3 s, nodos 0,3 s, construir
  0,7 s, ejecucion 0,7 s, borrado 0,35 s.
- **`tConvertType` pasa.** El origen del fixture necesita `schemaDespuesDeConectar`: al conectar, Studio propaga
  el esquema del destino (`Integer`) hacia atras al origen, y sin el paso de reponerlo el origen compila mal.

- **Modo rapido por defecto, y en Studio solo si se pide.** `executeJob` lanza el job en su propia JVM: es
  rapido, pero no aparece en la consola de Run de Studio. Con `--en-studio` (o `L5_EN_STUDIO=1`) el arnes lo
  lanza con el Run de Studio, que si se ve. Si el escenario comprueba lineas de salida, el job corre otra vez
  con `executeJob` para leerlas (el Run no devuelve la salida); sin lineas, se juzga por sus efectos (BD, fichero).
- **Los avisos no se veian.** `resumir` mostraba los 3 primeros de cada caso y recortaba a 160 caracteres. Ahora
  el resultado lleva la lista completa (`Resultado.avisos`), el CSV la escribe entera en `detalle`, y la corrida
  termina con un resumen agrupado por tipo (nodo quitado del texto, `[WARN]` de la salida en su grupo).
- **Avisos tolerados con motivo.** `should have outputs linked` en un nodo que solo lee para sus disparadores
  (`NB_LINE`) es lo esperado: se declara en `avisos_tolerados` con el texto exacto del nodo, no con un
  fragmento generico (conciliacion x2, tAssert x2, tParallelize).
- **AWS fallaba por la JVM, no por el job.** En Java 21 el SDK de AWS v2 da `InaccessibleObjectException`
  (`MethodHandles$Lookup`) si la JVM no lleva `--add-opens java.base/java.lang=ALL-UNNAMED` y
  `java.base/java.lang.invoke=ALL-UNNAMED`. `JobExecutor` los anade. DynamoDB pasaba en el Run de Studio y
  fallaba en `executeJob`; a mano, con los flags, sale con codigo 0.
- **Dos casos AWS dependian del orden.** Borrar un bucket o una cola que crea otro caso falla (404/400) si se
  ejecuta solo. Ahora cada uno crea lo que borra, con el nodo de creacion unido por `SUBJOB_OK`.
- **Intento fallido: `dbms` en el schema.** Poner `MetadataTable.setDbms("PostgreSQL" | "MYSQL_8")` para quitar
  el aviso `the schema's dbType not correct` hace que Studio valide los tipos con un `MappingTypeRetriever` que
  es `null`, y el job deja de compilar. Se revirtio: el aviso sigue, ahora visible en el resumen.
- **Pendiente.** `A value must be set for Date Pattern` (tAssertCatcher, tLogRow) no se quita con el patron por
  defecto de las columnas `id_Date` de nuestro schema: esas columnas las crea el propio catcher. `cargar archivo
  a S3` recibe `Status Code: 100` del emulador local. `leer atributos de cola SQS` falla con
  `NumberFormatException` en un atributo con decimales.

### Memoria: Studio retiene cada editor de job abierto

- **Sintoma.** La corrida completa de L5 se para en el 80 % de memoria. La recoleccion (`/automation/memory` con
  `gc`) baja poco: tras 15 casos la memoria sube de 411 a 635 MB y no se libera.
- **Medido con `jcmd <pid> GC.class_histogram`.** Hay un `MultiPageTalendEditor`, un `TalendEditor` y un
  `Process` vivos por cada editor abierto desde el arranque (186 tras 186 editores), aunque el editor este
  cerrado. Cada editor deja ~1 270 figuras de la paleta de GEF (`DetailedLabelFigure`, `TextFlow`,
  `FlowPage`): ~13 MB por caso. Con tantas figuras, el hilo de UI tambien tarda mas en repintar.
- **Descartado.** El bridge no guarda editores (sus colecciones estaticas son de datos). Ocultar la vista de
  paleta no cambia lo que se acumula (+19 108 figuras por suite con la vista visible y oculta). La lista
  estatica `ProcessorUtilities.openedEditors` tiene 2 entradas; `lastGeneratedWithStatsOrTrace` tiene una
  entrada por job pero sus claves son `String`, y vaciarla no libera ningun editor.
- **No se encontro la raiz.** No hay analizador de volcados en el JDK de Studio, y barrer por reflexion los
  campos estaticos de los bundles de Talend tarda mas que la peticion de `run-code` (que sigue ejecutandose
  en Studio aunque el cliente se rinda: satura los hilos del bridge y deja la UI lenta).
- **Salida practica: reiniciar Studio sin hacerlo a mano.** `scripts/l5/studio-reiniciar.ts` cierra Studio con
  `CloseMainWindow` (no fuerza nada), lo vuelve a abrir, espera al bridge y reinstala el plugin. Hace falta
  reinstalarlo porque un Studio recien arrancado carga el plugin instalado, no las publicaciones en caliente
  anteriores. `execution-check --reiniciar-studio` (o `L5_REINICIAR=1`) lo usa solo al llegar al limite de
  memoria. Sin la opcion, la corrida se para y pide reiniciarlo a mano. Una corrida desde un Studio
  recien arrancado cabe entera (108 escenarios, ~13 MB cada uno, tope del 80 % de 4 GB).

## 82. Construir muchos jobs sin editor: `/automation/job/build-batch`

Para migraciones masivas el coste de abrir un editor por job (paleta GEF, ~1 s y ~13 MB que no se liberan) no
es asumible. `JobBuilder.buildBatch` genera desde el `ProcessItem` del repositorio, sin editor:

- Items: `ProxyRepositoryFactory.getInstance().getAll(ERepositoryObjectType.PROCESS)`.
- Codigo: `ProcessorUtilities.generateCode(ProcessItem, String, String, Map, IProgressMonitor[])` con
  `{"GENERATE_OPTION":34}` (main only + sin compilar) y un `NullProgressMonitor`. ~0,2 s/job, en serie.
- Compilacion: `javac` + `target/classpath.jar` en un pool de hilos (`parallelism`).
- Cliente: `jobBuildBatch({jobs, parallelism})`.

El generador por ficheros (`buildJobItemXml`/`buildJobPropertiesXml`) escribe items sin Studio: 20 000 jobs en
2,4 s. Tras escribirlos en `process/`, `POST /workspace/refresh` (cuerpo `{}`) hace que Studio los vea.

Un item escrito por fichero no trae en su lista las rutinas del sistema ni `jboss-marshalling` (las clases de fila
generadas lo usan en `readData`/`writeData`), asi que `classpathDelJob` las anade siempre desde el `.m2`.

Medido con 200 jobs minimos: serie 382 ms/job, 4 hilos 190 ms/job, 8 hilos 191 ms/job (el techo es la
generacion en serie). 200/200 compilan. Orden de magnitud: 100 000 jobs ~ 5 h en una maquina.

## 82. Construir muchos jobs sin editor: `/automation/job/build-batch`

Para migraciones masivas, abrir un editor por job (paleta GEF, ~1 s y ~13 MB que no se liberan) no es asumible.
`JobBuilder.buildBatch` genera desde el `ProcessItem` del repositorio, sin editor:

- Items: `ProxyRepositoryFactory.getInstance().getAll(ERepositoryObjectType.PROCESS)`.
- Codigo: `ProcessorUtilities.generateCode(ProcessItem, String, String, Map, IProgressMonitor[])` con
  `{"GENERATE_OPTION":34}` (solo main, sin compilar) y un `NullProgressMonitor`. ~0,2 s/job, en serie.
- Compilacion: `javac` y `target/classpath.jar` en un pool de hilos (`parallelism`).
- Cliente: `jobBuildBatch({jobs, parallelism})`.

El generador por ficheros (`buildJobItemXml`/`buildJobPropertiesXml`) escribe items sin Studio: 20 000 jobs en
2,4 s. Tras escribirlos en `process/`, `POST /workspace/refresh` (con cuerpo `{}`) hace que Studio los vea.

Un item escrito por fichero no trae en su lista las rutinas del sistema ni `jboss-marshalling` (las clases de fila
generadas lo usan en `readData`/`writeData`), asi que `classpathDelJob` las anade siempre desde el `.m2`.

Medido con 200 jobs minimos: serie 382 ms/job, 4 hilos 190 ms/job, 8 hilos 191 ms/job (el techo es la
generacion en serie). 200/200 compilan. Orden de magnitud: 100 000 jobs, unas 5 h en esta maquina.

## Relacionado

- Guardian de modales y el riesgo de `Save Resource`: [seccion 13](02-operar-el-job.md#13-el-guardian-de-modales).
- Por que la espera de un job no era fiable en Windows: [seccion 14](02-operar-el-job.md#14-el-fin-de-la-ejecucion-de-un-job).
