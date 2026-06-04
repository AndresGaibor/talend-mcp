import type { PresentationAppDefinition } from "./app-types";

function escapeForScript(value: string): string {
  return value.replace(/</g, "\\u003c");
}

function createHomeHtml(): string {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Talend Home</title>
    <style>
      :root { color-scheme: light dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
      body { margin: 0; background: #0b1220; color: #e5eefc; }
      .home { min-height: 100vh; padding: 24px; box-sizing: border-box; display: grid; gap: 20px; }
      .header { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px; align-items: start; }
      .eyebrow { text-transform: uppercase; letter-spacing: .12em; font-size: 12px; color: #93c5fd; }
      h1 { margin: 4px 0 6px; font-size: 28px; }
      p { margin: 0; color: #cbd5e1; line-height: 1.5; }
      .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; }
      .card { background: rgba(11,18,32,.82); border: 1px solid rgba(148,163,184,.18); border-radius: 18px; padding: 20px; box-shadow: 0 24px 60px rgba(0,0,0,.28); display: grid; gap: 12px; }
      .card-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 20px; }
      .card-label { font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: .1em; }
      .card-value { font-size: 32px; font-weight: 700; }
      .card-sub { font-size: 13px; color: #64748b; }
      .card-meta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
      .badge { font-size: 11px; padding: 4px 8px; border-radius: 6px; background: rgba(56,189,248,.15); color: #38bdf8; }
      .badge.warning { background: rgba(251,146,60,.15); color: #fb923c; }
      .badge.error { background: rgba(248,113,113,.15); color: #f87171; }
      .badge.success { background: rgba(52,211,153,.15); color: #34d399; }
      .actions { display: grid; gap: 12px; }
      .action { border: 1px solid rgba(148,163,184,.16); border-radius: 16px; padding: 14px; background: rgba(15,23,42,.62); display: grid; gap: 10px; }
      .action-header { display: flex; justify-content: space-between; gap: 10px; align-items: baseline; }
      .action-title { font-weight: 600; }
      .action-desc { font-size: 13px; color: #94a3b8; }
      label { font-size: 12px; color: #93c5fd; display: grid; gap: 6px; }
      input, textarea, button { font: inherit; }
      input, textarea { width: 100%; box-sizing: border-box; border-radius: 12px; border: 1px solid rgba(148,163,184,.24); background: rgba(2,6,23,.78); color: #e5eefc; padding: 12px; }
      textarea { min-height: 92px; resize: vertical; }
      button { border: 0; border-radius: 12px; padding: 12px 14px; background: linear-gradient(135deg, #38bdf8, #6366f1); color: white; cursor: pointer; font-weight: 600; }
      button:hover { filter: brightness(1.05); }
      .result { white-space: pre-wrap; font-size: 13px; line-height: 1.5; color: #cbd5e1; }
      @media (max-width: 720px) { .header { flex-direction: column; } }
    </style>
  </head>
  <body>
    <main class="home">
      <section class="header">
        <div>
          <div class="eyebrow">Talend MCP</div>
          <h1>Home</h1>
          <p>Estado del entorno y accesos rápidos.</p>
        </div>
        <div id="env-status" class="card-meta"></div>
      </section>

      <div id="cards" class="cards"></div>

      <section class="card">
        <div class="eyebrow">Acciones rápidas</div>
        <div id="actions" class="actions"></div>
      </section>

      <section class="card">
        <div class="eyebrow">Actividad reciente</div>
        <div id="recent" class="result">Cargando...</div>
      </section>
    </main>

    <script>
      const initialStateRoot = document.getElementById("cards");
      const actionsRoot = document.getElementById("actions");
      const recentRoot = document.getElementById("recent");
      const envStatus = document.getElementById("env-status");

      function renderHome(state) {
        const stats = state?.quickStats ?? {};
        const env = state?.environment ?? {};
        const recentJobs = state?.recentJobs ?? [];
        const recentRuns = state?.recentRuns ?? [];

        if (env.projectDetected) {
          envStatus.innerHTML = '<span class="badge success">Proyecto detectado</span>';
          if (env.watcherActive) {
            envStatus.innerHTML += '<span class="badge">Live Watcher activo</span>';
          }
        } else {
          envStatus.innerHTML = '<span class="badge warning">Sin proyecto</span>';
        }

        initialStateRoot.innerHTML = \`
          <div class="card">
            <div class="card-icon" style="background: rgba(56,189,248,.15);">⚡</div>
            <div class="card-label">Bridge</div>
            <div class="card-value">\${env.watcherActive ? '🟢' : '🔴'}</div>
            <div class="card-sub">\${env.projectPath ?? 'Sin proyecto'}</div>
          </div>
          <div class="card">
            <div class="card-icon" style="background: rgba(99,102,241,.15);">📁</div>
            <div class="card-label">Proyecto</div>
            <div class="card-value">\${stats.jobCount ?? 0}</div>
            <div class="card-sub">Jobs en el workspace</div>
          </div>
          <div class="card">
            <div class="card-icon" style="background: rgba(52,211,153,.15);">▶️</div>
            <div class="card-label">Runs</div>
            <div class="card-value">\${stats.runCount ?? 0}</div>
            <div class="card-sub">Ejecuciones registradas</div>
          </div>
          <div class="card">
            <div class="card-icon" style="background: rgba(168,85,247,.15);">📸</div>
            <div class="card-label">Snapshots</div>
            <div class="card-value">\${stats.snapshotCount ?? 0}</div>
            <div class="card-sub">Snapshots disponibles</div>
          </div>
          <div class="card">
            <div class="card-icon" style="background: rgba(251,146,60,.15);">🔑</div>
            <div class="card-label">Contexts</div>
            <div class="card-value">\${stats.profileCount ?? 0}</div>
            <div class="card-sub">Profiles de contexto</div>
          </div>
          <div class="card">
            <div class="card-icon" style="background: rgba(248,113,113,.15);">⚠️</div>
            <div class="card-label">Errores</div>
            <div class="card-value">\${stats.errorCount ?? 0}</div>
            <div class="card-sub">Errores conocidos</div>
          </div>
        \`;

        if (recentJobs.length > 0 || recentRuns.length > 0) {
          recentRoot.innerHTML = \`<div style="display:grid;gap:8px;">
            \${recentJobs.slice(0,3).map(j => \`<div>📄 \${j.label ?? j.folderPath ?? 'Sin nombre'}</div>\`).join('')}
            \${recentRuns.slice(0,3).map(r => \`<div>▶️ Run \${r.runId ?? r.id ?? 'sin id'}</div>\`).join('')}
          </div>\`;
        } else {
          recentRoot.innerHTML = '<span style="color:#64748b">Sin actividad reciente</span>';
        }
      }

      function parseInput(action, input) {
        if (action.inputMode === "none") return {};
        if (action.inputMode === "json") {
          const text = input.trim();
          if (!text) return {};
          return JSON.parse(text);
        }
        const value = input.trim();
        if (!action.argumentName) return { value };
        const payload = {};
        payload[action.argumentName] = value;
        return payload;
      }

      function createActionElement(action, index) {
        const article = document.createElement("article");
        article.className = "action";

        const header = document.createElement("div");
        header.className = "action-header";

        const copy = document.createElement("div");
        const title = document.createElement("div");
        title.className = "action-title";
        title.textContent = action.label;
        const description = document.createElement("div");
        description.className = "action-desc";
        description.textContent = action.description;
        copy.appendChild(title);
        copy.appendChild(description);

        const button = document.createElement("button");
        button.type = "button";
        button.dataset.tool = action.toolName;
        button.dataset.index = String(index);
        button.textContent = "Ejecutar";

        header.appendChild(copy);
        header.appendChild(button);
        article.appendChild(header);

        if (action.inputMode !== "none") {
          const label = document.createElement("label");
          label.textContent = action.inputLabel ?? (action.inputMode === "json" ? "Payload JSON" : "Valor");

          if (action.inputMode === "json") {
            const textarea = document.createElement("textarea");
            textarea.id = "action-input-" + index;
            textarea.placeholder = action.inputPlaceholder ?? "{}";
            textarea.value = action.defaultValue ?? "{}";
            label.appendChild(textarea);
          } else {
            const input = document.createElement("input");
            input.id = "action-input-" + index;
            input.type = "text";
            input.placeholder = action.inputPlaceholder ?? "";
            input.value = action.defaultValue ?? "";
            label.appendChild(input);
          }

          article.appendChild(label);
        }

        return article;
      }

      async function runAction(index, actions) {
        const action = actions[index];
        const inputEl = document.getElementById("action-input-" + index);
        const payload = parseInput(action, inputEl ? inputEl.value : "");

        const dangerousPattern = /(create|update|delete|patch|apply|restore|run|stop|start|duplicate|move|execute|save|export|package|pull|switch)$/i;
        if (action.requiresConfirmation || dangerousPattern.test(action.toolName)) {
          const confirmed = window.confirm("Esta acción puede modificar el proyecto. ¿Continuar?");
          if (!confirmed) return;
        }

        try {
          if (!window.openai || typeof window.openai.callTool !== "function") {
            throw new Error("window.openai.callTool no disponible");
          }
          await window.openai.callTool(action.toolName, payload);
        } catch (error) {
          console.error(error);
        }
      }

      const state = window.openai?.toolOutput?.structuredContent?.initialState ?? window.openai?.toolOutput?.initialState ?? window.openai?.toolOutput;
      renderHome(state);

      window.addEventListener("openai:set_globals", (event) => {
        const newState = event.detail?.globals?.toolOutput?.structuredContent?.initialState ?? event.detail?.globals?.toolOutput?.initialState ?? event.detail?.globals?.toolOutput;
        renderHome(newState);
      });

      const actions = ${JSON.stringify([
        { label: "Bridge ping", toolName: "talend_bridge_ping", inputMode: "none" },
        { label: "List jobs", toolName: "talend_list_jobs", inputMode: "none" },
        { label: "Coverage report", toolName: "talend_coverage_report", inputMode: "none" },
      ])};
      actions.forEach((action, index) => {
        actionsRoot.appendChild(createActionElement(action, index));
      });

      actionsRoot.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-tool]");
        if (button) {
          void runAction(Number(button.dataset.index), actions);
        }
      });
    </script>
  </body>
</html>`;
}

function createDatasetInspectorProHtml(): string {
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
          const response = await callTool('talend_dataset_inspect_csv_folder', { folderPath });
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
          const response = await callTool('talend_dataset_infer_csv_schema', { folderPath });
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
          const response = await callTool('talend_dataset_generate_raw_table_mappings', {
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

function createPipelineSpecEditorHtml(): string {
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

function createValidationReportHtml(): string {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Validation Report</title>
    <style>
      :root { color-scheme: light dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
      body { margin: 0; background: #0b1220; color: #e5eefc; }
      .app { min-height: 100vh; padding: 24px; box-sizing: border-box; display: grid; gap: 20px; }
      .panel { background: rgba(11,18,32,.82); border: 1px solid rgba(148,163,184,.18); border-radius: 18px; padding: 18px; box-shadow: 0 24px 60px rgba(0,0,0,.28); }
      .header { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px; align-items: start; }
      .eyebrow { text-transform: uppercase; letter-spacing: .12em; font-size: 12px; color: #93c5fd; }
      h1 { margin: 4px 0 6px; font-size: 28px; }
      p { margin: 0; color: #cbd5e1; line-height: 1.5; }
      label { font-size: 12px; color: #93c5fd; display: grid; gap: 6px; }
      input, button { font: inherit; }
      input { width: 100%; box-sizing: border-box; border-radius: 12px; border: 1px solid rgba(148,163,184,.24); background: rgba(2,6,23,.78); color: #e5eefc; padding: 12px; }
      button { border: 0; border-radius: 12px; padding: 12px 14px; background: linear-gradient(135deg, #38bdf8, #6366f1); color: white; cursor: pointer; font-weight: 600; }
      button:hover { filter: brightness(1.05); }
      .score-card { display: flex; align-items: center; gap: 20px; padding: 20px; background: rgba(15,23,42,.62); border-radius: 16px; margin-bottom: 16px; }
      .score-circle { width: 80px; height: 80px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 700; }
      .score-circle.good { background: rgba(52,211,153,.2); color: #34d399; }
      .score-circle.warning { background: rgba(251,191,36,.2); color: #fbbf24; }
      .score-circle.bad { background: rgba(248,113,113,.2); color: #f87171; }
      .score-info h2 { margin: 0; font-size: 24px; }
      .score-info p { margin: 4px 0 0; font-size: 14px; }
      .checks { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 16px; }
      .check { padding: 14px; border-radius: 12px; text-align: center; }
      .check.passed { background: rgba(52,211,153,.15); }
      .check.failed { background: rgba(248,113,113,.15); }
      .check.warning { background: rgba(251,191,36,.15); }
      .check-value { font-size: 28px; font-weight: 700; }
      .check-label { font-size: 12px; color: #94a3b8; margin-top: 4px; }
      .problem { padding: 12px; border-radius: 10px; background: rgba(15,23,42,.62); margin-bottom: 8px; border-left: 3px solid; }
      .problem.error { border-color: #f87171; }
      .problem.warn { border-color: #fbbf24; }
      .problem-info { display: flex; justify-content: space-between; align-items: start; gap: 12px; }
      .problem-title { font-weight: 600; font-size: 14px; }
      .problem-file { font-size: 12px; color: #64748b; font-family: monospace; }
      .tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; }
      .tag.red { background: rgba(248,113,113,.15); color: #f87171; }
      .tag.yellow { background: rgba(251,191,36,.15); color: #fbbf24; }
      .tag.green { background: rgba(52,211,153,.15); color: #34d399; }
      .result { white-space: pre-wrap; font-size: 13px; line-height: 1.5; color: #cbd5e1; max-height: 300px; overflow-y: auto; }
      .empty { color: #64748b; text-align: center; padding: 40px; }
      @media (max-width: 720px) { .header { flex-direction: column; } }
    </style>
  </head>
  <body>
    <main class="app">
      <section class="panel header">
        <div>
          <div class="eyebrow">MCP App</div>
          <h1>Validation Report</h1>
          <p>Reporte de validación, análisis completo y problemas.</p>
        </div>
        <div style="display:flex;gap:12px;align-items:center;">
          <input type="text" id="jobName" placeholder="myJob" style="width:200px;" />
          <button onclick="validateDesign()">Validate design</button>
        </div>
      </section>

      <section class="panel">
        <div class="eyebrow">Score</div>
        <div id="score-card" class="score-card">
          <div class="score-circle" id="score-circle">--</div>
          <div class="score-info">
            <h2 id="score-text">Sin validación</h2>
            <p id="score-sub">Ejecuta una validación para ver el score</p>
          </div>
        </div>
        <div class="checks" id="checks">
          <div class="check passed">
            <div class="check-value" id="passed-count">0</div>
            <div class="check-label">Passed</div>
          </div>
          <div class="check failed">
            <div class="check-value" id="failed-count">0</div>
            <div class="check-label">Failed</div>
          </div>
          <div class="check warning">
            <div class="check-value" id="warn-count">0</div>
            <div class="check-label">Warnings</div>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="eyebrow">Problemas</div>
        <div id="problems">
          <div class="empty">Sin problemas detectados</div>
        </div>
      </section>

      <section class="panel">
        <div class="eyebrow">Detalle</div>
        <div id="result" class="result">Ejecuta una validación para ver el detalle.</div>
      </section>
    </main>

    <script>
      function renderReport(data) {
        if (!data) return;
        const passed = data.passed ?? 0;
        const failed = data.failed ?? data.errors ?? 0;
        const warnings = data.warnings ?? 0;
        const total = passed + failed + warnings;
        const score = total > 0 ? Math.round((passed / total) * 100) : 0;

        const circle = document.getElementById('score-circle');
        circle.textContent = score + '%';
        circle.className = 'score-circle ' + (score >= 80 ? 'good' : score >= 50 ? 'warning' : 'bad');

        document.getElementById('score-text').textContent = score >= 80 ? '✓ Pass' : score >= 50 ? '⚠ Warning' : '✗ Fail';
        document.getElementById('score-sub').textContent = \`\${total} checks: \${passed} passed, \${failed} failed, \${warnings} warnings\`;
        document.getElementById('passed-count').textContent = passed;
        document.getElementById('failed-count').textContent = failed;
        document.getElementById('warn-count').textContent = warnings;

        const problemsEl = document.getElementById('problems');
        const problems = data.problems ?? data.errors ?? [];
        if (problems.length > 0) {
          problemsEl.innerHTML = problems.map(p => \`<div class="problem \${p.severity === 'error' ? 'error' : 'warn'}">
            <div class="problem-info">
              <div>
                <div class="problem-title">\${p.message ?? p.title ?? 'Unknown problem'}</div>
                \${p.file ? \`<div class="problem-file">\${p.file}</div>\` : ''}
              </div>
              <span class="tag \${p.severity === 'error' ? 'red' : 'yellow'}">\${p.severity ?? 'warning'}</span>
            </div>
          </div>\`).join('');
        } else {
          problemsEl.innerHTML = '<div class="empty">✓ Sin problemas detectados</div>';
        }
      }

      function setResult(text, data) {
        document.getElementById('result').textContent = text;
        if (data) renderReport(data);
      }

      async function callTool(name, payload) {
        if (!window.openai || typeof window.openai.callTool !== "function") {
          throw new Error("window.openai.callTool no disponible");
        }
        return await window.openai.callTool(name, payload);
      }

      async function validateDesign() {
        try {
          const jobName = document.getElementById('jobName').value;
          const response = await callTool('talend_job_validate_design', { jobName });
          const data = response?.structuredContent?.data ?? response;
          setResult('Validación completada', data);
          renderReport(data);
        } catch (err) {
          document.getElementById('result').textContent = 'Error: ' + err.message;
        }
      }
    </script>
  </body>
</html>`;
}

function createRunMonitorProHtml(): string {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Run Monitor Pro</title>
    <style>
      :root { color-scheme: light dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
      body { margin: 0; background: #0b1220; color: #e5eefc; }
      .app { min-height: 100vh; padding: 24px; box-sizing: border-box; display: grid; gap: 20px; }
      .panel { background: rgba(11,18,32,.82); border: 1px solid rgba(148,163,184,.18); border-radius: 18px; padding: 18px; box-shadow: 0 24px 60px rgba(0,0,0,.28); }
      .header { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px; align-items: start; }
      .eyebrow { text-transform: uppercase; letter-spacing: .12em; font-size: 12px; color: #93c5fd; }
      h1 { margin: 4px 0 6px; font-size: 28px; }
      p { margin: 0; color: #cbd5e1; line-height: 1.5; }
      label { font-size: 12px; color: #93c5fd; display: grid; gap: 6px; }
      input, button { font: inherit; }
      input { width: 100%; box-sizing: border-box; border-radius: 12px; border: 1px solid rgba(148,163,184,.24); background: rgba(2,6,23,.78); color: #e5eefc; padding: 12px; }
      button { border: 0; border-radius: 12px; padding: 12px 14px; background: linear-gradient(135deg, #38bdf8, #6366f1); color: white; cursor: pointer; font-weight: 600; }
      button:hover { filter: brightness(1.05); }
      button.secondary { background: rgba(148,163,184,.2); }
      button.danger { background: linear-gradient(135deg, #f87171, #dc2626); }
      .controls { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
      .controls input { width: 200px; }
      .run-card { background: rgba(15,23,42,.62); border: 1px solid rgba(148,163,184,.1); border-radius: 14px; padding: 16px; margin-bottom: 12px; }
      .run-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
      .run-title { font-weight: 600; font-size: 15px; }
      .run-meta { display: flex; gap: 8px; font-size: 13px; color: #94a3b8; }
      .run-duration { font-size: 20px; font-weight: 700; color: #38bdf8; }
      .tag { display: inline-block; padding: 3px 10px; border-radius: 6px; font-size: 12px; }
      .tag.success { background: rgba(52,211,153,.15); color: #34d399; }
      .tag.failed { background: rgba(248,113,113,.15); color: #f87171; }
      .tag.running { background: rgba(56,189,248,.15); color: #38bdf8; }
      .tag.pending { background: rgba(148,163,184,.15); color: #94a3b8; }
      .log { background: rgba(2,6,23,.78); border-radius: 10px; padding: 14px; font-family: monospace; font-size: 12px; max-height: 300px; overflow-y: auto; white-space: pre-wrap; color: #94a3b8; }
      .empty { color: #64748b; text-align: center; padding: 40px; }
      .result { white-space: pre-wrap; font-size: 13px; line-height: 1.5; color: #cbd5e1; }
      @media (max-width: 720px) { .header { flex-direction: column; } .controls { flex-direction: column; } .controls input { width: 100%; } }
    </style>
  </head>
  <body>
    <main class="app">
      <section class="panel header">
        <div>
          <div class="eyebrow">MCP App</div>
          <h1>Run Monitor Pro</h1>
          <p>Monitor avanzado para ejecuciones, logs y comparaciones.</p>
        </div>
      </section>

      <section class="panel">
        <div class="eyebrow">Controles</div>
        <div class="controls">
          <input type="text" id="jobName" placeholder="myJob" />
          <button onclick="runJob()">▶ Run</button>
          <button class="secondary" onclick="listRuns()">List runs</button>
          <input type="text" id="launchId" placeholder="launch_123" style="width:180px;" />
          <button class="secondary" onclick="waitRun()">⏳ Wait</button>
          <input type="text" id="runId" placeholder="run_123" style="width:180px;" />
          <button class="secondary" onclick="measureRuntime()">⏱ Measure</button>
        </div>
      </section>

      <section class="panel">
        <div class="eyebrow">Runs Recientes</div>
        <div id="runs-list">
          <div class="empty">Ejecuta una acción para ver los runs</div>
        </div>
      </section>

      <section class="panel">
        <div class="eyebrow">Log</div>
        <div id="log-output" class="log">Sin output</div>
      </section>

      <section class="panel">
        <div class="eyebrow">Resultado</div>
        <div id="result" class="result">Ejecuta una acción para ver el resultado.</div>
      </section>
    </main>

    <script>
      let currentRunId = null;

      function setResult(text) {
        document.getElementById('result').textContent = text;
      }

      function setLog(text) {
        document.getElementById('log-output').textContent = text || 'Sin output';
      }

      function renderRuns(data) {
        const runs = Array.isArray(data) ? data : data?.runs ?? [];
        if (!runs.length) {
          document.getElementById('runs-list').innerHTML = '<div class="empty">Sin runs recientes</div>';
          return;
        }
        document.getElementById('runs-list').innerHTML = runs.slice(0, 10).map(r => \`<div class="run-card">
          <div class="run-header">
            <div class="run-title">\${r.jobName ?? r.label ?? 'Run ' + r.runId}</div>
            <span class="tag \${r.status === 'success' ? 'success' : r.status === 'failed' ? 'failed' : r.status === 'running' ? 'running' : 'pending'}">\${r.status ?? 'unknown'}</span>
          </div>
          <div class="run-meta">
            \${r.duration ? \`<span>⏱ \${r.duration}ms</span>\` : ''}
            \${r.startedAt ? \`<span>▶ \${new Date(r.startedAt).toLocaleTimeString()}</span>\` : ''}
            \${r.launchId ? \`<span>#\${r.launchId}</span>\` : ''}
          </div>
        </div>\`).join('');
      }

      async function callTool(name, payload) {
        if (!window.openai || typeof window.openai.callTool !== "function") {
          throw new Error("window.openai.callTool no disponible");
        }
        return await window.openai.callTool(name, payload);
      }

      async function runJob() {
        try {
          const jobName = document.getElementById('jobName').value;
          if (!jobName) { setResult('Ingresa un job name'); return; }
          setResult('Ejecutando ' + jobName + '...');
          const response = await callTool('talend_job_run_by_name', { jobName });
          const data = response?.structuredContent?.data ?? response;
          currentRunId = data?.runId ?? data?.launchId;
          setResult('Job iniciado: ' + JSON.stringify(data, null, 2));
        } catch (err) {
          setResult('Error: ' + err.message);
        }
      }

      async function listRuns() {
        try {
          setResult('Listando runs...');
          const response = await callTool('talend_list_runs', {});
          const data = response?.structuredContent?.data ?? response;
          renderRuns(data);
          setResult('Runs listados: ' + (Array.isArray(data) ? data.length : '?'));
        } catch (err) {
          setResult('Error: ' + err.message);
        }
      }

      async function waitRun() {
        try {
          const launchId = document.getElementById('launchId').value;
          if (!launchId) { setResult('Ingresa un launch ID'); return; }
          setResult('Esperando run ' + launchId + '...');
          const response = await callTool('talend_job_wait_run', { launchId });
          const data = response?.structuredContent?.data ?? response;
          setResult('Run completado: ' + JSON.stringify(data, null, 2));
          if (data?.output) setLog(data.output);
        } catch (err) {
          setResult('Error: ' + err.message);
        }
      }

      async function measureRuntime() {
        try {
          const jobName = document.getElementById('jobName').value;
          if (!jobName) { setResult('Ingresa un job name'); return; }
          setResult('Midiendo runtime de ' + jobName + '...');
          const response = await callTool('talend_job_measure_runtime', { jobName });
          const data = response?.structuredContent?.data ?? response;
          setResult('Runtime: ' + JSON.stringify(data, null, 2));
          if (data?.duration) {
            const duration = typeof data.duration === 'number' ? data.duration : parseInt(data.duration);
            document.getElementById('log-output').innerHTML = \`<div class="run-duration">\${(duration / 1000).toFixed(2)}s</div>\`;
          }
        } catch (err) {
          setResult('Error: ' + err.message);
        }
      }
    </script>
  </body>
</html>`;
}

export function createPresentationAppShellHtml(app: PresentationAppDefinition): string {
  if (app.id === "home") {
    return createHomeHtml();
  }
  if (app.id === "dataset-inspector-pro") {
    return createDatasetInspectorProHtml();
  }
  if (app.id === "pipeline-spec-editor") {
    return createPipelineSpecEditorHtml();
  }
  if (app.id === "validation-report") {
    return createValidationReportHtml();
  }
  if (app.id === "run-monitor-pro") {
    return createRunMonitorProHtml();
  }

  const appJson = escapeForScript(JSON.stringify(app));

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${app.title}</title>
    <style>
      :root { color-scheme: light dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
      body { margin: 0; background: #0b1220; color: #e5eefc; }
      .app { min-height: 100vh; padding: 24px; box-sizing: border-box; display: grid; gap: 20px; }
      .panel { background: rgba(11,18,32,.82); border: 1px solid rgba(148,163,184,.18); border-radius: 18px; padding: 18px; box-shadow: 0 24px 60px rgba(0,0,0,.28); }
      .header { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px; align-items: start; }
      .eyebrow { text-transform: uppercase; letter-spacing: .12em; font-size: 12px; color: #93c5fd; }
      h1 { margin: 4px 0 6px; font-size: 28px; }
      p { margin: 0; color: #cbd5e1; line-height: 1.5; }
      .meta { display: grid; gap: 6px; justify-items: end; text-align: right; color: #cbd5e1; font-size: 13px; }
      .actions { display: grid; gap: 12px; }
      .action { border: 1px solid rgba(148,163,184,.16); border-radius: 16px; padding: 14px; background: rgba(15,23,42,.62); display: grid; gap: 10px; }
      .action-header { display: flex; justify-content: space-between; gap: 10px; align-items: baseline; }
      .action-title { font-weight: 600; }
      .action-desc { font-size: 13px; color: #94a3b8; }
      label { font-size: 12px; color: #93c5fd; display: grid; gap: 6px; }
      input, textarea, button { font: inherit; }
      input, textarea { width: 100%; box-sizing: border-box; border-radius: 12px; border: 1px solid rgba(148,163,184,.24); background: rgba(2,6,23,.78); color: #e5eefc; padding: 12px; }
      textarea { min-height: 92px; resize: vertical; }
      button { border: 0; border-radius: 12px; padding: 12px 14px; background: linear-gradient(135deg, #38bdf8, #6366f1); color: white; cursor: pointer; font-weight: 600; }
      button:hover { filter: brightness(1.05); }
      .result { white-space: pre-wrap; font-size: 13px; line-height: 1.5; color: #cbd5e1; }
      .hint { color: #94a3b8; font-size: 12px; }
      .empty { color: #64748b; }
      @media (max-width: 720px) { .meta { justify-items: start; text-align: left; } .header { flex-direction: column; } }
    </style>
  </head>
  <body>
    <main class="app">
      <section class="panel header">
        <div>
          <div class="eyebrow">Talend MCP App</div>
          <h1>${app.title}</h1>
          <p>${app.description}</p>
        </div>
        <div class="meta">
          <div><strong>URI</strong>: ${app.resourceUri}</div>
          <div><strong>Launcher</strong>: ${app.launcherToolName}</div>
          <div><strong>Acciones</strong>: ${app.actions.length}</div>
        </div>
      </section>

      <section class="panel">
        <div class="eyebrow">Acciones</div>
        <div id="actions" class="actions"></div>
      </section>

      <section class="panel">
        <div class="eyebrow">Resultado</div>
        <div id="result" class="result empty">Selecciona una acción para ver la salida.</div>
      </section>

      <section class="panel">
        <div class="eyebrow">Estado inicial</div>
        <div id="initial-state" class="result empty">Cargando estado...</div>
      </section>
    </main>

    <script>
      const app = ${appJson};
      const actionsRoot = document.getElementById("actions");
      const resultRoot = document.getElementById("result");
      const initialStateRoot = document.getElementById("initial-state");

      function renderInitialState(output) {
        const data = output?.initialState ?? output?.structuredContent?.initialState ?? output;
        if (!data) {
          initialStateRoot.textContent = "Sin estado inicial.";
          return;
        }
        initialStateRoot.textContent = JSON.stringify(data, null, 2);
      }

      renderInitialState(window.openai?.toolOutput);

      window.addEventListener("openai:set_globals", (event) => {
        renderInitialState(event.detail?.globals?.toolOutput ?? window.openai?.toolOutput);
      });

      function parseInput(action, input) {
        if (action.inputMode === "none") return {};
        if (action.inputMode === "json") {
          const text = input.trim();
          if (!text) return {};
          return JSON.parse(text);
        }
        const value = input.trim();
        if (!action.argumentName) return { value };
        const payload = {};
        payload[action.argumentName] = value;
        return payload;
      }

      function setResult(text, isError = false) {
        resultRoot.classList.toggle("empty", false);
        resultRoot.style.color = isError ? "#fda4af" : "#cbd5e1";
        resultRoot.textContent = text;
      }

      function createActionElement(action, index) {
        const article = document.createElement("article");
        article.className = "action";

        const header = document.createElement("div");
        header.className = "action-header";

        const copy = document.createElement("div");
        const title = document.createElement("div");
        title.className = "action-title";
        title.textContent = action.label;
        const description = document.createElement("div");
        description.className = "action-desc";
        description.textContent = action.description;
        copy.appendChild(title);
        copy.appendChild(description);

        const button = document.createElement("button");
        button.type = "button";
        button.dataset.tool = action.toolName;
        button.dataset.index = String(index);
        button.textContent = "Ejecutar";

        header.appendChild(copy);
        header.appendChild(button);
        article.appendChild(header);

        if (action.inputMode !== "none") {
          const label = document.createElement("label");
          label.textContent = action.inputLabel ?? (action.inputMode === "json" ? "Payload JSON" : "Valor");

          if (action.inputMode === "json") {
            const textarea = document.createElement("textarea");
            textarea.id = "action-input-" + index;
            textarea.placeholder = action.inputPlaceholder ?? "{}";
            textarea.value = action.defaultValue ?? "{}";
            label.appendChild(textarea);
          } else {
            const input = document.createElement("input");
            input.id = "action-input-" + index;
            input.type = "text";
            input.placeholder = action.inputPlaceholder ?? "";
            input.value = action.defaultValue ?? "";
            label.appendChild(input);
          }

          article.appendChild(label);
        }

        return article;
      }

      async function runAction(index) {
        const action = app.actions[index];
        const inputEl = document.getElementById("action-input-" + index);
        const payload = parseInput(action, inputEl ? inputEl.value : "");

        const dangerousPattern = /(create|update|delete|patch|apply|restore|run|stop|start|duplicate|move|execute|save|export|package|pull|switch)$/i;
        if (action.requiresConfirmation || dangerousPattern.test(action.toolName)) {
          const confirmed = window.confirm("Esta acción puede modificar el proyecto. ¿Continuar?");
          if (!confirmed) {
            setResult("Acción cancelada por el usuario.");
            return;
          }
        }

        setResult("Ejecutando " + action.toolName + "...");

        try {
          if (!window.openai || typeof window.openai.callTool !== "function") {
            throw new Error("window.openai.callTool no disponible");
          }

          const response = await window.openai.callTool(action.toolName, payload);
          setResult(JSON.stringify(response, null, 2));
        } catch (error) {
          setResult(error instanceof Error ? error.message : String(error), true);
        }
      }

      app.actions.forEach((action, index) => {
        actionsRoot.appendChild(createActionElement(action, index));
      });

      actionsRoot.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-tool]");
        if (button) {
          void runAction(Number(button.dataset.index));
        }
      });
    </script>
  </body>
</html>`;
}
