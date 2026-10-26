# Talend Studio Bridge

Plugin Java/Eclipse RCP que corre dentro de Talend Studio y expone sus APIs por HTTP local
(`127.0.0.1:3930`, con token). Con el se crean y editan jobs con la API nativa de Studio, se
ejecutan y se leen sus resultados. El MCP habla con este plugin; tambien se puede llamar directo
(`bun run scripts/bridge-call.ts`).

## Instalar o actualizar

Desde la raiz del repo, no con Maven a mano:

```bash
bun run scripts/start.ts --install-bridge
```

- **Studio abierto:** compila con `javac` (~3 s, 0 s si no hay cambios) y recarga el plugin en
  caliente. No hay que reiniciar Studio.
- **Studio cerrado:** compila con Maven + Tycho y lo instala con el p2 director, reemplazando la
  version anterior.
- `--maven` fuerza Maven; `--force` recompila y recarga aunque no haya cambios.

**No copies el jar a `studio/plugins/` a mano:** el nombre del archivo debe coincidir con la
version del MANIFEST o Eclipse carga el bundle sin sus dependencias.

El jar para carga en caliente se publica en `~/.talend-bridge/hot/bridge.jar` (o en
`TALEND_BRIDGE_HOT_DIR`). Se escribe en un temporal y se renombra, asi que el plugin nunca lee un
jar a medias. Antes de recargar, el plugin comprueba que el jar sea este bundle: un jar roto o
ajeno se ignora y el bridge sigue activo.

## Estado y desarrollo

```bash
bun run bridge:status   # Studio, version en vivo, build local, jar publicado y configuracion
bun run bridge:watch    # Studio abierto: recompila y recarga en cada cambio al guardar
```

- `bridge:status` avisa si el bridge en vivo no tiene el ultimo build compilado, o si hay cambios
  sin compilar. Solo lee; no toca Studio.
- `bridge:watch` es el ciclo de desarrollo: al guardar un fuente de `src/`, `META-INF/` o
  `plugin.xml` recompila con `javac` y recarga el bridge. Sin Maven, sin reiniciar Studio.

## Errores de Studio desde el bridge

`GET /logs/tail?lines=200` devuelve las ultimas lineas del Error Log de Studio
(`<workspace>/.metadata/.log`), leyendo solo el final del archivo. Tambien registra los fallos
del propio bridge. `GET /ping` incluye ademas `pid`, `javaVersion`, `startedAt` y `uptimeMs`.

## Examinar la API de Talend

El bridge llama a las APIs de Talend por reflexion, con nombres escritos como texto. Un nombre
que la version de Studio ya no tiene no da error de compilacion: el metodo devuelve null y parece
que el dato no existe. Hay tres herramientas para comprobarlo:

```bash
bun run scripts/talend-api.ts drift                      # nombres del codigo que la instalacion no tiene
bun run scripts/talend-api.ts find getListContext        # en que clases de org.talend se declara un nombre
bun run scripts/talend-api.ts live org.talend.core.model.process.IProcess \
  --member org.talend.core.model.process.IProcess#getUniqueName   # contra el Studio abierto
```

- `drift` y `find` leen los `.class` de los jars instalados (sin cargarlos). Un hallazgo de `drift`
  es una pista: los nombres de EMF, GEF y de tipos no importados aparecen aunque existan.
- `live` pregunta al bridge en marcha (`POST /talend/api/check`), que usa la misma caché de clases
  que el resto del plugin.
- Cuando un metodo de la API no existe o falla al invocarse, el Error Log lo registra una sola vez
  por clase y metodo (antes era silencio).

La instalacion probada tiene los jars de **Talend 8.0.3** aunque la carpeta se llame `8.0.1`:
compruebalo con `bun run scripts/talend-api.ts find` antes de asumir una version.

## Estado de los launches

El codigo de salida de un job se lee del proceso de Eclipse Debug de su launch (`IProcess`), no del
proceso del sistema: la API publica de Java no lo expone. Asi un launch termina en `success` o
`failed`. Si Eclipse no llega a marcar el proceso, queda `terminated_without_exit_code`.

Estados posibles de un launch:

- `success` / `failed`: el job termino y se conoce su codigo de salida.
- `terminated_without_exit_code`: termino, pero Eclipse no dio el codigo.
- `not_observed`: el proceso del job nunca aparecio en 15 minutos; no se sabe como termino.
- `interrupted`: seguia `started` al cargar el plugin. Su vigilante vivia en memoria y se perdio al
  recargar o reiniciar.

El store (`~/.talend-bridge/launch-runs.txt`) es de solo anadir: cada cambio de estado es una linea
nueva. Al cargar el plugin se deja una linea por lanzamiento (su ultimo estado) y, como tope de
crecimiento, los 5.000 mas recientes.

## Rendimiento de la busqueda de clases

Buscar una clase de Talend recorre todos los bundles de Studio. El plugin guarda el resultado y
tambien recuerda, durante un minuto, que una clase no esta. Antes cada una de las ~60 llamadas por
operacion repetia la busqueda, y `/talend/probe/classes` tardaba unos 40 s.

## Compilar solo con Maven

```bash
cd talend-studio-bridge
mvn clean verify -DskipTests
```

El update site queda en `com.andres.talend.bridge.repository/target/repository/`. La primera
compilacion con Maven es la que deja en `~/.m2` los jars que luego usa la compilacion rapida.
Si Maven no esta en el PATH, define `MAVEN_HOME` con su carpeta.

## Reglas al tocar el codigo Java

- Las rutas se declaran en la tabla de `BridgeServer.registerRoutes()`, una vez por ruta.
  `worker` / `workerBody` para lo que no toca widgets ni el modelo del job; `ui` / `uiBody` para
  lo que si, porque corren en el hilo de la UI con `UiThread.sync` (en trozos cortos).
- Usa lambdas (`() -> Clase.metodo()`) y no referencias a metodos de otras clases en la tabla: asi
  una clase que no se pueda cargar en Studio rompe solo su ruta, no el arranque del bridge.
- El bridge no conoce componentes concretos: la configuracion es declarativa y generica.
- Tests Java: `bun test tests/talend/bridge-java.test.ts`. Compila `test/` contra el bundle y los
  jars de Studio, y ejecuta las pruebas con el JDK de Studio (validacion del jar, rutas HTTP,
  configuracion, caches y el store de launches). Se salta si no hay Studio instalado.
- El build de `bridge:install` no ejecuta tests: son los del comando de arriba.
- `tests/scripts/bridge-route-contract.test.ts` comprueba que el cliente TypeScript solo llama rutas
  que el servidor registra. Al anadir una ruta en Java, anadela tambien al cliente si la usa.

Documentacion completa: [docs/GUIA-AGENTE.md](../docs/GUIA-AGENTE.md) (uso) y
[docs/TALEND-STUDIO-INTERNALS.md](../docs/TALEND-STUDIO-INTERNALS.md) (APIs internas).
