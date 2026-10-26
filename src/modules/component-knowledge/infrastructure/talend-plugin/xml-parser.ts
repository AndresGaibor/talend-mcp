import { XMLParser } from "fast-xml-parser";

/** Parser compartido: conserva atributos y el nodo de texto tal como vienen. */
export const talendXmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  parseAttributeValue: false,
  parseTagValue: false,
});
