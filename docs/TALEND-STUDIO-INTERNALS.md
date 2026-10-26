# Internals de Talend Studio

Referencia de las APIs internas de Talend Studio 8.0.1 que usa el bridge. Todo lo que está
aquí se verificó leyendo el bytecode de los jars de Studio (no hay código fuente disponible)
o ejecutando el flujo y observando el resultado.

Sirve para dos cosas:

1. Explicar por qué el bridge hace las cosas como las hace, para que no se rompan a ciegas.
2. Servir de punto de partida cuando haya que explorar una API interna nueva.

## Archivos

La referencia esta separada por area para que cada archivo se pueda leer y
editar sin cargar las 2.500 lineas completas. Los numeros de seccion se
conservan porque otras guias los citan como `INTERNALS N`.

| Archivo | Contenido | Secciones |
|---|---|---|
| [Fundamentos](studio-internals/01-fundamentos.md) | Entorno, ejecucion, modelo y API | 1-10 |
| [Operar el job](studio-internals/02-operar-el-job.md) | Job abierto y guardian de modales | 11-14 |
| [Recetas y diseno](studio-internals/03-recetas-y-diseno.md) | Humo, verificacion y configuracion declarativa | 15-18 |
| [Bridge e instalacion](studio-internals/04-bridge-e-instalacion.md) | Estructura, p2, carga en caliente y UI | 19-23 |
| [Componentes](studio-internals/05-componentes.md) | Catalogo, definiciones y cobertura | 24-30 |
| [Cobertura y conexiones](studio-internals/06-cobertura-y-conexiones.md) | Conexiones, contextos y procesos | 31-40 |
| [Componentes avanzados](studio-internals/07-componentes-avanzados.md) | Transformaciones, bases de datos y ejecucion | 41-71 |
| [Interfaz de usuario](studio-internals/08-interfaz-ui.md) | Menus, pestanas, dialogos por flujo, guardian de modales y control de dialogos desde el flujo | 72-78 |

## Indice por seccion

| Seccion | Archivo |
|---|---|
| 1. Entorno y rutas | [01-fundamentos](studio-internals/01-fundamentos.md#1-entorno-y-rutas) |
| 2. Metodo de investigacion | [01-fundamentos](studio-internals/01-fundamentos.md#2-metodo-de-investigacion) |
| 3. Tipos Java de columna | [01-fundamentos](studio-internals/01-fundamentos.md#3-tipos-java-de-columna) |
| 4. Anatomia de un `.item` de job | [01-fundamentos](studio-internals/01-fundamentos.md#4-anatomia-de-un-item-de-job) |
| 5. Layout del proyecto Talend | [01-fundamentos](studio-internals/01-fundamentos.md#5-layout-del-proyecto-talend) |
| 6. Como ejecuta un job Talend Studio | [01-fundamentos](studio-internals/01-fundamentos.md#6-como-ejecuta-un-job-talend-studio) |
| 7. El problema del modelo en memoria | [01-fundamentos](studio-internals/01-fundamentos.md#7-el-problema-del-modelo-en-memoria) |
| 8. Referencia de clases | [01-fundamentos](studio-internals/01-fundamentos.md#8-referencia-de-clases) |
| 9. Log de errores de Eclipse | [01-fundamentos](studio-internals/01-fundamentos.md#9-log-de-errores-de-eclipse) |
| 10. Recetas de diagnostico | [01-fundamentos](studio-internals/01-fundamentos.md#10-recetas-de-diagnostico) |
| 11. Operar sobre el job abierto con la API de Studio | [02-operar-el-job](studio-internals/02-operar-el-job.md#11-operar-sobre-el-job-abierto-con-la-api-de-studio) |
| 12. Operar sobre el job abierto: lo que faltaba | [02-operar-el-job](studio-internals/02-operar-el-job.md#12-operar-sobre-el-job-abierto-lo-que-faltaba) |
| 13. El guardian de modales | [02-operar-el-job](studio-internals/02-operar-el-job.md#13-el-guardian-de-modales) |
| 14. El fin de la ejecucion de un job | [02-operar-el-job](studio-internals/02-operar-el-job.md#14-el-fin-de-la-ejecucion-de-un-job) |
| 15. Receta: un job de humo de punta a punta | [03-recetas-y-diseno](studio-internals/03-recetas-y-diseno.md#15-receta-un-job-de-humo-de-punta-a-punta) |
| 16. Regla de oro: verificar el resultado, no el `ok` | [03-recetas-y-diseno](studio-internals/03-recetas-y-diseno.md#16-regla-de-oro-verificar-el-resultado-no-el-ok) |
| 17. Lo que queda sin resolver | [03-recetas-y-diseno](studio-internals/03-recetas-y-diseno.md#17-lo-que-queda-sin-resolver) |
| 18. Configuracion declarativa de componentes | [03-recetas-y-diseno](studio-internals/03-recetas-y-diseno.md#18-configuracion-declarativa-de-componentes) |
| 21. La carga en caliente: lo que hay que soltar antes de recargar | [03-recetas-y-diseno](studio-internals/03-recetas-y-diseno.md#21-la-carga-en-caliente-lo-que-hay-que-soltar-antes-de-recargar) |
| 22. Lo que funciona y lo que no | [03-recetas-y-diseno](studio-internals/03-recetas-y-diseno.md#22-lo-que-funciona-y-lo-que-no) |
| 19. Estructura del codigo del bridge | [04-bridge-e-instalacion](studio-internals/04-bridge-e-instalacion.md#19-estructura-del-codigo-del-bridge) |
| 20. Instalar el plugin: caliente o con p2 | [04-bridge-e-instalacion](studio-internals/04-bridge-e-instalacion.md#20-instalar-el-plugin-caliente-o-con-p2) |
| 23. Ejecutar un job y leer su salida | [04-bridge-e-instalacion](studio-internals/04-bridge-e-instalacion.md#23-ejecutar-un-job-y-leer-su-salida) |
| 24. Componentes que no generan codigo valido en Talend 8.0.1 | [05-componentes](studio-internals/05-componentes.md#24-componentes-que-no-generan-codigo-valido-en-talend-8-0-1) |
| 25. Descargar artefactos de Maven | [05-componentes](studio-internals/05-componentes.md#25-descargar-artefactos-de-maven) |
| 26. Que no puede entrar al hilo de la UI | [05-componentes](studio-internals/05-componentes.md#26-que-no-puede-entrar-al-hilo-de-la-ui) |
| 27. Problemas de diseno de un job | [05-componentes](studio-internals/05-componentes.md#27-problemas-de-diseno-de-un-job) |
| 28. Compilar un job sin ejecutarlo | [05-componentes](studio-internals/05-componentes.md#28-compilar-un-job-sin-ejecutarlo) |
| 29. El catalogo tiene una variante de cada componente por tipo de job | [05-componentes](studio-internals/05-componentes.md#29-el-catalogo-tiene-una-variante-de-cada-componente-por-tipo-de-job) |
| 30. La definicion de cada componente esta en el XML de la instalacion | [05-componentes](studio-internals/05-componentes.md#30-la-definicion-de-cada-componente-esta-en-el-xml-de-la-instalacion) |
| 31. La cobertura con montaje: como se mide L3 y L4 de verdad | [06-cobertura-y-conexiones](studio-internals/06-cobertura-y-conexiones.md#31-la-cobertura-con-montaje-como-se-mide-l3-y-l4-de-verdad) |
| 32. Conectar bien: el nombre de la conexion y el del conector | [06-cobertura-y-conexiones](studio-internals/06-cobertura-y-conexiones.md#32-conectar-bien-el-nombre-de-la-conexion-y-el-del-conector) |
| 33. Ejecutar un job y leer su salida | [06-cobertura-y-conexiones](studio-internals/06-cobertura-y-conexiones.md#33-ejecutar-un-job-y-leer-su-salida) |
| 34. Los jobs de Big Data (Spark) | [06-cobertura-y-conexiones](studio-internals/06-cobertura-y-conexiones.md#34-los-jobs-de-big-data-spark) |
| 35. Conectar con una base de datos | [06-cobertura-y-conexiones](studio-internals/06-cobertura-y-conexiones.md#35-conectar-con-una-base-de-datos) |
| 36. Los contextos (los entornos) de un job | [06-cobertura-y-conexiones](studio-internals/06-cobertura-y-conexiones.md#36-los-contextos-los-entornos-de-un-job) |
| 37. Los contextos del proyecto (los items de tipo "Contexts") | [06-cobertura-y-conexiones](studio-internals/06-cobertura-y-conexiones.md#37-los-contextos-del-proyecto-los-items-de-tipo-contexts) |
| 38. El proyecto Maven duplicado: "duplicated in the reactor" | [06-cobertura-y-conexiones](studio-internals/06-cobertura-y-conexiones.md#38-el-proyecto-maven-duplicado-duplicated-in-the-reactor) |
| 39. El proceso viejo: el build compila el job que no es | [06-cobertura-y-conexiones](studio-internals/06-cobertura-y-conexiones.md#39-el-proceso-viejo-el-build-compila-el-job-que-no-es) |
| 39. El heap de Studio se llena y el IDE deja de responder | [06-cobertura-y-conexiones](studio-internals/06-cobertura-y-conexiones.md#39-el-heap-de-studio-se-llena-y-el-ide-deja-de-responder) |
| 40. Los triggers: el conector va con el tipo del catalogo | [06-cobertura-y-conexiones](studio-internals/06-cobertura-y-conexiones.md#40-los-triggers-el-conector-va-con-el-tipo-del-catalogo) |
| 41. El tAggregateRow: la primera tabla de metadata es la de salida | [07-componentes-avanzados](studio-internals/07-componentes-avanzados.md#41-el-taggregaterow-la-primera-tabla-de-metadata-es-la-de-salida) |
| 42. Conectar propaga el esquema del destino hacia atras | [07-componentes-avanzados](studio-internals/07-componentes-avanzados.md#42-conectar-propaga-el-esquema-del-destino-hacia-atras) |
| 43. El nombre de la columna en la base de datos: `setOriginalDbColumnName` | [07-componentes-avanzados](studio-internals/07-componentes-avanzados.md#43-el-nombre-de-la-columna-en-la-base-de-datos-setoriginaldbcolumnname) |
| 44. Los parametros de lista no se entrecomillan | [07-componentes-avanzados](studio-internals/07-componentes-avanzados.md#44-los-parametros-de-lista-no-se-entrecomillan) |
| 45. Escribir en una base de datos: como se hace | [07-componentes-avanzados](studio-internals/07-componentes-avanzados.md#45-escribir-en-una-base-de-datos-como-se-hace) |
| 46. Los valores de las celdas de tabla: los nombres sin comillas | [07-componentes-avanzados](studio-internals/07-componentes-avanzados.md#46-los-valores-de-las-celdas-de-tabla-los-nombres-sin-comillas) |
| 47. El tFileList en Talend 8: no emite filas, deja valores en el globalMap | [07-componentes-avanzados](studio-internals/07-componentes-avanzados.md#47-el-tfilelist-en-talend-8-no-emite-filas-deja-valores-en-el-globalmap) |
| 48. El tFileInputJSON: la raiz del bucle y el mapeo | [07-componentes-avanzados](studio-internals/07-componentes-avanzados.md#48-el-tfileinputjson-la-raiz-del-bucle-y-el-mapeo) |
| 49. El tNormalize: la salida copia las columnas de la entrada por su nombre | [07-componentes-avanzados](studio-internals/07-componentes-avanzados.md#49-el-tnormalize-la-salida-copia-las-columnas-de-la-entrada-por-su-nombre) |
| 50. El tJavaRow: el codigo se inserta tal cual | [07-componentes-avanzados](studio-internals/07-componentes-avanzados.md#50-el-tjavarow-el-codigo-se-inserta-tal-cual) |
| 51. Al compilar: `Child module ... does not exist` (el agregador Maven y el heap) | [07-componentes-avanzados](studio-internals/07-componentes-avanzados.md#51-al-compilar-child-module-does-not-exist-el-agregador-maven-y-el-heap) |
| 52. El driver de la base no hace falta para compilar, solo para ejecutar | [07-componentes-avanzados](studio-internals/07-componentes-avanzados.md#52-el-driver-de-la-base-no-hace-falta-para-compilar-solo-para-ejecutar) |
| 53. Un trigger solo se genera si sale del **arranque** del subjob | [07-componentes-avanzados](studio-internals/07-componentes-avanzados.md#53-un-trigger-solo-se-genera-si-sale-del-arranque-del-subjob) |
| 54. Donde acaba el codigo generado de un job | [07-componentes-avanzados](studio-internals/07-componentes-avanzados.md#54-donde-acaba-el-codigo-generado-de-un-job) |
| 55. Studio bloquea el `classpath.jar` del job que ha cargado | [07-componentes-avanzados](studio-internals/07-componentes-avanzados.md#55-studio-bloquea-el-classpath-jar-del-job-que-ha-cargado) |
| 56. Al reiniciar Studio carga el bundle **instalado**, no el de la carga en caliente | [07-componentes-avanzados](studio-internals/07-componentes-avanzados.md#56-al-reiniciar-studio-carga-el-bundle-instalado-no-el-de-la-carga-en-caliente) |
| 57. Las listas cerradas se guardan con su `VALUE`, no con el nombre | [07-componentes-avanzados](studio-internals/07-componentes-avanzados.md#57-las-listas-cerradas-se-guardan-con-su-value-no-con-el-nombre) |
| 58. Inspeccionar definiciones instaladas de componentes | [07-componentes-avanzados](studio-internals/07-componentes-avanzados.md#58-inspeccionar-definiciones-instaladas-de-componentes) |
| 59. Inventario del repositorio y dependencias del job | [07-componentes-avanzados](studio-internals/07-componentes-avanzados.md#59-inventario-del-repositorio-y-dependencias-del-job) |
| 60. `DROP_CREATE` no es idempotente | [07-componentes-avanzados](studio-internals/07-componentes-avanzados.md#60-drop_create-no-es-idempotente) |
| 61. Cada job corre dos veces en el harness | [07-componentes-avanzados](studio-internals/07-componentes-avanzados.md#61-cada-job-corre-dos-veces-en-el-harness) |
| 62. `tRowGenerator` en un job hijo | [07-componentes-avanzados](studio-internals/07-componentes-avanzados.md#62-trowgenerator-en-un-job-hijo) |
| 63. Artefactos de POI para Excel en Studio offline | [07-componentes-avanzados](studio-internals/07-componentes-avanzados.md#63-artefactos-de-poi-para-excel-en-studio-offline) |
| 64. Build Job: la API y el zip que produce | [07-componentes-avanzados](studio-internals/07-componentes-avanzados.md#64-build-job-la-api-y-el-zip-que-produce) |
| 65. El launcher no lee variables de entorno | [07-componentes-avanzados](studio-internals/07-componentes-avanzados.md#65-el-launcher-no-lee-variables-de-entorno) |
| 66. `tSendMail` trae CC y BCC con direcciones de ejemplo | [07-componentes-avanzados](studio-internals/07-componentes-avanzados.md#66-tsendmail-trae-cc-y-bcc-con-direcciones-de-ejemplo) |
| 67. Dependencias de Hive y Hadoop que Studio no trae | [07-componentes-avanzados](studio-internals/07-componentes-avanzados.md#67-dependencias-de-hive-y-hadoop-que-studio-no-trae) |
| 68. El driver de Impala se pide aunque el modo sea HIVE2 | [07-componentes-avanzados](studio-internals/07-componentes-avanzados.md#68-el-driver-de-impala-se-pide-aunque-el-modo-sea-hive2) |
| 69. `tAssert` y `tAssertCatcher`: expresion sin comillas y esquema completo | [07-componentes-avanzados](studio-internals/07-componentes-avanzados.md#69-tassert-y-tassertcatcher-expresion-sin-comillas-y-esquema-completo) |
| 70. `tHashInput` no recibe filas de `tHashOutput` (pendiente) | [07-componentes-avanzados](studio-internals/07-componentes-avanzados.md#70-thashinput-no-recibe-filas-de-thashoutput-pendiente) |
| 71. `tHDFSPut` en Windows: HDFS real en Docker, no el sistema de ficheros local | [07-componentes-avanzados](studio-internals/07-componentes-avanzados.md#71-thdfsput-en-windows-hdfs-real-en-docker-no-el-sistema-de-ficheros-local) |
