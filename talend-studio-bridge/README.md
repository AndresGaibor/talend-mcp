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

- **Studio abierto:** compila con `javac` (~8 s, 0 s si no hay cambios) y recarga el plugin en
  caliente. No hay que reiniciar Studio.
- **Studio cerrado:** compila con Maven + Tycho y lo instala con el p2 director, reemplazando la
  version anterior.
- `--maven` fuerza Maven; `--force` recompila y recarga aunque no haya cambios.

**No copies el jar a `studio/plugins/` a mano:** el nombre del archivo debe coincidir con la
version del MANIFEST o Eclipse carga el bundle sin sus dependencias.

## Compilar solo con Maven

```bash
cd talend-studio-bridge
mvn clean verify -DskipTests
```

El update site queda en `com.andres.talend.bridge.repository/target/repository/`. La primera
compilacion con Maven es la que deja en `~/.m2` los jars que luego usa la compilacion rapida.

## Reglas al tocar el codigo Java

- Nada lento ni bloqueante en el hilo de UI (`UiThread.sync` solo para widgets y el modelo del
  job, en trozos cortos).
- El bridge no conoce componentes concretos: la configuracion es declarativa y generica.

Documentacion completa: [docs/GUIA-AGENTE.md](../docs/GUIA-AGENTE.md) (uso) y
[docs/TALEND-STUDIO-INTERNALS.md](../docs/TALEND-STUDIO-INTERNALS.md) (APIs internas).
