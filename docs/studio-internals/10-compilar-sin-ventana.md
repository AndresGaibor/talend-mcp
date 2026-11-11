# Compilar sin la ventana de Studio

**Estado: reconocimiento cerrado; en este equipo solo es medible la opción del bridge.** Fecha: 11 de
noviembre de 2026 (tarea A-7 del Plan A).

## Lo que se comprobó (paso 1)

Instalación: `C:\Talend\8.0.1\studio`, 1 382 entradas en `plugins/`.

```
$ ls C:/Talend/8.0.1/studio/plugins | grep -i command
org.apache.felix.gogo.command_1.1.2.v20210111-1007.jar
org.eclipse.core.commands_3.12.500.v20251103-0733.jar
org.eclipse.e4.core.commands_1.1.700.v20250916-0927.jar
org.eclipse.wst.command.env.core_1.1.0.v202308010229.jar
org.eclipse.wst.command.env.ui_1.2.0.v202308012257.jar
org.eclipse.wst.command.env_1.1.0.v202308010354.jar
```

**No existe `org.talend.commandline*` en esta instalación.** La opción (2) del plan —el modo
`-application org.talend.commandline.CommandLine`— no está disponible aquí. Los plugins que aparecen
son de Eclipse y del entorno WST, no el lanzador por lotes de Talend.

## Opción (3), Maven/JDK: no hay Maven que ejecutar

- `mvn` no está en el PATH (`which mvn` no encuentra nada).
- No hay `mvn.cmd`, `mvn.bat` ni `mvnw*` en ningún punto de `C:\Talend\8.0.1` (búsqueda hasta seis
  niveles).
- Lo que sí trae Studio es `org.eclipse.m2e.maven.runtime_3.9.1600.20260522-0510` (un Maven embebido
  en jars, para que el IDE compile) y la caché `studio/configuration/.m2/repository`. Los dos existen,
  pero son piezas de la interfaz, no una línea de comandos con su `bin`.
- Los `poms` de los Jobs ya construidos están en `poms/jobs/process/<job>`, así que el material para
  compilar por Maven existe; lo que falta es el ejecutable.

## Decisión

Con la opción (2) ausente y la (3) sin ejecutable, la única forma medible de compilar aquí es la
opción (1), el bridge, y se mantiene. La regla de adopción del plan no se puede aplicar porque las
alternativas no existen en este equipo: **no se escribe `talend_job_build_headless`**.

Si más adelante se instala Maven 3.9 apuntando a la caché de Studio, la medición es la del plan: los
primeros 20 Jobs de L0 a L1 con las tres opciones, y solo se adopta si compila en menos de 3 minutos
con el mismo resultado que el bridge.
