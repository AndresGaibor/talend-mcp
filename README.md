<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/media/logo-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="docs/media/logo-light.svg">
  <img alt="Talend MCP" src="docs/media/logo-light.svg" width="360">
</picture>

**Deja que tu asistente de IA cree, edite, compile y verifique jobs de Qlik Talend Studio.**

[![CI](https://github.com/AndresGaibor/talend-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/AndresGaibor/talend-mcp/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/AndresGaibor/talend-mcp?color=4cc38a)](https://github.com/AndresGaibor/talend-mcp/releases/latest)
[![Licencia MIT](https://img.shields.io/badge/licencia-MIT-green)](LICENSE)
![Talend Studio](https://img.shields.io/badge/Talend%20Studio-8.0.1-blue)
![Windows · Linux · macOS](https://img.shields.io/badge/plataformas-Windows%20·%20Linux%20·%20macOS-lightgrey)

[Instalar](#instalación) · [Desinstalar](#desinstalar-o-desactivar) · [Qué puedes pedirle](#qué-puedes-pedirle) · [Cómo funciona](#cómo-funciona) · [Seguridad](#seguridad) · [Documentación](#documentación)

<br>

<img src="docs/media/demo-chat.gif" alt="Demostración: se pide en lenguaje natural filtrar un Excel y el asistente monta, compila y ejecuta el job en Talend Studio" width="720">

</div>

<br>

**Talend MCP** es un servidor [MCP](https://modelcontextprotocol.io/) local que conecta un asistente
(Claude, GitHub Copilot, Cursor, Codex, Gemini) con tus proyectos de Talend Studio. El asistente lee el
proyecto, crea y modifica jobs, los compila, los ejecuta y revisa el resultado. Todo corre en tu equipo:
tus proyectos no salen de él.

## Instalación

Un solo comando descarga el binario, comprueba su checksum, **configura los clientes MCP detectados** e
intenta instalar el Bridge de Talend Studio desde el release verificado. No hace falta clonar el repositorio
ni instalar Bun.

**Windows (PowerShell)**

```powershell
irm https://github.com/AndresGaibor/talend-mcp/releases/latest/download/install.ps1 | iex
```

**Linux y macOS**

```bash
curl -fsSL https://github.com/AndresGaibor/talend-mcp/releases/latest/download/install.sh | sh
```

Reinicia tu cliente y pídele:

> Ejecuta `talend_guide` con `mode: overview`.

Si responde con el mapa de tareas, está listo. Para **actualizar**, vuelve a ejecutar el instalador.
El instalador confirma qué clientes configuró y te recuerda reiniciarlos. Si no detecta ninguno, deja el
binario instalado y muestra cómo registrar un cliente manualmente. Si Studio está abierto sin el Bridge,
cierra Studio y vuelve a ejecutar el mismo comando para completar la instalación.

<details>
<summary><b>Clientes que configura</b> y cómo controlarlo</summary>

<br>

| Cliente | `--client` | Verificación |
|---|---|---|
| Claude Code | `claude-code` | Probado con el cliente real |
| Claude Desktop | `claude-desktop` | Formato según su documentación |
| GitHub Copilot en VS Code | `vscode` | Formato según su documentación |
| GitHub Copilot CLI | `copilot` | Formato según su documentación |
| Cursor | `cursor` | Formato según su documentación |
| Codex CLI | `codex` | Formato según su documentación |
| Gemini CLI | `gemini` | Formato según su documentación |

```bash
talend-mcp setup --dry-run                      # ver qué haría, sin escribir nada
talend-mcp setup --client cursor,vscode         # solo algunos clientes
talend-mcp setup --project "C:/ruta/al/proyecto" # fijar el proyecto de Talend
talend-mcp remove                               # desactivar en los clientes
```

`setup` solo añade la entrada `talend-mcp`: no toca tus otros servidores, guarda una copia
`<archivo>.bak-talend-mcp` y deja intacto cualquier archivo que no sea JSON válido. Para configurarlo a
mano, o si algo falla, mira [Instalación por cliente](docs/INSTALACION-CLIENTES.md), que detalla qué se
ha probado y las particularidades de cada cliente.

Para **desactivar** Talend sin borrar nada, usa `talend-mcp remove`; para borrarlo todo, el comando de
[Desinstalar](#desinstalar-o-desactivar).

</details>

<details>
<summary><b>Plugin de Claude Code</b> (skill + servidor)</summary>

<br>

Con el binario instalado, el plugin añade la skill que enseña al asistente el flujo correcto y registra
el servidor:

```
/plugin install talend-mcp --marketplace AndresGaibor/talend-mcp
```

</details>

<details>
<summary><b>Trabajo en vivo con Studio</b>: plugin Java</summary>

<br>

El Bridge permite trabajar con jobs **abiertos** en Studio y el instalador principal intenta dejarlo
configurado automáticamente. Con Studio cerrado lo instala; con Studio abierto y el Bridge ya cargado lo
actualiza en caliente, sin reiniciar. Para reintentar manualmente:

```bash
talend-mcp bridge install --dry-run   # comprueba todo y explica qué haría, sin tocar Studio
talend-mcp bridge install
```

Con Studio **cerrado** instala el plugin; con Studio **abierto y el plugin ya cargado** lo actualiza en
caliente, sin reiniciar. Sin el plugin sigue funcionando el [modo offline](docs/MODO-OFFLINE.md) (lotes,
migraciones y jobs cerrados).

Si Studio no se detecta, define `TALEND_STUDIO_HOME` con la carpeta que contiene `plugins/` y
`features/`. `talend-mcp doctor` muestra el estado completo.

</details>

## Desinstalar o desactivar

Hay tres niveles: desactivar el servidor en los clientes, borrar lo local y quitar el plugin de Talend
Studio. Los dos primeros están automatizados; el plugin se quita aparte, porque vive dentro de Studio y no
en las carpetas de usuario.

**Desactivar sin borrar nada** (útil para probar, cambiar de cliente o dejar de usarlo un tiempo):

```bash
talend-mcp remove                  # quita talend-mcp de los clientes MCP detectados
talend-mcp remove --client cursor  # solo de un cliente
talend-mcp remove --dry-run        # muestra qué haría, sin escribir nada
```

El binario y el historial se conservan: puedes reactivarlo con `talend-mcp setup`.

Esto **no toca el plugin Bridge de Talend Studio**. El plugin sigue instalado y arranca con Studio,
escuchando en `127.0.0.1:3930`; sin un cliente MCP que lo llame queda inactivo. Su guardián de diálogos
está apagado por defecto (`autoDismissModals: false` en `~/.talend-bridge/config.json`) y, si se activa,
solo pulsa los diálogos conocidos. Dejarlo instalado no cierra ventanas de Studio.

**Desinstalar lo local** (entradas de los clientes, PATH, binario, historial, configuración y token del
Bridge):

**Windows (PowerShell)**

```powershell
irm https://github.com/AndresGaibor/talend-mcp/releases/latest/download/uninstall.ps1 | iex
```

**Linux y macOS**

```bash
curl -fsSL https://github.com/AndresGaibor/talend-mcp/releases/latest/download/uninstall.sh | sh
```

Pide confirmación antes de borrar y después indica qué queda pendiente. Para ejecutarlo sin preguntas,
define `TALEND_MCP_YES=1`; para conservar el historial, `TALEND_MCP_KEEP_STATE=1`. Borra `~/.talend-mcp`
y `~/.talend-bridge`, así que el Bridge de Studio se queda sin configuración ni token.

Ese borrado **tampoco quita el plugin**: si sigue instalado, al abrir Studio vuelve a crear
`~/.talend-bridge` con los valores por defecto (solo lectura) y un token nuevo. No queda desactivado por
haber borrado la carpeta.

**Quitar el plugin de Studio**, si ya no quieres el trabajo en vivo:

1. Abre Talend Studio.
2. Ve a **Help > About > Installation Details > Installed Software**.
3. Selecciona `com.andres.talend.bridge` y pulsa **Uninstall**.
4. Acepta y reinicia Studio.

El plugin forma parte de este repositorio
([github.com/AndresGaibor/talend-mcp](https://github.com/AndresGaibor/talend-mcp), código en
`talend-studio-bridge/`). Sin él, el MCP sigue funcionando en
[modo offline](docs/MODO-OFFLINE.md) para lotes, migraciones y jobs cerrados. Reinicia el cliente MCP al
terminar.

## Qué puedes pedirle

No hace falta memorizar herramientas: `talend_guide` indica al asistente la secuencia adecuada para cada
tarea. Ejemplos de peticiones:

> *«Lista los jobs del proyecto y dime cuáles usan `tMap`.»*
>
> *«Crea un job que lea `clientes.csv`, filtre `monto > 1000` y escriba `salida.csv`. Compílalo y verifícalo.»*
>
> *«Pasa estos 40 jobs del contexto PROD a QA, en lote, y comprueba que compilan.»*
>
> *«`CARGA_VENTAS` termina con código 0 pero algo falla. Revísalo.»*

| Capacidad | Para qué |
|---|---|
| **Explorar** | Leer jobs, componentes, conexiones, contextos y ejecuciones, sin abrir Studio. |
| **Crear y editar en vivo** | Añadir componentes, definir schemas, conectar y configurar en un Studio abierto. |
| **Trabajar en lote, sin Studio** | Crear y editar cientos de jobs de forma atómica. Pensado para migraciones. |
| **Verificar** | `talend_job_verify` encadena diseño, compilación y ejecución, y detecta `[WARN]`, `[ERROR]`, `[FATAL]` y excepciones **aunque el job termine con código 0**. |

## Cómo funciona

```mermaid
flowchart LR
    A["Cliente MCP<br/>(tu asistente)"] -- "stdio · MCP" --> B["talend-mcp<br/>servidor local"]
    B -- "lee y escribe" --> C[("Proyecto Talend<br/>process/*.item")]
    B -- "HTTP local" --> D["Plugin Java<br/>dentro de Studio"]
    D --> E["API interna<br/>de Studio"]
```

El trabajo sigue uno de dos caminos, según el caso:

| Trabajo | Camino |
|---|---|
| Migraciones, lotes y jobs cerrados | **Offline**: se escribe el job en disco, de forma atómica y sin Studio. |
| Jobs abiertos en un editor y componentes que Studio configura al conectar, como `tMap` | **En vivo**: a través del plugin de Studio. |

> [!NOTE]
> Nunca se edita en disco un job abierto en Studio: lo pisaría al guardar. Las herramientas offline lo
> detectan y lo rechazan.

El servidor expone más de doscientas herramientas (`talend_<área>_<verbo>`), pero por defecto solo
publica las del ciclo habitual de un job (preset `agent`). El resto se descubre bajo demanda con
`talend_search`. Detalle y garantías en [Modo offline](docs/MODO-OFFLINE.md).

## Seguridad

- **Local**: stdio o `127.0.0.1`. Escuchar fuera de loopback exige `TALEND_MCP_TOKEN`.
- **Cada herramienta tiene un riesgo** y el servidor lo aplica, no el asistente:

| Riesgo | Por defecto | Cómo cambiarlo |
|---|---|---|
| Leer | Permitido | — |
| Escribir | Permitido | `TALEND_MCP_ALLOW_WRITE=0` |
| Ejecutar jobs | Permitido, con `confirm: true` | `TALEND_MCP_ALLOW_EXECUTE=0` |
| Destructivo (borrar, restaurar) | **Bloqueado** | `TALEND_MCP_ALLOW_DESTRUCTIVE=1` y `confirm: true` |

- **Auditoría**: cada llamada queda en `.talend-mcp/audit.jsonl` (herramienta, riesgo, resultado y
  duración; nunca los argumentos).
- **Binarios verificados**: el instalador no instala si el SHA-256 no coincide con `checksums.txt`. Los
  binarios no están firmados.

Más en [SECURITY.md](SECURITY.md).

## Estado del proyecto

El soporte de componentes se mide por niveles, desde crear un nodo hasta ejecutar un job y comparar su
salida con el resultado esperado. Foto del 22/10/2026 en **Talend Studio 8.0.1**:

| Nivel | Resultado | Qué significa |
|---|---:|---|
| Componentes básicos | **877 de 897** | Se pueden crear y configurar. |
| Compilan | **418 de 498 probados** | Talend generó y compiló el job de prueba. |
| Ejecución verificada | **66 componentes, 63 escenarios** | Se ejecutó y se comparó la salida con lo esperado. |

Algunos componentes necesitan drivers o servicios externos que el entorno de pruebas no tiene, y uno sin
pruebas no está necesariamente fuera de soporte. Las pruebas con emuladores (S3, SQS) no sustituyen una
validación en AWS real. Detalle por familia en [Cobertura](docs/COBERTURA-POR-FAMILIA.md).

## Documentación

| Quieres... | Lee |
|---|---|
| Conectar un cliente a mano o resolver un fallo de instalación | [Instalación por cliente](docs/INSTALACION-CLIENTES.md) |
| Saber cómo trabajar con el MCP desde un asistente | [Guía para asistentes](docs/GUIA-AGENTE.md) |
| Migrar o editar muchos jobs sin Studio | [Modo offline](docs/MODO-OFFLINE.md) |
| Ajustar variables, reintentos idempotentes o ejecuciones asíncronas | [Configuración](docs/CONFIGURACION.md) |
| Usar la línea de comandos | [CLI](docs/CLI.md) |
| Ver todas las herramientas | [Catálogo de herramientas](docs/CATALOGO-DE-TOOLS.md) |
| Saber qué componentes están probados | [Cobertura](docs/COBERTURA-POR-FAMILIA.md) y [plan de pruebas](docs/PLAN-DE-PRUEBAS.md) |
| Resolver problemas con Studio o el bridge | [Solución de problemas](docs/SOLUCION-DE-PROBLEMAS.md) |
| Usarlo en Windows con WSL | [Windows y WSL](docs/windows-wsl.md) |
| Entender cómo está organizado | [Arquitectura](docs/ARQUITECTURA.md) |
| Conocer el rumbo | [Hoja de ruta](docs/ROADMAP-DOMINIO-TALEND.md) |

## Desarrollo

```bash
git clone https://github.com/AndresGaibor/talend-mcp.git && cd talend-mcp
bun install
bun run verify        # typecheck, tests y validación de fixtures: debe quedar en verde
bun run start         # servidor HTTP en http://127.0.0.1:3927/mcp
bun run mapa          # estructura del repo, herramientas por preset y estado del bridge
```

Las reglas del repositorio están en [AGENTS.md](AGENTS.md) y la guía para contribuir en
[CONTRIBUTING.md](CONTRIBUTING.md). Los cambios por versión, en [CHANGELOG.md](CHANGELOG.md).

## Licencia

[MIT](LICENSE) © 2026 Andres Gaibor
