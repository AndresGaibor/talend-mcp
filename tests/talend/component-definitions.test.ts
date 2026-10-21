import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseDefinitionXml } from "../../src/modules/component-definitions/infrastructure/definition-xml.parser";
import {
  evaluateCondition,
  planMount,
  planRequiredParameters,
} from "../../src/modules/component-definitions/application/plan-required-parameters.use-case";
import { DefinitionIndexRepository } from "../../src/modules/component-definitions/infrastructure/definition-index.repository";
import { GetComponentDefinitionsUseCase } from "../../src/modules/component-definitions/application/get-component-definitions.use-case";

const CONTEXTO = {
  name: "tEjemplo",
  pluginId: "org.talend.designer.components.localprovider_1.0",
  palette: "DI" as const,
  definitionPath: "C:/talend/plugins/tEjemplo/tEjemplo_java.xml",
};

/** Un XML de componente con los rasgos que hay que leer bien. */
const XML_EJEMPLO = `<COMPONENT>
  <HEADER PLATEFORM="ALL" VERSION="0.101" STARTABLE="false"/>
  <FAMILIES>
    <FAMILY>File/Output</FAMILY>
    <FAMILY>Big Data/Cassandra</FAMILY>
  </FAMILIES>
  <CONNECTORS>
    <CONNECTOR CTYPE="FLOW" MAX_INPUT="1" MAX_OUTPUT="1"/>
    <CONNECTOR NAME="REJECT" CTYPE="FLOW" MAX_INPUT="0" MAX_OUTPUT="1"/>
    <CONNECTOR CTYPE="ITERATE" MAX_OUTPUT="1" MAX_INPUT="1"/>
    <CONNECTOR CTYPE="SUBJOB_OK" MAX_INPUT="1"/>
    <CONNECTOR CTYPE="COMPONENT_OK"/>
  </CONNECTORS>
  <PARAMETERS>
    <PARAMETER NAME="PROPERTY" FIELD="PROPERTY_TYPE" SHOW="true"/>
    <PARAMETER NAME="USESTREAM" FIELD="CHECK"><DEFAULT>false</DEFAULT></PARAMETER>
    <PARAMETER NAME="FILENAME" FIELD="FILE" REQUIRED="true" NOT_SHOW_IF="USESTREAM=='true'">
      <DEFAULT>"__COMP_DEFAULT_FILE_DIR__/out.csv"</DEFAULT>
    </PARAMETER>
    <PARAMETER NAME="SEPARATOR" FIELD="TEXT" REQUIRED="true"><DEFAULT>";"</DEFAULT></PARAMETER>
    <PARAMETER NAME="SPLIT_EVERY" FIELD="TEXT" REQUIRED="true" SHOW_IF="(SPLIT == 'true')">
      <DEFAULT>1000</DEFAULT>
    </PARAMETER>
    <PARAMETER NAME="CSVROWSEPARATOR" FIELD="OPENED_LIST">
      <ITEMS DEFAULT="LF"><ITEM NAME="LF" VALUE="&quot;\\n&quot;"/></ITEMS>
    </PARAMETER>
    <PARAMETER NAME="OCULTO" FIELD="TEXT" REQUIRED="true" SHOW="false"/>
  </PARAMETERS>
  <ADVANCED_PARAMETERS>
    <PARAMETER NAME="ENCODING" FIELD="ENCODING_TYPE" REQUIRED="true"><DEFAULT>"ISO-8859-15"</DEFAULT></PARAMETER>
  </ADVANCED_PARAMETERS>
  <CODEGENERATION>
    <IMPORTS>
      <IMPORT NAME="Talend_CSV" MODULE="talendcsv-1.1.0.jar" MVN="mvn:org.talend.components/talendcsv/1.1.0" REQUIRED="true"/>
    </IMPORTS>
  </CODEGENERATION>
  <RETURNS><RETURN NAME="NB_LINE" TYPE="id_Integer" AVAILABILITY="AFTER"/></RETURNS>
</COMPONENT>`;

describe("Definiciones de componentes (XML de Studio)", () => {
  test("lee los parametros con su obligatoriedad y su valor por defecto", () => {
    const definition = parseDefinitionXml(XML_EJEMPLO, CONTEXTO);
    expect(definition).not.toBeNull();

    const porNombre = new Map(definition!.parameters.map((p) => [p.name, p]));
    // El valor por defecto viene como elemento hijo, no como atributo.
    expect(porNombre.get("USESTREAM")?.defaultValue).toBe("false");
    expect(porNombre.get("SEPARATOR")?.defaultValue).toBe('";"');
    // Los obligatorios son los que llevan REQUIRED="true".
    expect(porNombre.get("FILENAME")?.required).toBe(true);
    expect(porNombre.get("PROPERTY")?.required).toBe(false);
    // SHOW="false" deja el parametro fuera del formulario.
    expect(porNombre.get("OCULTO")?.show).toBe(false);
    // Los de ajustes avanzados van marcados.
    expect(porNombre.get("ENCODING")?.advanced).toBe(true);
    expect(porNombre.get("FILENAME")?.advanced).toBe(false);
    // La condicion de visibilidad se guarda tal cual.
    expect(porNombre.get("FILENAME")?.notShowIf).toBe("USESTREAM=='true'");
    expect(porNombre.get("SPLIT_EVERY")?.showIf).toBe("(SPLIT == 'true')");
  });

  test("lee los conectores con su nombre y sus limites", () => {
    const definition = parseDefinitionXml(XML_EJEMPLO, CONTEXTO)!;
    const flujo = definition.connectors.find((c) => c.name === "FLOW");
    expect(flujo?.type).toBe("FLOW");
    expect(flujo?.maxInput).toBe(1);
    // El conector de rechazo tiene nombre propio aunque su tipo sea FLOW.
    expect(definition.connectors.some((c) => c.name === "REJECT")).toBe(true);
    expect(definition.connectors.some((c) => c.name === "SUBJOB_OK")).toBe(true);
  });

  test("lee familias, artefactos y columnas de retorno", () => {
    const definition = parseDefinitionXml(XML_EJEMPLO, CONTEXTO)!;
    expect(definition.family).toBe("File/Output");
    expect(definition.families).toEqual(["File/Output", "Big Data/Cassandra"]);
    expect(definition.imports[0]?.mvn).toBe("mvn:org.talend.components/talendcsv/1.1.0");
    expect(definition.imports[0]?.required).toBe(true);
    expect(definition.returns[0]).toEqual({
      name: "NB_LINE",
      type: "id_Integer",
      availability: "AFTER",
    });
  });

  test("devuelve null si el XML no es una definicion de componente", () => {
    expect(parseDefinitionXml("<OTRO><DATO>1</DATO></OTRO>", CONTEXTO)).toBeNull();
  });
});

describe("Plan de relleno de los parametros obligatorios", () => {
  const definition = parseDefinitionXml(XML_EJEMPLO, CONTEXTO)!;

  test("propone un valor para lo que se puede y explica lo que no", () => {
    const plan = planRequiredParameters(definition);
    const porNombre = new Map(
      plan.parameters
        .filter((item) => item.kind === "value")
        .map((item) => [item.name, item as Extract<typeof item, { kind: "value" }>]),
    );

    // Un FILE con macro de Talend recibe una ruta de pruebas.
    expect(porNombre.get("FILENAME")?.value).toContain("mcp_coverage");
    expect(porNombre.get("FILENAME")?.literal).toBe(true);
    // Un valor por defecto se respeta tal cual.
    expect(porNombre.get("SEPARATOR")?.value).toBe('";"');
    expect(porNombre.get("SEPARATOR")?.literal).toBe(false);

    const omitidos = new Map(plan.skipped.map((p) => [p.name, p.reason]));
    expect(omitidos.get("OCULTO")).toContain("oculto");
    // Un parametro cuya condicion no se puede decidir (SPLIT no se conoce)
    // se rellena con su valor por defecto: es inofensivo.
    expect(porNombre.get("SPLIT_EVERY")?.value).toBe("1000");
  });

  test("evalua las condiciones de visibilidad de Talend", () => {
    expect(evaluateCondition("USESTREAM=='true'", { USESTREAM: "false" })).toBe(false);
    expect(evaluateCondition("USESTREAM=='true'", { USESTREAM: "true" })).toBe(true);
    expect(evaluateCondition("USESTREAM!='true'", { USESTREAM: "false" })).toBe(true);
    expect(
      evaluateCondition("(A=='x') and (B=='y')", { A: "x", B: "y" }),
    ).toBe(true);
    expect(
      evaluateCondition("(A=='x') or (B=='y')", { A: "z", B: "y" }),
    ).toBe(true);
    // Si falta el valor, no se puede decidir.
    expect(evaluateCondition("DESCONOCIDO=='x'", {})).toBeNull();
  });

  test("el plan de montaje dice si el componente necesita un origen", () => {
    const plan = planMount(definition);
    // El conector FLOW de entrada permite consumir: hace falta un origen.
    expect(plan.source).toBe(true);
    const planned = plan.parameters.FILENAME;
    expect(planned && "literal" in planned ? planned.literal : false).toBe(true);
  });
});

describe("Indice de definiciones de la instalacion de Studio", () => {
  test("recorre los plugins y encuentra los componentes", async () => {
    const raiz = mkdtempSync(join(tmpdir(), "talend-definitions-"));
    try {
      const plugins = join(raiz, "plugins");
      const componente = join(
        plugins,
        "org.talend.designer.components.localprovider_1.0",
        "components",
        "tEjemplo",
      );
      mkdirSync(componente, { recursive: true });
      writeFileSync(join(componente, "tEjemplo_java.xml"), XML_EJEMPLO);

      const repositorio = new DefinitionIndexRepository({
        pluginsDir: plugins,
        cacheDir: join(raiz, "cache"),
      });
      const indice = await repositorio.load();
      expect(indice.components).toHaveLength(1);
      expect(indice.components[0]?.name).toBe("tEjemplo");
      expect(indice.components[0]?.palette).toBe("DI");

      const casoDeUso = new GetComponentDefinitionsUseCase(repositorio);
      const definicion = await casoDeUso.get("tEjemplo");
      expect(definicion?.requiredParameters.length).toBeGreaterThan(0);
      expect(definicion?.plan.parameters.some((p) => p.name === "FILENAME")).toBe(true);

      const resumen = await casoDeUso.summary();
      expect(resumen.total).toBe(1);
      expect(resumen.byPalette.DI).toBe(1);
    } finally {
      rmSync(raiz, { recursive: true, force: true });
    }
  });
});
