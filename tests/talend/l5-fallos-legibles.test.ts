import { describe, expect, test } from "bun:test";
import { borradoTolerable } from "../../scripts/l5/job-mounter";
import { causaDeFallo } from "../../scripts/l5/studio-execute";

describe("borradoTolerable", () => {
  test("un job que no existe todavia no es un fallo", () => {
    expect(borradoTolerable("No existe el job 'MCP_L5_Nuevo' en el proyecto")).toBe(true);
    expect(borradoTolerable("No se encontro el job")).toBe(true);
  });

  test("un job abierto o un fallo de Studio no se tragan", () => {
    expect(borradoTolerable("No se pudo abrir el job: el editor esta ocupado")).toBe(false);
    expect(borradoTolerable("ECONNREFUSED: Unable to connect")).toBe(false);
  });
});

describe("causaDeFallo", () => {
  test("elige la linea [FATAL] y no los avisos [WARN] que vienen antes", () => {
    const lineas = [
      "[WARN ] 14:30:28 org.apache.hadoop.util.Shell- Did not find winutils.exe: java.io.FileNotFoundException",
      "[WARN ] 14:30:28 org.apache.hadoop.util.NativeCodeLoader- Unable to load native-hadoop library",
      "[FATAL] 14:30:28 prj_bancolombia.mcp_l5_hdfsput_0_1.MCP_L5_HdfsPut- tHDFSPut_2 java.io.FileNotFoundException: HADOOP_HOME and hadoop.home.dir are unset.",
    ];

    expect(causaDeFallo(lineas)).toContain("[FATAL]");
    expect(causaDeFallo(lineas)).toContain("HADOOP_HOME");
  });

  test("con una cadena de causas, toma la ultima (la raiz)", () => {
    const lineas = [
      "[FATAL] 15:59:21 MCP_L5_SQSOutput- tSQSOutput_2 (java.lang.ExceptionInInitializerError) null",
      "Caused by: java.lang.IllegalStateException: no hay region configurada",
      "Caused by: software.amazon.awssdk.core.exception.SdkClientException: Unable to load region from any of the providers",
    ];

    expect(causaDeFallo(lineas)).toBe(
      "Caused by: software.amazon.awssdk.core.exception.SdkClientException: Unable to load region from any of the providers",
    );
  });

  test("sin [FATAL] ni [ERROR], cae en la ultima linea", () => {
    expect(causaDeFallo(["aviso uno", "aviso dos"])).toBe("aviso dos");
  });

  test("sin salida lo dice", () => {
    expect(causaDeFallo([])).toBe("sin salida");
  });

  test("una causa muy larga se corta a 300 caracteres", () => {
    expect(causaDeFallo([`[ERROR] ${"x".repeat(500)}`]).length).toBe(300);
  });
});
