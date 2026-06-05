import { BASE_CSS } from "./shared";

export function createPipelineSpecEditorHtml(): string {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Pipeline Spec Editor</title>
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
      input, select, textarea, button { font: inherit; }
      input, select, textarea { width: 100%; box-sizing: border-box; border-radius: 12px; border: 1px solid rgba(148,163,184,.24); background: rgba(2,6,23,.78); color: #e5eefc; padding: 12px; }
      textarea { min-height: 300px; resize: vertical; font-family: monospace; font-size: 13px; }
      select { cursor: pointer; }
      button { border: 0; border-radius: 12px; padding: 12px 14px; background: linear-gradient(135deg, #38bdf8, #6366f1); color: white; cursor: pointer; font-weight: 600; }
      button:hover { filter: brightness(1.05); }
      button.secondary { background: rgba(148,163,184,.2); }
      button.danger { background: linear-gradient(135deg, #f87171, #dc2626); }
      .split { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
      .result { white-space: pre-wrap; font-size: 13px; line-height: 1.5; color: #cbd5e1; max-height: 400px; overflow-y: auto; }
      .tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; background: rgba(56,189,248,.15); color: #38bdf8; }
      .tag.green { background: rgba(52,211,153,.15); color: #34d399; }
      .tag.yellow { background: rgba(251,191,36,.15); color: #fbbf24; }
      .tag.red { background: rgba(248,113,113,.15); color: #f87171; }
      .empty { color: #64748b; text-align: center; padding: 40px; }
      .preview-card { background: rgba(15,23,42,.62); border: 1px solid rgba(148,163,184,.1); border-radius: 12px; padding: 14px; margin-bottom: 8px; }
      .preview-card h4 { margin: 0 0 8px; font-size: 14px; }
      .preview-meta { display: flex; gap: 8px; flex-wrap: wrap; }
      @media (max-width: 720px) { .split { grid-template-columns: 1fr; } .header { flex-direction: column; } }
    </style>
  </head>
  <body>
    <main class="app">
      <section class="panel header">
        <div>
          <div class="eyebrow">MCP App</div>
          <h1>Pipeline Spec Editor</h1>
          <p>Editor de especificaciones para jobs y pipelines generados.</p>
        </div>
      </section>

      <section class="panel">
        <div class="form">
          <div class="form-row">
            <label>Pattern
              <select id="pattern">
                <option value="multi_csv_raw_loader">multi_csv_raw_loader</option>
                <option value="csv_to_db_with_audit_columns">csv_to_db_with_audit_columns</option>
                <option value="sql_orchestration_job">sql_orchestration_job</option>
                <option value="db_to_db_copy">db_to_db_copy</option>
                <option value="api_to_db_loader">api_to_db_loader</option>
                <option value="file_watcher_pipeline">file_watcher_pipeline</option>
              </select>
            </label>
            <label>Job name
              <input type="text" id="name" placeholder="my_job" value="new_job" />
            </label>
            <label>Input path (optional)
              <input type="text" id="inputPath" placeholder="/data/csvs" />
            </label>
            <label>Output table (optional)
              <input type="text" id="outputTable" placeholder="raw.my_table" />
            </label>
          </div>
          <div class="form-row">
            <label style="display:flex;align-items:center;gap:8px;">
              <input type="checkbox" id="auditColumns" checked /> Include audit columns
            </label>
            <label>Batch size
              <input type="number" id="batchSize" placeholder="10000" value="10000" />
            </label>
          </div>
          <div style="display:flex;gap:12px;flex-wrap:wrap;">
            <button onclick="validateSpec()">Validate</button>
            <button class="secondary" onclick="previewSpec()">Preview</button>
            <button class="secondary" onclick="generateSpec()">Generate spec</button>
            <button class="danger" onclick="applySpec()">Apply to project</button>
          </div>
        </div>
      </section>

      <div class="split">
        <section class="panel">
          <div class="eyebrow">Spec JSON</div>
          <textarea id="spec-editor" placeholder="La spec aparecerá aquí tras generar..."></textarea>
        </section>

        <section class="panel">
          <div class="eyebrow">Preview</div>
          <div id="preview">
            <div class="empty">Genera una spec para ver el preview</div>
          </div>
        </section>
      </div>

      <section class="panel">
        <div class="eyebrow">Validation / Result</div>
        <div id="result" class="result">Ejecuta una acción para ver el resultado.</div>
      </section>
    </main>

    <script>
      function getPayload() {
        return {
          pattern: document.getElementById('pattern').value,
          name: document.getElementById('name').value,
          inputPath: document.getElementById('inputPath').value || undefined,
          outputTable: document.getElementById('outputTable').value || undefined,
          batchSize: parseInt(document.getElementById('batchSize').value) || undefined,
          auditColumns: document.getElementById('auditColumns').checked,
        };
      }

      function renderPreview(data) {
        if (!data) {
          document.getElementById('preview').innerHTML = '<div class="empty">Sin datos</div>';
          return;
        }
        const components = data.components ?? [];
        const connections = data.connections ?? [];
        document.getElementById('preview').innerHTML = \`
          <div class="preview-card">
            <h4>Componentes (\${components.length})</h4>
            <div class="preview-meta">
              \${components.map(c => \`<span class="tag">\${c.uniqueName}</span>\`).join('')}
            </div>
          </div>
          \${connections.length ? \`<div class="preview-card">
            <h4>Conexiones (\${connections.length})</h4>
            <div class="preview-meta">
              \${connections.map(c => \`<span class="tag green">\${c.source} → \${c.target}</span>\`).join('')}
            </div>
          </div>\` : ''}
        \`;
      }

      function setResult(text, data) {
        document.getElementById('result').textContent = text;
        if (data) renderPreview(data);
      }

      async function callTool(name, payload) {
        if (!window.openai || typeof window.openai.callTool !== "function") {
          throw new Error("window.openai.callTool no disponible");
        }
        return await window.openai.callTool(name, payload);
      }

      async function validateSpec() {
        try {
          const payload = getPayload();
          const specJson = document.getElementById('spec-editor').value;
          let spec = payload;
          if (specJson.trim()) {
            try { spec = JSON.parse(specJson); } catch { spec = payload; }
          }
          const response = await callTool('talend_job_validate_pipeline_spec', { spec });
          const data = response?.structuredContent?.data ?? response;
          setResult(\`Validación: \${data?.ok ? '✓ Válida' : '✗ Inválida'}\`, data);
        } catch (err) {
          document.getElementById('result').textContent = 'Error: ' + err.message;
        }
      }

      async function previewSpec() {
        try {
          const payload = getPayload();
          const specJson = document.getElementById('spec-editor').value;
          let spec = payload;
          if (specJson.trim()) {
            try { spec = { ...payload, ...JSON.parse(specJson) }; } catch { spec = payload; }
          }
          const response = await callTool('talend_job_preview_pipeline_spec', spec);
          const data = response?.structuredContent?.data ?? response;
          setResult('Spec preview generada', data);
          renderPreview(data);
        } catch (err) {
          document.getElementById('result').textContent = 'Error: ' + err.message;
        }
      }

      async function generateSpec() {
        try {
          const payload = getPayload();
          document.getElementById('spec-editor').value = JSON.stringify(payload, null, 2);
          const response = await callTool('talend_job_preview_pipeline_spec', payload);
          const data = response?.structuredContent?.data ?? response;
          setResult('Spec generada', data);
          renderPreview(data);
        } catch (err) {
          document.getElementById('result').textContent = 'Error: ' + err.message;
        }
      }

      async function applySpec() {
        try {
          const specJson = document.getElementById('spec-editor').value;
          if (!specJson.trim()) {
            document.getElementById('result').textContent = 'Primero genera una spec';
            return;
          }
          const spec = JSON.parse(specJson);
          const confirmed = window.confirm("Esto escribirá archivos en el proyecto. ¿Continuar?");
          if (!confirmed) return;
          const response = await callTool('talend_job_apply_pipeline_spec', spec);
          const data = response?.structuredContent?.data ?? response;
          setResult('Spec aplicada al proyecto: ' + JSON.stringify(data, null, 2), data);
        } catch (err) {
          document.getElementById('result').textContent = 'Error: ' + err.message;
        }
      }
    </script>
  </body>
</html>`;
}
