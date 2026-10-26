# Talend MCP

Una forma sencilla de trabajar con proyectos de **Qlik Talend Studio** desde un asistente compatible
con [MCP](https://modelcontextprotocol.io/).

Talend MCP permite consultar proyectos y, cuando Talend Studio está abierto, crear, modificar y
probar jobs con ayuda de un asistente. La integración está pensada para ejecutarse en el equipo
local y mantener los proyectos bajo tu control.

## Qué puedes hacer

- Explorar jobs, componentes, contextos y resultados.
- Crear y modificar jobs directamente en Talend Studio.
- Revisar problemas y ejecutar jobs para comprobar sus resultados.
- Pedir al asistente que te guíe: no necesitas conocer de memoria todas las herramientas.

Para empezar, dile al asistente que use **`talend_guide`**. Te indicará qué puede hacer y cómo
continuar según la tarea.

## Estado del proyecto

El soporte se prueba por etapas: desde comprobar que un componente se puede añadir y configurar,
hasta ejecutar un job y verificar que produce el resultado esperado.

| Cobertura | Resultado más reciente | Qué significa |
|---|---:|---|
| Componentes básicos | **877 de 897** | Se comprobó que se pueden crear y configurar. |
| Componentes que compilan | **418 de 498 probados** | Talend pudo generar y compilar el job de prueba. |
| Ejecuciones verificadas | **66 componentes, en 63 escenarios** | Se ejecutaron jobs y se compararon sus resultados con lo esperado. |

Estas cifras corresponden a pruebas en **Talend Studio 8.0.1**. No significan que todos los
componentes estén probados en todos los escenarios: algunos necesitan drivers, servicios externos
o módulos que no están disponibles en ese entorno. Un componente sin pruebas no necesariamente
está fuera de soporte.

### Ejemplos probados

Las pruebas de ejecución incluyen lectura y escritura de archivos y JSON, transformaciones de datos,
control de flujo, contextos, operaciones con PostgreSQL, privacidad y algunas operaciones de S3 y
SQS mediante un emulador. Las pruebas con emulador no sustituyen una validación en AWS real.

### En qué se está trabajando

- Ampliar las pruebas de componentes, empezando por las familias de uso común.
- Investigar dependencias que hoy impiden probar algunos componentes, como la lectura de XLSX.
- Probar más conectores de bases de datos y servicios cloud en entornos adecuados.
- Validar una migración de SAS a Talend comparando los resultados.

Los resultados, componentes probados y pendientes se mantienen en la
[cobertura por familia](docs/COBERTURA-POR-FAMILIA.md) y el [plan de pruebas](docs/PLAN-DE-PRUEBAS.md).
La [hoja de ruta](docs/ROADMAP-DOMINIO-TALEND.md) describe el objetivo general.

## Empezar

### 1. Requisitos

- [Bun](https://bun.sh/), para instalar y ejecutar el servidor.
- Un proyecto de Talend Studio accesible desde el equipo.
- Talend Studio abierto si quieres crear, modificar o ejecutar jobs desde el asistente.

Puedes consultar archivos del proyecto sin abrir Talend Studio. Para trabajar con jobs en vivo,
también necesitarás instalar el plugin de integración incluido en este repositorio.

### 2. Instalar

```bash
git clone https://github.com/AndresGaibor/talend-mcp.git
cd talend-mcp
bun install
```

Indica dónde está tu proyecto creando un archivo `.env.local`:

```dotenv
TALEND_PROJECT="C:/ruta/al/workspace/MI_PROYECTO"
```

La ruta debe señalar la carpeta que contiene `talend.project`.

### 3. Iniciar

```bash
bun run start
```

`start` actualiza el plugin automáticamente si Talend Studio está abierto y el bridge no
responde. Si no quieres que toque el plugin, usa `bun run start --skip-bridge` o
`bun run start:server`.

El servidor estará disponible localmente en `http://127.0.0.1:3927/mcp`. Configura esa dirección
en tu cliente MCP y comienza con `talend_guide`. Por defecto expone el preset `agent` (46
herramientas); para ver el catálogo completo, define `TALEND_MCP_FILTER=canonical`.

### 4. Habilitar el trabajo en vivo con Talend Studio

Con Talend Studio instalado, ejecuta:

```bash
bun run bridge:install
```

El plugin conecta el servidor con Studio. Si Studio está abierto, normalmente se actualiza sin
reiniciarlo. El bridge funciona en modo de solo lectura por defecto; las acciones que modifican el
proyecto requieren la autorización correspondiente en el entorno.

Si la instalación no detecta Studio, define `TALEND_STUDIO_HOME` con la carpeta que contiene
`plugins/` y `features/`. Para revisar el estado completo: `bun run doctor`.

## Conectar otro cliente MCP

Si tu cliente usa el modo `stdio`, puedes configurarlo así:

```json
{
  "mcpServers": {
    "talend-mcp": {
      "command": "bun",
      "args": ["run", "index.ts"],
      "env": {
        "TALEND_PROJECT": "<ruta-a-tu-proyecto>",
        "TALEND_MCP_FILTER": "agent"
      }
    }
  }
}
```

El preset `agent` ofrece una selección práctica para empezar. Puedes consultar la lista completa
en el [catálogo de herramientas](docs/CATALOGO-DE-TOOLS.md).

## Documentación

- [Guía para asistentes](docs/GUIA-AGENTE.md): tareas habituales y recomendaciones de uso.
- [Cobertura por familia](docs/COBERTURA-POR-FAMILIA.md): componentes probados y pendientes.
- [Plan de pruebas](docs/PLAN-DE-PRUEBAS.md): escenarios y resultados detallados.
- [Arquitectura](docs/ARQUITECTURA.md): cómo está organizado el proyecto.
- [Ayuda para contribuir](AGENTS.md): comandos y convenciones de desarrollo.

## Desarrollo

```bash
bun run verify       # typecheck + tests + validacion de fixtures
bun test tests/talend/l5-scenario-files.test.ts   # un solo archivo
bun run l5:validar   # valida los fixtures L5 sin abrir Studio
bun run doctor       # estado de Studio, bridge, MCP y configuracion
```

## Configuración adicional

Por defecto, el servidor usa HTTP local. Si necesitas ajustar el modo, el puerto o las herramientas
visibles, puedes configurar estas variables:

| Variable | Uso |
|---|---|
| `TALEND_MCP_MODE` | `http` o `stdio`. |
| `TALEND_MCP_PORT` | Puerto HTTP (por defecto `3927`). |
| `TALEND_MCP_HOST` | Dirección de escucha (por defecto `127.0.0.1`). |
| `TALEND_WORKSPACE` | Ubicación del workspace, si no defines `TALEND_PROJECT`. |
| `TALEND_MCP_FILTER` | Herramientas visibles: `agent` (por defecto en `start`), `core`, `canonical` o `all`. |
| `TALEND_STUDIO_HOME` | Instalación de Studio (carpeta con `plugins/` y `features/`). |
| `TALEND_BRIDGE_AUTO_INSTALL` | `0` desactiva la actualización automática del plugin al arrancar. |
| `TALEND_MCP_LOG` | `quiet`, `normal` o `verbose` para los mensajes de los CLI. |
| `TALEND_LOG_DIR` | Carpeta donde buscar los logs de Studio para `talend_read_run_log`. |
| `TALEND_DISABLE_AUTODETECT` | `1` impide inferir el proyecto desde el workspace. |

## Solución rápida de problemas

- **El asistente no encuentra el proyecto:** revisa la ruta de `TALEND_PROJECT`.
- **No aparecen jobs abiertos:** abre el job en Talend Studio.
- **No conecta con Studio:** confirma que el plugin esté instalado y Studio abierto.
- **Necesitas saber si un componente está probado:** consulta la [cobertura por familia](docs/COBERTURA-POR-FAMILIA.md).
