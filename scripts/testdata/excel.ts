import { writeZip } from "./zip";

/**
 * XLSX minimo: dos hojas, celdas combinadas, numeros guardados como texto.
 *
 * Se arma el XML a mano y se empaqueta con `writeZip`: alcanza para probar la
 * lectura de Excel sin agregar una dependencia.
 */

function escXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function cell(ref: string, value: string | number, asText: boolean): string {
  if (asText) {
    return `<c r="${ref}" t="inlineStr"><is><t>${escXml(String(value))}</t></is></c>`;
  }
  if (typeof value === "number") {
    return `<c r="${ref}"><v>${value}</v></c>`;
  }
  return `<c r="${ref}" t="inlineStr"><is><t>${escXml(value)}</t></is></c>`;
}

function columnName(index: number): string {
  let name = "";
  let n = index;
  while (n > 0) {
    const rest = (n - 1) % 26;
    name = String.fromCharCode(65 + rest) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

function sheetXml(rows: Array<Array<string | number>>, asTextColumns: number[], merges: string[]): string {
  const sheetRows = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((value, colIndex) => cell(`${columnName(colIndex + 1)}${rowIndex + 1}`, value, asTextColumns.includes(colIndex)))
        .join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");

  const mergeBlock = merges.length
    ? `<mergeCells count="${merges.length}">${merges.map((ref) => `<mergeCell ref="${ref}"/>`).join("")}</mergeCells>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData>${mergeBlock}</worksheet>`;
}

/** Libro de dos hojas: Productos (con celdas combinadas) y Ventas. */
export function productosXlsx(): Uint8Array {
  const hoja1: Array<Array<string | number>> = [
    [],
    [],
    ["codigo", "nombre", "precio", "cantidad", "categoria"],
    ["P001", "Widget basico", "19.99", 100, "general"],
    ["P002", "Widget premium", "149.50", 25, "general"],
    ["P003", "Servicio anual", "999.00", 5, "servicios"],
  ];
  // merged: A2:C2 (encabezado desplazado a la fila 3 con A2:C2 combinado)
  const hoja1Xml = sheetXml(hoja1, [2], ["A2:C2"]);

  const hoja2: Array<Array<string | number>> = [
    ["region", "ventas_2023", "ventas_2024"],
    ["NORTE", 1200.5, 1500.75],
    ["CENTRO", 800, 950.25],
    ["SUR", 640.75, 720],
  ];
  const hoja2Xml = sheetXml(hoja2, [], []);

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Productos" sheetId="1" r:id="rId1"/><sheet name="Ventas" sheetId="2" r:id="rId2"/></sheets></workbook>`;

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/></Relationships>`;

  const encoder = new TextEncoder();
  return writeZip([
    { path: "[Content_Types].xml", data: encoder.encode(contentTypes) },
    { path: "_rels/.rels", data: encoder.encode(rootRels) },
    { path: "xl/workbook.xml", data: encoder.encode(workbook) },
    { path: "xl/_rels/workbook.xml.rels", data: encoder.encode(workbookRels) },
    { path: "xl/worksheets/sheet1.xml", data: encoder.encode(hoja1Xml) },
    { path: "xl/worksheets/sheet2.xml", data: encoder.encode(hoja2Xml) },
  ]);
}
