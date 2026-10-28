import { expect, test } from "bun:test";
import { prefijosSinDeclarar } from "../../src/talend/job-batch/xml-valido";

test("un XML que declara los prefijos que usa no tiene problemas", () => {
  const xml = '<a:Raiz xmlns:a="x" xmlns:xsi="y"><hijo xsi:type="Z"/></a:Raiz>';

  expect(prefijosSinDeclarar(xml)).toEqual([]);
});

test("un prefijo usado en un elemento o en un atributo y no declarado se detecta", () => {
  expect(prefijosSinDeclarar('<Raiz xmlns:a="x"><hijo xsi:type="Z"/></Raiz>')).toEqual(["xsi"]);
  expect(prefijosSinDeclarar('<Raiz xmlns:a="x"><TalendMapper:nodo/></Raiz>')).toEqual(["TalendMapper"]);
});

test("xml y xmlns son prefijos reservados y no se piden", () => {
  expect(prefijosSinDeclarar('<Raiz xml:lang="es" xmlns:a="x"/>')).toEqual([]);
});

test("un texto con dos puntos dentro de un valor no se confunde con un prefijo", () => {
  expect(prefijosSinDeclarar('<Raiz xmlns:a="x" ruta="C:/datos/x.csv" hora="10:30"/>')).toEqual([]);
});
