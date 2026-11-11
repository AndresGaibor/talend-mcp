# Compilar sin la ventana de Studio

**Estado: reconocimiento hecho, medición pendiente.** Fecha: 11 de noviembre de 2026 (tarea A-7 del
Plan A).

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
`-application org.talend.commandline.CommandLine`— no está disponible aquí; no se puede medir ni
adoptar. Los plugins que aparecen son de Eclipse y del entorno WST, no el lanzador por lotes de Talend.

## Lo que queda (pasos 2 y 3)

Medir, sobre los mismos 20 Jobs de L0 a L1, la opción (1) actual (`talend_job_build_batch`) contra la
opción (3) —`Build Job` de un Job y compilación con Maven/JDK— y aplicar la regla de adopción del
plan: se adopta solo si compila 20 Jobs en menos de 3 min con el mismo resultado que la opción 1.

Mientras eso no se mida, el proyecto sigue dependiendo del bridge para compilar y no se escribe la
tool `talend_job_build_headless`.

## Por qué no se cierra aquí

La medición necesita Studio sano, compilar 20 Jobs reales y comparar el resultado del bridge con el
de Maven. Es trabajo de una corrida con Studio libre y auditoría de los `.jar` generados, no de una
edición de código; queda anotado como pendiente con este motivo.
