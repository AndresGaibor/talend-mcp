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

## Relacionado

- Guardian de modales y el riesgo de `Save Resource`: [seccion 13](02-operar-el-job.md#13-el-guardian-de-modales).
- Por que la espera de un job no era fiable en Windows: [seccion 14](02-operar-el-job.md#14-el-fin-de-la-ejecucion-de-un-job).
