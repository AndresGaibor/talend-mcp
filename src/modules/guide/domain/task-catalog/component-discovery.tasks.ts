import type { GuideTask } from "../guide.types";

/** Tareas para descubrir y configurar componentes. */
export const COMPONENT_DISCOVERY_TASKS: GuideTask[] = [
  {
    id: "descubrir-componentes",
    title: "Descubrir como se configura un componente",
    goal: "Saber que parametros, tablas, conectores y schema tiene un componente antes de usarlo.",
    whenToUse: "Antes de anadir o configurar un nodo, sobre todo si el componente no lo conoces.",
    requires: [],
    aliases: ["componente", "parametros", "conector", "paleta", "que componentes hay", "tmap"],
    steps: [
      {
        tool: "talend_components_search",
        purpose: "Buscar componentes por nombre o familia en el catalogo local.",
        input: { query: "aggregate" },
      },
      {
        tool: "talend_components_definition",
        purpose: "Leer del XML de la instalacion los parametros obligatorios y las conexiones. Sin abrir Studio.",
        input: { name: "tAggregateRow" },
      },
      {
        tool: "talend_components_parameters",
        purpose: "Ver los parametros con tipo y valor por defecto.",
        input: { componentName: "tAggregateRow" },
      },
      {
        tool: "talend_components_connectors",
        purpose: "Listar los conectores de salida reales del componente.",
        input: { componentName: "tUniqRow" },
      },
      {
        tool: "talend_studio_component_parameters",
        purpose: "Cuando el componente no tiene XML (AWS, JDBC, Snowflake), preguntale al catalogo de Studio.",
        input: { name: "tDBOutput" },
        optional: true,
      },
      {
        tool: "talend_recipe_generate",
        purpose: "Pedir una receta de componentes y conexiones a partir de un objetivo en lenguaje natural.",
        input: { objective: "leer un CSV y cargarlo en una tabla" },
        optional: true,
      },
    ],
    pitfalls: [
      "El catalogo distingue variantes DI, Spark y Streaming: una variante Spark no vale en un job Standard.",
      "No inventes nombres de parametro: si el catalogo no lo declara, el bridge lo crea con el tipo que deduzca y puede quedar mal.",
    ],
    doneWhen: "Tienes la lista de parametros obligatorios y los conectores del componente.",
  },
];
