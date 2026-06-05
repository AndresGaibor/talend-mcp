import { BASE_CSS } from "./shared";

export function createDatasetInspectorProHtml(): string {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Dataset Inspector Pro</title>
    <style>
      :root { color-scheme: light dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
      body { margin: 0; background: #0b1220; color: #e5eefc; }
      .app { min-height: 100vh; padding: 24px; box-sizing: border-box; display: grid; gap: 20px; }
      .panel { background: rgba(11,18,32,.82); border: 1px solid rgba(148,163,184,.18); border-radius: 18px; padding: 18px; box-shadow: 0 24px 60px rgba(0,0,0,.28); }
      .header { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px; align-items: start; }
      .eyebrow { text-transform: uppercase; letter-spacing: .12em; font-size: 12px; color: #93c5fd; }
      h1 { margin: 4px 0 6px; font-size: 28px; }
      p { margin: 0; color: #cbd5e1; line-height: 1.5; }
      .form { display: grid; gap: 12px; margin-bottom: 16px; }
      .form-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
      label { font-size: 12px; color: #93c5fd; display: grid; gap: 6px; }
      input, select, button { font: inherit; }
      input, select { width: 100%; box-sizing: border-box; border-radius: 12px; border: 1px solid rgba(148,163,184,.24); background: rgba(2,6,23,.78); color: #e5eefc; padding: 12px; }
      select { cursor: pointer; }
      button { border: 0; border-radius: 12px; padding: 12px 14px; background: linear-gradient(135deg, #38bdf8, #6366f1); color: white; cursor: pointer; font-weight: 600; }
      button:hover { filter: brightness(1.05); }
      button.secondary { background: rgba(148,163,184,.2); }
      table { width: 100%; border-collapse: collapse; font-size: 13px; }
      th { text-align: left; padding: 10px 12px; border-bottom: 1px solid rgba(148,163,184,.2); color: #93c5fd; font-size: 11px; text-transform: uppercase; letter-spacing: .1em; }
      td { padding: 10px 12px; border-bottom: 1px solid rgba(148,163,184,.1); }
      tr:hover td { background: rgba(148,163,184,.05); }
      .mono { font-family: monospace; font-size: 12px; color: #94a3b8; }
      .tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; background: rgba(56,189,248,.15); color: #38bdf8; }
      .tag.green { background: rgba(52,211,153,.15); color: #34d399; }
      .tag.yellow { background: rgba(251,191,36,.15); color: #fbbf24; }
      .empty { color: #64748b; text-align: center; padding: 40px; }
      .result { white-space: pre-wrap; font-size: 13px; line-height: 1.5; color: #cbd5e1; }
      .tabs { display: flex; gap: 4px; margin-bottom: 16px; }
      .tab { padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 13px; background: transparent; color: #94a3b8; border: 1px solid transparent; }
      .tab.active { background: rgba(56,189,248,.15); color: #38bdf8; border-color: rgba(56,189,248,.3); }
      @media (max-width: 720px) { .header { flex-direction: column; } }
    </style>
  </head>
  <body>
    <main class="app">
      <section class="panel header">
        <div>
          <div class="eyebrow">MCP App</div>
          <h1>Dataset Inspector Pro</h1>
          <p>Inspección avanzada de datasets, tablas raw y esquemas.</p>
        </div>
      </section>

      <section class="panel">
        <div class="eyebrow">Configuración</div>
        <div class="form">
          <div class="form-row">
            <label>Folder path
              <input type="text" id="folderPath" placeholder="/data/csvs" value="/data/csvs" />
            </label>
            <label>Target schema
              <select id="targetSchema">
                <option value="raw">raw</option>
                <option value="stg">stg</option>
                <option value="audit">audit</option>
              </select>
            </label>
            <label>Naming strategy
              <select id="namingStrategy">
                <option value="file_name">file_name</option>
                <option value="strip_dataset_suffix">strip_dataset_suffix</option>
                <option value="snake_case">snake_case</option>
              </select>
            </label>
          </div>
          <div class="form-row">
            <label style="display:flex;align-items:center;gap:8px;">
              <input type="checkbox" id="forceStringTypes" checked /> Force string types
            </label>
            <label style="display:flex;align-items:center;gap:8px;">
              <input type="checkbox" id="addTechnicalColumns" checked /> Add technical columns (_load_ts, _load_run)
            </label>
          </div>
          <div style="display:flex;gap:12px;">
            <button onclick="inspectFolder()">Inspect folder</button>
            <button class="secondary" onclick="inferSchema()">Infer schema</button>
            <button class="secondary" onclick="generateMappings()">Generate mappings</button>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="tabs">
          <button class="tab active" onclick="showTab('csv')">CSV Files</button>
          <button class="tab" onclick="showTab('columns')">Columns</button>
          <button class="tab" onclick="showTab('mappings')">Mappings</button>
        </div>
        <div id="csv-table"></div>
        <div id="columns-table" style="display:none;"></div>
        <div id="mappings-table" style="display:none;"></div>
      </section>

      <section class="panel">
        <div class="eyebrow">Resultado</div>
        <div id="result" class="result">Ejecuta una acción para ver el resultado.</div>
      </section>
    </main>

    <script>
      let lastInspection = null;
      let lastMappings = null;

      function showTab(name) {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        event.target.classList.add('active');
        document.getElementById('csv-table').style.display = name === 'csv' ? 'block' : 'none';
        document.getElementById('columns-table').style.display = name === 'columns' ? 'block' : 'none';
        document.getElementById('mappings-table').style.display = name === 'mappings' ? 'block' : 'none';
      }

      function renderCsvTable(data) {
        if (!data?.files?.length) {
          document.getElementById('csv-table').innerHTML = '<div class="empty">No se encontraron archivos CSV</div>';
          return;
        }
        document.getElementById('csv-table').innerHTML = \`<table>
          <thead><tr><th>Archivo</th><th>Columnas</th><th>Filas</th><th>Delimitador</th></tr></thead>
          <tbody>
            \${data.files.map(f => \`<tr>
              <td class="mono">\${f.relativePath}</td>
              <td>\${f.columns?.length ?? 0}</td>
              <td>\${f.rowCount?.toLocaleString() ?? 'N/A'}</td>
              <td><span class="tag">\${f.delimiter}</span></td>
            </tr>\`).join('')}
          </tbody>
        </table>\`;
      }

      function renderColumnsTable(data) {
        if (!lastInspection?.files?.length) {
          document.getElementById('columns-table').innerHTML = '<div class="empty">Primero ejecuta Inspect folder</div>';
          return;
        }
        const cols = lastInspection.files[0]?.columns ?? [];
        document.getElementById('columns-table').innerHTML = \`<table>
          <thead><tr><th>Nombre</th><th>Tipo</th><th>Nullable</th><th>Valores únicos</th></tr></thead>
          <tbody>
            \${cols.map(c => \`<tr>
              <td class="mono">\${c.name}</td>
              <td><span class="tag \${c.inferredType === 'string' ? '' : c.inferredType === 'number' ? 'green' : 'yellow'}">\${c.inferredType}</span></td>
              <td>\${c.nullable ? '✓' : '✗'}</td>
              <td>\${c.distinctCount?.toLocaleString() ?? 'N/A'}</td>
            </tr>\`).join('')}
          </tbody>
        </table>\`;
      }

      function renderMappingsTable(data) {
        if (!lastMappings?.mappings?.length) {
          document.getElementById('mappings-table').innerHTML = '<div class="empty">Primero ejecuta Generate mappings</div>';
          return;
        }
        document.getElementById('mappings-table').innerHTML = \`<table>
          <thead><tr><th>Tabla</th><th>Archivo</th><th>Columnas</th><th>Técnicas</th></tr></thead>
          <tbody>
            \${lastMappings.mappings.map(m => \`<tr>
              <td class="mono">\${m.targetTable}</td>
              <td class="mono">\${m.csvFile}</td>
              <td>\${m.columns?.length ?? 0}</td>
              <td>\${m.technicalColumns?.length ?? 0}</td>
            </tr>\`).join('')}
          </tbody>
        </table>\`;
      }

      function setResult(text, data) {
        document.getElementById('result').textContent = text;
        if (data?.files) { lastInspection = data; renderCsvTable(data); }
        if (data?.mappings) { lastMappings = data; renderMappingsTable(data); }
      }

      async function callTool(name, payload) {
        if (!window.openai || typeof window.openai.callTool !== "function") {
          throw new Error("window.openai.callTool no disponible");
        }
        return await window.openai.callTool(name, payload);
      }

      async function inspectFolder() {
        try {
          const folderPath = document.getElementById('folderPath').value;
          const response = await callTool('talend_datasets_inspect_csv_folder', { folderPath });
          const data = response?.structuredContent?.data ?? response?.data ?? response;
          setResult(\`Carpeta inspeccionada: \${data?.files?.length ?? 0} archivos CSV encontrados\`, data);
          renderCsvTable(data);
          renderColumnsTable(data);
        } catch (err) {
          document.getElementById('result').textContent = 'Error: ' + err.message;
        }
      }

      async function inferSchema() {
        try {
          const folderPath = document.getElementById('folderPath').value;
          const response = await callTool('talend_datasets_infer_csv_schema', { folderPath });
          const data = response?.structuredContent?.data ?? response?.data ?? response;
          document.getElementById('result').textContent = JSON.stringify(data, null, 2);
        } catch (err) {
          document.getElementById('result').textContent = 'Error: ' + err.message;
        }
      }

      async function generateMappings() {
        try {
          const folderPath = document.getElementById('folderPath').value;
          const targetSchema = document.getElementById('targetSchema').value;
          const namingStrategy = document.getElementById('namingStrategy').value;
          const forceStringTypes = document.getElementById('forceStringTypes').checked;
          const addTechnicalColumns = document.getElementById('addTechnicalColumns').checked;
          const response = await callTool('talend_datasets_generate_raw_mappings', {
            folderPath, targetSchema, namingStrategy, forceStringTypes, addTechnicalColumns
          });
          const data = response?.structuredContent?.data ?? response?.data ?? response;
          setResult(\`Mappings generados: \${data?.mappings?.length ?? 0} tablas\`, data);
          renderMappingsTable(data);
        } catch (err) {
          document.getElementById('result').textContent = 'Error: ' + err.message;
        }
      }
    </script>
  </body>
</html>`;
}
