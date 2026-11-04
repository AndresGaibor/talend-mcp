# Solución de problemas con Studio

Casos que ya ocurrieron y cómo se reconocen. Antes de nada, ejecuta `talend_diagnose_environment`
(o `bun run doctor`): con Studio abierto y el bridge caído, lee el log de Studio y propone el siguiente paso.

## El bridge no responde pero Studio está abierto

El bridge arranca con el workbench, **después del login**. Si `http://127.0.0.1:3930/ping` no contesta y la
ventana de Studio dice "Talend Cloud Data Fabric", Studio sigue en la pantalla de login. No es un fallo del MCP.

`talend_studio_restart` lo distingue: si tras reabrir Studio el bridge no aparece, devuelve
`STUDIO_WAITING_LOGIN` (Studio abierto, esperando el login) o `STUDIO_EXITED` (el proceso desapareció).

## Studio vuelve al login después de "cargando conexión"

Síntomas en `workspace/.metadata/.log`:

- `Refresh token failed.` precedido de `Bad Request` o de `401:Authentication credentials were missing or incorrect.`
- `logged on <proyecto>` justo antes, y de nuevo la pantalla de login.

Causa más probable: el token SSO guardado en `configuration/connection_user.properties` ya no se puede renovar.
Aunque te reautentiques, Studio sigue usando el guardado.

1. Cierra Studio.
2. Copia `configuration/connection_user.properties` a otra carpeta y quita el original de `configuration/`.
3. Abre Studio y crea de nuevo la conexión a Talend Cloud (región y login SSO).

Los proyectos y el git no se tocan. Para deshacerlo, devuelve el archivo copiado.

Si tras esto el refresco sigue fallando, el rechazo viene de la cuenta o del tenant de Talend Cloud: hay que
revisarlo con quien lo administre.

## `ConcurrentModificationException` al iniciar sesión

Aparece en el diálogo de login como `PersistenceException` con `DynaEnum.values` y `FolderHelper.createFolder`
en la traza. Es una carrera interna de Talend: otro hilo modifica la lista de tipos de repositorio mientras el
login la recorre. Studio no la deja en su log.

1. Reintenta el login.
2. Si se repite, abre Studio con `-clean` (reconstruye la caché de OSGi, no toca proyectos).
3. Si sigue, haz copia de `workspace/.metadata/.plugins/org.eclipse.core.resources` y aparta `*.snap` y
   `.root/.markers.snap`. Deja `15.tree` (o el `.tree` que haya): ahí están registrados los proyectos.

## `The workspace exited with unsaved changes in the previous session`

Studio se cerró de golpe (caída o cierre forzado). `talend_studio_restart` cierra con `CloseMainWindow` y solo
termina el proceso pasados 120 s; el resultado indica `forced: true` cuando lo hizo. Cierra Studio con normalidad
siempre que puedas.

## Snapshots en el repositorio del equipo

Los snapshots viven en `<proyecto>/.talend-mcp-snapshots/`. Al crear uno, el MCP añade esa carpeta a
`.git/info/exclude` del repositorio que contiene el proyecto, para que no aparezca como archivo sin versionar.
Es una exclusión local: no cambia el `.gitignore` del equipo.
