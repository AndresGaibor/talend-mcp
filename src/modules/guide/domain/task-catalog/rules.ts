import type { GuideRule } from "../guide.types";

const CRITERIO_APPLIES_TO = ["disenar-job", "crear-job", "editar-job", "migracion-masiva"];

/**
 * Reglas que evitan fallos silenciosos. Salen de las trampas documentadas en
 * `docs/GUIA-AGENTE.md` y `docs/TALEND-STUDIO-INTERNALS.md`.
 */
export const GUIDE_RULES: GuideRule[] = [
  {
    id: "no-escribir-xml",
    rule: "Edita en disco solo con las tools offline, y nunca un job abierto en un editor de Studio.",
    detail:
      "Las tools offline (talend_jobs_create_from_spec, talend_jobs_create_batch, talend_job_edit_offline, talend_jobs_edit_batch) generan el .item con el mismo modelo que Studio, validan la integridad y son atomicas. Escribir el XML a mano o con otra herramienta puede dejar tipos inexistentes (id_Decimal) o jobs vacios, y un job abierto en un editor se sobrescribe al guardar.",
  },
  {
    id: "valores-literales-java",
    rule: "Los valores de texto son literales Java y las rutas van entre comillas.",
    detail:
      "`\"C:/datos/a.csv\"` es valido; `C:/datos/a.csv` sin comillas no compila. El bridge entrecomilla lo que no es numero, booleano o ya viene entre comillas; `literal: true` fuerza el texto en crudo.",
  },
  {
    id: "header-numerico",
    rule: "`HEADER` de tFileInputDelimited es un numero de lineas, no un booleano.",
    detail: "Con cabecera se escribe `\"1\"`; sin cabecera, `\"0\"`.",
  },
  {
    id: "tipos-de-columna",
    rule: "`id_Decimal` no existe: usa `id_BigDecimal`.",
    detail:
      "Tipos validos: id_String, id_Integer, id_Long, id_Double, id_BigDecimal, id_Boolean, id_Date.",
  },
  {
    id: "schema-obligatorio",
    rule: "Sin schema no hay columnas y el codigo generado no compila.",
    detail:
      "Define el schema del origen antes de conectar. En tMap, tAggregateRow, tNormalize y tJavaRow el schema y el modelo se aplican al final, porque al conectar Studio propaga el schema del destino hacia atras.",
  },
  {
    id: "conector-real",
    rule: "Conecta con el conector real del componente, no siempre con FLOW.",
    detail:
      "`tUniqRow` saca las filas por `UNIQUE`; `tDBOutput` puede sacar rechazos por `REJECT`; un `ITERATE` no transporta filas. Conectar por `FLOW` donde no toca compila pero no pasa nada, sin error visible.",
  },
  {
    id: "triggers-desde-arranque",
    rule: "Dibuja los triggers desde el primer componente del subjob.",
    detail:
      "Studio solo genera la llamada al destino si la conexion sale del arranque del subjob. Si sale de un componente de en medio, el job compila y el destino no se ejecuta nunca.",
  },
  {
    id: "triggers-destino",
    rule: "El destino de un trigger tiene que poder arrancar un subjob.",
    detail:
      "Un trigger no puede apuntar a tDBOutput, tFileOutputDelimited ni tLogRow: necesitan entrada y Studio rechaza la conexion.",
  },
  {
    id: "listas-sin-comillas",
    rule: "Los parametros de tipo lista van sin comillas.",
    detail:
      "Si el tipo acaba en `_LIST` (TABLE_ACTION de tDBOutput, columna de tNormalize...), escribe `TRUNCATE`, no `\"TRUNCATE\"`: con comillas la accion no se ejecuta y no hay error.",
  },
  {
    id: "columnas-de-tabla",
    rule: "En las tablas de metadata, los nombres de columna van sin comillas y los literales con comillas.",
    detail:
      "Sin comillas: SCHEMA_COLUMN, COLNAME, INPUT_COLUMN, OUTPUT_COLUMN, FUNCTION, OPERATOR, SORT, ORDER, KEY_ATTRIBUTE, CASE_SENSITIVE, PARAMETER_NAME, TARGET_COLUMN. El resto, como literal Java.",
  },
  {
    id: "db-autocommit",
    rule: "Al escribir en base de datos, la conexion va con AUTO_COMMIT=true y no se encola un commit.",
    detail:
      "El tDBOutput escribe el lote al final; sin commit, al cerrar la conexion se pierde todo. Un commit encolado se ejecuta dentro del bucle de filas y rompe el lote.",
  },
  {
    id: "db-nombre-columna",
    rule: "Revisa el nombre original de la columna en el mapeo del tDBOutput.",
    detail:
      "Si el INSERT sale con columnas `null`, el mapeo no lleva el nombre de la columna en la base de datos.",
  },
  {
    id: "tlogrow-hereda",
    rule: "`tLogRow` hereda el schema: no se lo pongas a mano.",
    detail: "Su schema lo propaga el componente que le manda el flujo.",
  },
  {
    id: "tfilelist-globalmap",
    rule: "`tFileList` no emite filas; deja valores en el globalMap.",
    detail:
      "Se declara suelto y sus valores se leen con un tJavaRow desde `<uniqueName>_CURRENT_FILE`. Su `LIST_MODE` es el tipo de listado (FILES, DIRECTORIES, BOTH), no el orden.",
  },
  {
    id: "no-ejecutar-compilando",
    rule: "No ejecutes un job mientras Studio lo esta compilando.",
    detail:
      "Studio carga el job en su JVM y bloquea el classpath.jar; el build siguiente falla al borrarlo y la carpeta se queda sin codigo.",
  },
  {
    id: "contextos-por-entorno",
    rule: "Todos los entornos de un contexto tienen las mismas variables; cambian solo los valores.",
    detail:
      "Si Dev define `RUTA_ENTRADA` y Prod define `RUTA_ENTRADA_PROD`, el job no encuentra la variable al cambiar de entorno y falla en ejecucion. Usa el mismo nombre en todos los entornos y cambia solo el valor.",
  },
  {
    id: "inventario-primero",
    rule: "Antes de crear o editar, mira que hay en el proyecto (`talend_project_profile`, o las tools de lectura si no esta disponible).",
    detail:
      "Un job nuevo sin mirar el proyecto suele duplicar un contexto o una conexion que ya existe. Revisa jobs, contextos, conexiones y esquemas antes de escribir nada.",
    appliesTo: CRITERIO_APPLIES_TO,
  },
  {
    id: "reutilizar-antes-de-crear",
    rule: "Si ya existe un job, joblet, contexto, conexion o esquema que sirve, usalo o extiendelo; no lo dupliques.",
    detail:
      "Dos jobs con la misma conexion a base de datos y dos contextos con variables casi iguales se desincronizan con el tiempo. Si la conexion del proyecto sirve, referenciala; si falta un campo, extiende el existente.",
    appliesTo: CRITERIO_APPLIES_TO,
  },
  {
    id: "contexto-de-proyecto",
    rule: "Rutas, hosts, usuarios y credenciales van en variables de contexto, nunca como literales en un componente.",
    detail:
      "Un `\"C:/datos/entrada.csv\"` escrito en un tFileInputDelimited obliga a editar el job al pasar a produccion. Con una variable de contexto basta con cambiar el valor del entorno.",
    appliesTo: CRITERIO_APPLIES_TO,
  },
  {
    id: "conexion-de-repositorio",
    rule: "Si el repositorio ya tiene la conexion o el esquema, referencialo (`talend_job_assign_repository_schema`) en vez de repetir su configuracion.",
    detail:
      "Repetir host, puerto y esquema en cada componente hace que un cambio de servidor deba aplicarse en decenas de sitios. Un componente ligado al repositorio se actualiza en un solo lugar.",
    appliesTo: CRITERIO_APPLIES_TO,
  },
  {
    id: "nombres-del-proyecto",
    rule: "Usa el prefijo, la carpeta y el formato de nombre que ya dominan en el proyecto; no inventes otro.",
    detail:
      "Si el proyecto usa `ETL_` y carpetas por area, un job `prueba2` fuera de esa convencion se pierde en el arbol y rompe los filtros del equipo. Antes de nombrar, mira los nombres de los jobs existentes.",
    appliesTo: CRITERIO_APPLIES_TO,
  },
  {
    id: "un-job-una-responsabilidad",
    rule: "Un job hace una cosa; separa extraer, transformar y cargar cuando la logica crece y orquesta con un padre.",
    detail:
      "Un job que lee, transforma, valida y carga en un solo lienzo es dificil de depurar y de reutilizar. Separarlo en un job por etapa y un padre que las llame con tRunJob deja cada fallo localizado.",
    appliesTo: CRITERIO_APPLIES_TO,
  },
  {
    id: "logica-comun-en-hijo",
    rule: "Lo que se repite en dos o mas jobs va a un job hijo (`tRunJob`) o a un joblet que ya exista; no fabriques joblets a mano.",
    detail:
      "Si dos jobs validan el mismo fichero con los mismos componentes, copiar el bloque obliga a corregir el error dos veces. Un hijo llamado con tRunJob, o un joblet ya existente, guarda la logica en un sitio.",
    appliesTo: CRITERIO_APPLIES_TO,
  },
  {
    id: "control-de-errores",
    rule: "Maneja errores como lo hace el proyecto (triggers `OnSubjobError`/`OnComponentError`, `tDie`, `tLogCatcher`); un job sin ruta de error no esta terminado.",
    detail:
      "Un job sin ruta de error falla sin dejar rastro y el padre sigue como si nada. Conecta OnSubjobError u OnComponentError al registro de errores del proyecto, o a un tDie cuando el fallo debe parar la cadena.",
    appliesTo: CRITERIO_APPLIES_TO,
  },
  {
    id: "sin-componentes-huerfanos",
    rule: "Todo componente queda conectado y los `tLogRow` de depuracion no se entregan.",
    detail:
      "Un componente sin conexion compila, pero no hace nada y confunde al siguiente que lea el job. Un tLogRow de depuracion dejado en produccion imprime cada fila en el log del servidor.",
    appliesTo: CRITERIO_APPLIES_TO,
  },
  {
    id: "esquemas-explicitos",
    rule: "Define los esquemas con tipos concretos; evita columnas dinamicas salvo necesidad real.",
    detail:
      "Un esquema con columnas dinamicas no deja que Studio valide los tipos y los errores aparecen en ejecucion, no al disenar. Declara cada columna con su tipo (id_String, id_Integer...) y usa dinamico solo si el origen cambia de forma.",
    appliesTo: CRITERIO_APPLIES_TO,
  },
  {
    id: "preguntar-huecos",
    rule: "Si falta un dato que cambia el resultado y no hay un valor razonable por defecto, pregunta al usuario, de una en una y con la opcion recomendada primero; no inventes rutas, credenciales ni nombres de base de datos.",
    detail:
      "Una ruta o una base de datos inventadas compilan y fallan solo en produccion, donde nadie espera el error. Pregunta el dato que falta, de uno en uno, y propone primero la opcion recomendada para que el usuario decida rapido.",
    appliesTo: CRITERIO_APPLIES_TO,
  },
  {
    id: "cambios-minimos-en-existentes",
    rule: "Al editar un job existente haz `dryRun`, revisa el diff y no renombres ni reordenes lo que no se pidio.",
    detail:
      "Renombrar o reordenar componentes de un job en uso cambia el nombre de sus columnas de salida y rompe a quien las lee. El dryRun muestra el diff antes de escribir y deja claro que solo cambio lo pedido.",
    appliesTo: CRITERIO_APPLIES_TO,
  },
  {
    id: "etiquetas-con-sentido",
    rule: "Ponle a cada componente una etiqueta que diga que hace (no `tMap_1`) y al job un proposito en su descripcion.",
    detail:
      "Un `tMap_1` no le dice nada al siguiente que abra el job, y un job sin descripcion no explica por que existe. Una etiqueta como `Unir clientes con pedidos` y una descripcion de una frase ahorran una lectura completa.",
    appliesTo: CRITERIO_APPLIES_TO,
  },
];
