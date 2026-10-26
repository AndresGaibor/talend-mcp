# Internals de Talend Studio: Bridge, instalacion y carga en caliente

[Indice completo](../TALEND-STUDIO-INTERNALS.md)

## 19. Estructura del codigo del bridge

El paquete `automation` del plugin quedo dividido por responsabilidades, para
que tocar una cosa no obliga a tocar todo lo demas:

| Clase | Que hace |
|---|---|
| `JobOperationsService` | Fachada: coordina y envuelve en el sobre de respuesta. |
| `JobRepository` | Crear, borrar y abrir jobs del repositorio de Talend. |
| `NodeOperations` | Alta, edicion, conexion y borrado de componentes. |
| `SchemaOperations` | Schema del nodo y tablas de datos de los componentes. |
| `ComponentConfigurator` | Configuracion declarativa (parameters, tables, schema). |
| `MapperConfigurer` | El modelo del tMap (adaptador del componente). |
| `JobPersistence` | Guardar el modelo en el `.item`. |
| `ComponentCatalog` | Parametros de los componentes del catalogo. |
| `TalendApi` | Acceso al IDE por reflexion (editor, proceso, nodo, componente). |
| `TalendClasses` | Carga de clases de Talend desde los bundles de OSGi. |
| `JsonSpec` | Lectura del spec JSON de las operaciones. |
| `ColumnTypes` | Tipos Java de columna y sus alias. |

## 20. Instalar el plugin: caliente o con p2

- **Con Studio corriendo**: `bun run bridge:install`
  publica el jar en `~/.talend-bridge/hot/bridge.jar` y el plugin lo recarga
  solo.
- **Con Studio parado**: el mismo comando lo instala con p2.

**No hay que copiar el jar a mano** en `studio/plugins/`: el nombre del
archivo tiene que coincidir con la version del MANIFEST, y si no, Eclipse
carga el bundle sin resolver sus dependencias y todo falla con
`ClassNotFoundException: org.eclipse.draw2d.geometry.Point cannot be found`.
## 23. Ejecutar un job y leer su salida

Talend ejecuta cada job en una JVM aparte y muestra el resultado en la vista Run,
que no se puede leer desde el bridge. Pero el codigo generado queda en el
workspace, en:

```
poms/jobs/process/<job>/<job>_<version>/
  target/classpath.jar      <- con el Class-Path completo en su MANIFEST
  target/classes/...        <- las clases compiladas
```

El `classpath.jar` lleva en su MANIFEST el `Class-Path` con las routines, las
librerias y las clases del job, asi que basta ponerlo en el classpath para
tener el entorno completo. Y la clase principal se deduce de las clases
compiladas: el fichero `<JobName>.class` dentro de `target/classes` dice el
paquete.

No siempre esta en `poms`: hay jobs cuyo proyecto Maven queda montado pero
vacio, y entonces el codigo generado aparece en un proyecto suelto del
workspace, `PRJ_<PROYECTO>_<JOB>_<VERSION>` (el job en mayusculas), con el mismo
layout (`src/main/java/...`, `target/classes`, `target/classpath.jar`). El
buscador del bridge mira primero `poms/jobs/process` y, si ahi no hay
`target/classpath.jar`, cae a esa carpeta. Ver la seccion 53.

Con eso el bridge relanza el job y devuelve su salida, que es lo que hace
falta para comprobar que el resultado es el esperado (el plan de pruebas lo
pide explicitamente: "la salida coincide con lo esperado, que defines tu
antes de ejecutar").

```java
java -Xms256M -Xmx1024M -Dfile.encoding=UTF-8 -Dstdout.encoding=UTF-8 \
  -cp <job>/target/classpath.jar \
  prj_bancolombia.mi_job_0_1.MI_JOB --context=Default
```

El `java` es el del propio runtime de Studio (`java.home`).

La tool es `talend_job_execute`, y devuelve el codigo de salida, la salida
estandar y la salida de error, con las lineas de la salida ya separadas.

**Ojo**: el proceso se relanza, no se intercepta. El job ya se ha ejecutado
una vez con `talend_job_run_by_name` (que compila y lanza); `talend_job_execute` lo
ejecuta otra vez para poder leer su salida.
