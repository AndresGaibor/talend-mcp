import type { GuideRule } from "../guide.types";

/**
 * Reglas que evitan fallos silenciosos. Salen de las trampas documentadas en
 * `docs/GUIA-AGENTE.md` y `docs/TALEND-STUDIO-INTERNALS.md`.
 */
export const GUIDE_RULES: GuideRule[] = [
  {
    id: "no-escribir-xml",
    rule: "Crea y edita jobs con la API de Studio, nunca escribiendo el .item.",
    detail:
      "Escribir el XML por fuera deja el modelo en memoria de Studio obsoleto: aparecen tipos inexistentes (id_Decimal), valores corruptos y jobs vacios.",
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
    rule: "Cada entorno tiene su propio valor de la misma variable de contexto.",
    detail: "No dupliques variables con nombres distintos por entorno; usa el mismo nombre y cambia el valor.",
  },
];
