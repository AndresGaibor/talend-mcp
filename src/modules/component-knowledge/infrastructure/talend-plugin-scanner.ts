import * as fs from 'fs';
import * as path from 'path';
import { XMLParser } from 'fast-xml-parser';
import type { TalendComponentDefinition, ComponentConnector, ComponentParameter, ComponentSchemaDefinition } from '../domain/component-definition';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseAttributeValue: false,
  parseTagValue: false,
});

export type PluginScanResult = {
  pluginId: string;
  pluginPath: string;
  components: TalendComponentDefinition[];
  errors: string[];
};

export class TalendPluginScanner {
  async scanStudioPlugins(talendStudioPath: string): Promise<TalendComponentDefinition[]> {
    const pluginsPath = path.join(talendStudioPath, 'plugins');
    if (!fs.existsSync(pluginsPath)) {
      return [];
    }

    const components: TalendComponentDefinition[] = [];
    const pluginDirs = fs.readdirSync(pluginsPath).filter(d => d.startsWith('org.talend'));

    for (const pluginDir of pluginDirs) {
      const pluginPath = path.join(pluginsPath, pluginDir);
      const descriptorPath = path.join(pluginPath, 'descriptor.xml');
      
      if (fs.existsSync(descriptorPath)) {
        try {
          const parsed = await this.parseDescriptor(descriptorPath, pluginDir, pluginPath);
          components.push(...parsed);
        } catch (e) {
          console.warn(`Error parsing descriptor ${descriptorPath}: ${e}`);
        }
      }

      const componentsDir = path.join(pluginPath, 'components');
      if (fs.existsSync(componentsDir)) {
        try {
          const dirComponents = await this.scanComponentsDir(componentsDir, pluginDir, pluginPath);
          components.push(...dirComponents);
        } catch (e) {
          console.warn(`Error scanning components dir ${componentsDir}: ${e}`);
        }
      }
    }

    return this.dedupeComponents(components);
  }

  private async parseDescriptor(
    xmlPath: string,
    pluginId: string,
    pluginPath: string
  ): Promise<TalendComponentDefinition[]> {
    const xml = fs.readFileSync(xmlPath, 'utf-8');
    const parsed = xmlParser.parse(xml) as Record<string, unknown>;
    return this.extractComponentsFromDescriptor(parsed, pluginId, pluginPath, xmlPath);
  }

  private extractComponentsFromDescriptor(
    parsed: Record<string, unknown>,
    pluginId: string,
    pluginPath: string,
    descriptorPath: string
  ): TalendComponentDefinition[] {
    const components: TalendComponentDefinition[] = [];
    const scannedAt = new Date().toISOString();

    const catalog = parsed.CATALOG ?? parsed.catalog ?? {};
    const componentEntries = this.collectByKey(parsed, ['COMPONENT', 'component', 'COMPONENTS', 'components']);

    for (const entry of componentEntries) {
      if (!entry || typeof entry !== 'object') continue;
      const comp = entry as Record<string, unknown>;
 const header = (comp.HEADER ?? comp.header ?? {}) as Record<string, unknown>;
      const impl = (comp.IMPL ?? comp.impl ?? {}) as Record<string, unknown>;

      const name = String(header.NAME ?? header.name ?? '');
      if (!name) continue;

      const family = String(header.FAMILY ?? header.family ?? 'Unknown');
      const version = String(header.VERSION ?? header.version ?? '1.0');

      const parameters = this.extractParameters(comp);
      const connectors = this.extractConnectors(comp);
      const schemas = this.extractSchemas(comp, connectors);

      components.push({
        id: `${pluginId}:${name}`,
        name,
        family,
        paletteCategory: family,
        version,
        source: {
          pluginId,
          pluginPath,
          descriptorPath,
          scannedAt,
        },
        connectors,
        parameters,
        schemas,
        examples: [],
        commonUseCases: [],
        relatedComponents: [],
        warnings: [],
        confidence: 'high',
      });
    }

    return components;
  }

  private async scanComponentsDir(
    componentsDir: string,
    pluginId: string,
    pluginPath: string
  ): Promise<TalendComponentDefinition[]> {
    const components: TalendComponentDefinition[] = [];
    const scannedAt = new Date().toISOString();

    let entries: string[];
    try {
      entries = fs.readdirSync(componentsDir);
    } catch {
      return [];
    }

    for (const entry of entries) {
      const entryPath = path.join(componentsDir, entry);
      let stat: fs.Stats;
      try {
        stat = fs.statSync(entryPath);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        const xmlFiles = this.findComponentXmlFiles(entryPath);
        for (const xmlFile of xmlFiles) {
          try {
            const component = await this.parseComponentXmlFile(xmlFile, pluginId, pluginPath, scannedAt);
            if (component) {
              components.push(component);
            }
          } catch (e) {
            console.warn(`Error parsing component XML ${xmlFile}: ${e}`);
          }
        }
      } else if (entry.endsWith('.xml')) {
        try {
          const component = await this.parseComponentXmlFile(entryPath, pluginId, pluginPath, scannedAt);
          if (component) {
            components.push(component);
          }
        } catch (e) {
          console.warn(`Error parsing component XML ${entryPath}: ${e}`);
        }
      }
    }

    return components;
  }

  private findComponentXmlFiles(dirPath: string): string[] {
    const results: string[] = [];
    if (!fs.existsSync(dirPath)) return results;

    const entries = fs.readdirSync(dirPath);
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry);
      if (entry.endsWith('_java.xml') || entry.endsWith('.xml')) {
        results.push(fullPath);
      }
    }
    return results;
  }

  private async parseComponentXmlFile(
    xmlPath: string,
    pluginId: string,
    pluginPath: string,
    scannedAt: string
  ): Promise<TalendComponentDefinition | null> {
    const xml = fs.readFileSync(xmlPath, 'utf-8');
    const parsed = xmlParser.parse(xml) as Record<string, unknown>;

    const rawComponent = parsed.COMPONENT ?? parsed.component ?? {};
    const comp = rawComponent as Record<string, unknown>;
    const header = (comp.HEADER ?? comp.header ?? {}) as Record<string, unknown>;
    const impl = (comp.IMPL ?? comp.impl ?? {}) as Record<string, unknown>;

    const name = String(header.NAME ?? header.name ?? path.basename(xmlPath, '.xml'));
    if (!name) return null;

    const family = String(header.FAMILY ?? header.family ?? 'Unknown');
    const version = String(header.VERSION ?? header.version ?? '1.0');

    const parameters = this.extractParameters(comp);
    const connectors = this.extractConnectors(comp);
    const schemas = this.extractSchemas(comp, connectors);

    return {
      id: `${pluginId}:${name}`,
      name,
      family,
      paletteCategory: family,
      version,
      source: {
        pluginId,
        pluginPath,
        descriptorPath: xmlPath,
        scannedAt,
      },
      connectors,
      parameters,
      schemas,
      examples: [],
      commonUseCases: [],
      relatedComponents: [],
      warnings: [],
      confidence: 'high',
    };
  }

  private extractParameters(comp: Record<string, unknown>): ComponentParameter[] {
    const parameters: ComponentParameter[] = [];
    const paramEntries = this.collectByKey(comp, ['PARAMETER', 'parameter']);

    for (const p of paramEntries) {
      if (!p || typeof p !== 'object') continue;
      const pr = p as Record<string, unknown>;
      const pName = pr.NAME ?? pr.name ?? pr['@_name'] ?? '';
      if (!pName) continue;

      const field = String(pr.FIELD ?? pr.field ?? 'id_String');
      let type: ComponentParameter['type'] = 'unknown';
      if (field.includes('SCHEMA')) type = 'schema';
      else if (field.includes('FILE') || field.includes('PATH')) type = 'file';
      else if (field.includes('DIR') || field.includes('FOLDER')) type = 'directory';
      else if (field.includes('TABLE') || field.includes('DB')) type = 'table';
      else if (field.includes('CONNECTION')) type = 'connection';
      else if (field.includes('PASSWORD') || field.includes('SECRET')) type = 'password';
      else if (field.includes('BOOL')) type = 'boolean';
      else if (field.includes('INT') || field.includes('NUM') || field.includes('DOUBLE') || field.includes('FLOAT')) type = 'number';
      else type = 'string';

      parameters.push({
        name: String(pName),
        displayName: String(pr.DISPLAY_NAME ?? pr.displayName ?? pName),
        type,
        required: pr.REQUIRED === 'true' || pr.required === 'true' || pr['@_required'] === 'true',
        defaultValue: pr.DEFAULT ?? pr.defaultValue ?? pr['@_default'] ? String(pr.DEFAULT ?? pr.defaultValue ?? pr['@_default']) : undefined,
        possibleValues: undefined,
        category: 'basic',
        description: undefined,
        safeToEdit: true,
        riskLevel: 'low',
      });
    }

    return parameters;
  }

  private extractConnectors(comp: Record<string, unknown>): ComponentConnector[] {
    const connectors: ComponentConnector[] = [];
    const connEntries = this.collectByKey(comp, ['CONNECTOR', 'connector', 'CONNECTORS', 'connectors']);

    for (const c of connEntries) {
      if (!c || typeof c !== 'object') continue;
      const cr = c as Record<string, unknown>;
      const cName = cr.NAME ?? cr.name ?? 'FLOW';
      const cTypeRaw = (cr.TYPE ?? cr.type ?? 'FLOW') as string;
      const cType = String(cTypeRaw).toUpperCase();

      let connectorType: ComponentConnector['type'] = 'UNKNOWN';
      let direction: ComponentConnector['direction'] = 'output';

      if (cType === 'FLOW' || cType === 'FLOW_MAIN') {
        connectorType = 'FLOW_MAIN';
        direction = 'output';
      } else if (cType === 'ITERATE') {
        connectorType = 'ITERATE';
        direction = 'output';
      } else if (cType === 'ON_COMPONENT_OK') {
        connectorType = 'ON_COMPONENT_OK';
        direction = 'output';
      } else if (cType === 'ON_COMPONENT_ERROR') {
        connectorType = 'ON_COMPONENT_ERROR';
        direction = 'output';
      } else if (cType === 'RUN_IF') {
        connectorType = 'RUN_IF';
        direction = 'output';
      } else if (cType === 'LOOKUP') {
        connectorType = 'LOOKUP';
        direction = 'input';
      } else if (cType === 'REJECT') {
        connectorType = 'REJECT';
        direction = 'output';
      }

      connectors.push({
        name: String(cName),
        type: connectorType,
        direction,
        required: false,
        maxConnections: cr.MAX_CONNECTIONS ?? cr.maxConnections ? Number(cr.MAX_CONNECTIONS ?? cr.maxConnections) : undefined,
      });
    }

    return connectors;
  }

  private extractSchemas(comp: Record<string, unknown>, connectors: ComponentConnector[]): ComponentSchemaDefinition[] {
    const schemas: ComponentSchemaDefinition[] = [];

    const hasInput = connectors.some(c => c.type === 'LOOKUP' || c.direction === 'input');
    const hasOutput = connectors.some(c => c.type === 'FLOW_MAIN' || c.direction === 'output');

    if (hasInput) {
      schemas.push({
        name: 'InputSchema',
        type: 'input',
        schemaType: 'built-in',
        columns: [],
      });
    }

    if (hasOutput) {
      schemas.push({
        name: 'OutputSchema',
        type: 'output',
        schemaType: 'built-in',
        columns: [],
      });
    }

    return schemas;
  }

  private collectByKey(obj: unknown, keyNames: string[]): unknown[] {
    const found: unknown[] = [];

    function walk(value: unknown): void {
      if (!value || typeof value !== 'object') return;
      if (Array.isArray(value)) {
        for (const item of value) walk(item);
        return;
      }

      const record = value as Record<string, unknown>;
      for (const [key, child] of Object.entries(record)) {
        if (keyNames.includes(key)) {
          if (Array.isArray(child)) {
            found.push(...child);
          } else {
            found.push(child);
          }
        }
        walk(child);
      }
    }

    walk(obj);
    return found;
  }

  private dedupeComponents(components: TalendComponentDefinition[]): TalendComponentDefinition[] {
    const map = new Map<string, TalendComponentDefinition>();
    for (const comp of components) {
      if (!map.has(comp.id)) {
        map.set(comp.id, comp);
      }
    }
    return [...map.values()];
  }
}
