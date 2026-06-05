/**
 * LEGACY UI SHELL.
 * No agregar nuevas apps aquí.
 * Las nuevas MCP Apps deben vivir en apps-ui/.
 */

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

function createSecretSafetyHtml(): string {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Secret Safety</title>
    <style>
      :root { color-scheme: light dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
      body { margin: 0; background: #0b1220; color: #e5eefc; }
      .app { min-height: 100vh; padding: 24px; box-sizing: border-box; display: grid; gap: 20px; }
      .header { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px; align-items: start; }
      .eyebrow { text-transform: uppercase; letter-spacing: .12em; font-size: 12px; color: #93c5fd; }
      h1 { margin: 4px 0 6px; font-size: 28px; }
      p { margin: 0; color: #cbd5e1; line-height: 1.5; }
      .panel { background: rgba(11,18,32,.82); border: 1px solid rgba(148,163,184,.18); border-radius: 18px; padding: 18px; box-shadow: 0 24px 60px rgba(0,0,0,.28); }
      .badges { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
      .badge { font-size: 11px; padding: 4px 10px; border-radius: 6px; background: rgba(56,189,248,.15); color: #38bdf8; }
      .badge.success { background: rgba(52,211,153,.15); color: #34d399; }
      .badge.warning { background: rgba(251,146,60,.15); color: #fb923c; }
      .badge.error { background: rgba(248,113,113,.15); color: #f87171; }
      .badge.low { background: rgba(52,211,153,.15); color: #34d399; }
      .badge.medium { background: rgba(251,146,60,.15); color: #fb923c; }
      .badge.high { background: rgba(248,113,113,.15); color: #f87171; }
      .controls { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
      button { padding: 8px 16px; border-radius: 8px; border: 1px solid rgba(148,163,184,.25); background: rgba(30,41,59,.82); color: #e5eefc; cursor: pointer; font-size: 13px; }
      button:hover { background: rgba(51,65,85,.82); }
      button:disabled { opacity: 0.5; cursor: not-allowed; }
      button.primary { background: rgba(56,189,248,.2); border-color: rgba(56,189,248,.4); color: #38bdf8; }
      button.primary:hover { background: rgba(56,189,248,.3); }
      input { padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(148,163,184,.25); background: rgba(15,23,42,.82); color: #e5eefc; font-size: 13px; width: 200px; }
      input::placeholder { color: #64748b; }
      table { width: 100%; border-collapse: collapse; font-size: 13px; }
      th { text-align: left; padding: 10px 12px; background: rgba(15,23,42,.62); border-bottom: 1px solid rgba(148,163,184,.12); color: #94a3b8; font-weight: 500; }
      td { padding: 10px 12px; border-bottom: 1px solid rgba(148,163,184,.08); }
      tr:last-child td { border-bottom: none; }
      .path-cell { font-family: monospace; font-size: 12px; word-break: break-all; }
      .mono { font-family: monospace; font-size: 12px; }
      .section-title { font-size: 15px; font-weight: 600; margin: 0 0 12px; color: #e5eefc; }
      .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 16px; }
      .summary-card { background: rgba(15,23,42,.5); border: 1px solid rgba(148,163,184,.12); border-radius: 12px; padding: 14px; text-align: center; }
      .summary-card .number { font-size: 28px; font-weight: 700; }
      .summary-card .label { font-size: 12px; color: #94a3b8; margin-top: 4px; }
      .summary-card.high .number { color: #f87171; }
      .summary-card.medium .number { color: #fb923c; }
      .summary-card.low .number { color: #34d399; }
      .summary-card.total .number { color: #38bdf8; }
      .loading { text-align: center; padding: 40px; color: #64748b; }
      .empty-state { text-align: center; padding: 40px; color: #64748b; }
      .error-msg { background: rgba(248,113,113,.1); border: 1px solid rgba(248,113,113,.2); border-radius: 12px; padding: 16px; color: #f87171; }
      .fix-step { display: flex; gap: 10px; padding: 8px 0; border-bottom: 1px solid rgba(148,163,184,.08); font-size: 13px; }
      .fix-step:last-child { border-bottom: none; }
      .step-num { color: #38bdf8; font-weight: 600; min-width: 20px; }
      .section { margin-bottom: 20px; }
      .section:last-child { margin-bottom: 0; }
      .job-scan-form { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
      .hidden { display: none; }
      @media (max-width: 720px) { .header { flex-direction: column; } }
    </style>
  </head>
  <body>
    <main class="app">
      <section class="panel header">
        <div>
          <div class="eyebrow">Security Scanner</div>
          <h1>Secret Safety</h1>
          <p>Escanea el proyecto en busca de secretos expuestos y sugiere migraciones a context profiles.</p>
        </div>
        <div id="header-badges" class="badges"></div>
      </section>

      <section class="panel">
        <div class="controls">
          <button id="btn-scan-project" class="primary" onclick="scanProject()">Scan Project</button>
          <div class="job-scan-form">
            <input id="job-name-input" type="text" placeholder="job name" />
            <button id="btn-scan-job" onclick="scanJob()">Scan Job</button>
          </div>
        </div>
      </section>

      <section id="results-section" class="hidden">
        <div id="summary-cards" class="summary-grid"></div>
        <div id="secrets-table-container"></div>
      </section>

      <section id="migrations-section" class="hidden">
        <h3 class="section-title">Suggested Context Migrations</h3>
        <div id="migrations-list"></div>
      </section>

      <section id="main-content" class="empty-state">Click "Scan Project" to search for exposed secrets.</section>
    </main>

    <script>
      let currentState = { scanned: false, scanType: null, results: null };

      function callTool(name, payload) {
        if (!window.openai || typeof window.openai.callTool !== 'function') {
          throw new Error('window.openai.callTool no disponible');
        }
        return window.openai.callTool(name, payload);
      }

      async function scanProject() {
        const btn = document.getElementById('btn-scan-project');
        const content = document.getElementById('main-content');
        btn.disabled = true;
        content.innerHTML = '<div class="loading">Scanning project for secrets...</div>';

        try {
          const response = await callTool('talend_secret_scan_project', {});
          const result = response?.structuredContent?.data ?? response;
          currentState = { scanned: true, scanType: 'project', results: result };
          renderResults(result);
        } catch (err) {
          content.innerHTML = '<div class="error-msg">Error: ' + err.message + '</div>';
        } finally {
          btn.disabled = false;
        }
      }

      async function scanJob() {
        const jobName = document.getElementById('job-name-input').value.trim();
        if (!jobName) {
          alert('Ingresa el nombre del job');
          return;
        }

        const btn = document.getElementById('btn-scan-job');
        const content = document.getElementById('main-content');
        btn.disabled = true;
        content.innerHTML = '<div class="loading">Scanning job ' + jobName + '...</div>';

        try {
          const response = await callTool('talend_secret_scan_job', { jobName });
          const result = response?.structuredContent?.data ?? response;
          currentState = { scanned: true, scanType: 'job', results: result };
          renderResults(result);
        } catch (err) {
          content.innerHTML = '<div class="error-msg">Error: ' + err.message + '</div>';
        } finally {
          btn.disabled = false;
        }
      }

      async function suggestMigrations(jobName) {
        const content = document.getElementById('migrations-list');
        content.innerHTML = '<div class="loading">Generating migration suggestions...</div>';
        document.getElementById('migrations-section').classList.remove('hidden');

        try {
          const response = await callTool('talend_secret_suggest_context_migration', { jobName });
          const result = response?.structuredContent?.data ?? response;
          renderMigrations(result);
        } catch (err) {
          content.innerHTML = '<div class="error-msg">Error: ' + err.message + '</div>';
        }
      }

      function maskValue(value) {
        if (!value) return '••••••';
        if (value.length <= 4) return '••••••';
        return value.substring(0, 3) + '••••••';
      }

      function renderResults(result) {
        const content = document.getElementById('main-content');
        const badges = document.getElementById('header-badges');
        const summarySection = document.getElementById('results-section');

        if (!result || result.secretsFound === undefined) {
          content.innerHTML = '<div class="error-msg">No se pudo obtener el resultado del scan.</div>';
          return;
        }

        badges.innerHTML = renderBadges(result);
        summarySection.classList.remove('hidden');

        document.getElementById('summary-cards').innerHTML = renderSummaryCards(result.summary);

        if (result.findings && result.findings.length > 0) {
          document.getElementById('secrets-table-container').innerHTML = renderSecretsTable(result.findings);
          content.innerHTML = '';

          if (currentState.scanType === 'job' && result.jobName) {
            suggestMigrations(result.jobName);
          }
        } else {
          document.getElementById('secrets-table-container').innerHTML = '';
          content.innerHTML = '<div class="empty-state">No se encontraron secretos expuestos. ¡Buen trabajo!</div>';
        }
      }

      function renderBadges(result) {
        let html = '';
        if (currentState.scanned) {
          html += '<span class="badge ' + (result.secretsFound > 0 ? 'warning' : 'success') + '">';
          html += result.secretsFound > 0 ? result.secretsFound + ' secrets found' : 'Project clean';
          html += '</span>';
        }
        if (result.filesScanned !== undefined) {
          html += '<span class="badge info">' + result.filesScanned + ' files scanned</span>';
        }
        return html;
      }

      function renderSummaryCards(summary) {
        const total = (summary.high || 0) + (summary.medium || 0) + (summary.low || 0);
        return '<div class="summary-card total"><div class="number">' + total + '</div><div class="label">Total</div></div>' +
               '<div class="summary-card high"><div class="number">' + (summary.high || 0) + '</div><div class="label">High Risk</div></div>' +
               '<div class="summary-card medium"><div class="number">' + (summary.medium || 0) + '</div><div class="label">Medium Risk</div></div>' +
               '<div class="summary-card low"><div class="number">' + (summary.low || 0) + '</div><div class="label">Low Risk</div></div>';
      }

      function renderSecretsTable(findings) {
        const rows = findings.map(f => {
          const fileName = f.file.split('/').pop();
          return '<tr>' +
            '<td class="path-cell">' + escapeHtml(fileName) + '</td>' +
            '<td>' + escapeHtml(f.component || '-') + '</td>' +
            '<td class="mono">' + escapeHtml(f.parameter) + '</td>' +
            '<td class="mono">' + maskValue(f.value) + '</td>' +
            '<td><span class="badge ' + f.risk + '">' + f.risk.toUpperCase() + '</span></td>' +
            '<td class="path-cell">' + escapeHtml(f.suggestedFix) + '</td>' +
            '</tr>';
        }).join('');

        return '<div class="section">' +
          '<table>' +
            '<thead><tr><th>Archivo</th><th>Componente</th><th>Parametro</th><th>Valor</th><th>Riesgo</th><th>Solucion</th></tr></thead>' +
            '<tbody>' + rows + '</tbody>' +
          '</table>' +
        '</div>';
      }

      function renderMigrations(result) {
        const container = document.getElementById('migrations-list');

        if (!result || !result.suggestions || result.suggestions.length === 0) {
          container.innerHTML = '<div class="empty-state">No suggestions available.</div>';
          return;
        }

        container.innerHTML = result.suggestions.map(s => {
          const steps = s.migrationSteps ? s.migrationSteps.map((step, i) =>
            '<div class="fix-step"><span class="step-num">' + (i + 1) + '.</span><span>' + escapeHtml(step) + '</span></div>'
          ).join('') : '';

          return '<div class="panel" style="margin-bottom:16px;">' +
            '<div style="margin-bottom:8px;"><strong>' + escapeHtml(s.parameter) + '</strong></div>' +
            '<div style="font-size:12px;color:#94a3b8;margin-bottom:12px;">Context: ' + escapeHtml(s.contextProfile || 'Default') + '</div>' +
            '<div style="font-size:12px;margin-bottom:8px;">Suggested var: <code style="color:#38bdf8;">' + escapeHtml(s.suggestedContextVar || s.parameter) + '</code></div>' +
            '<div style="margin-top:12px;">' + steps + '</div>' +
          '</div>';
        }).join('');
      }

      function escapeHtml(str) {
        if (!str) return '';
        return String(str)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      }
    </script>
  </body>
</html>`;
}

function createSnapshotManagerHtml(): string {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Snapshot Manager</title>
    <style>
      :root { color-scheme: light dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
      body { margin: 0; background: #0b1220; color: #e5eefc; }
      .app { min-height: 100vh; padding: 24px; box-sizing: border-box; display: grid; gap: 20px; }
      .panel { background: rgba(11,18,32,.82); border: 1px solid rgba(148,163,184,.18); border-radius: 18px; padding: 18px; box-shadow: 0 24px 60px rgba(0,0,0,.28); }
      .header { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px; align-items: start; }
      .eyebrow { text-transform: uppercase; letter-spacing: .12em; font-size: 12px; color: #93c5fd; }
      h1 { margin: 4px 0 6px; font-size: 28px; }
      p { margin: 0; color: #cbd5e1; line-height: 1.5; }
      .badges { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
      .badge { font-size: 11px; padding: 4px 10px; border-radius: 6px; background: rgba(56,189,248,.15); color: #38bdf8; }
      .badge.success { background: rgba(52,211,153,.15); color: #34d399; }
      .badge.warning { background: rgba(251,146,60,.15); color: #fb923c; }
      .badge.error { background: rgba(248,113,113,.15); color: #f87171; }
      .badge.info { background: rgba(99,102,241,.15); color: #a78bfa; }
      .stats { display: flex; gap: 16px; flex-wrap: wrap; align-items: center; }
      .stat { display: flex; flex-direction: column; align-items: center; padding: 12px 20px; background: rgba(15,23,42,.5); border-radius: 12px; min-width: 80px; }
      .stat-value { font-size: 24px; font-weight: 700; color: #38bdf8; }
      .stat-label { font-size: 11px; color: #94a3b8; margin-top: 4px; }
      button { border: 0; border-radius: 12px; padding: 10px 14px; background: linear-gradient(135deg, #38bdf8, #6366f1); color: white; cursor: pointer; font-weight: 600; font-size: 13px; }
      button:hover { filter: brightness(1.05); }
      button.secondary { background: rgba(148,163,184,.2); color: #e5eefc; }
      button.danger { background: linear-gradient(135deg, #f87171, #dc2626); }
      button:disabled { opacity: 0.5; cursor: not-allowed; }
      input, select { padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(148,163,184,.25); background: rgba(15,23,42,.82); color: #e5eefc; font-size: 13px; }
      input::placeholder { color: #64748b; }
      table { width: 100%; border-collapse: collapse; font-size: 13px; }
      th { text-align: left; padding: 10px 12px; background: rgba(15,23,42,.62); border-bottom: 1px solid rgba(148,163,184,.12); color: #94a3b8; font-weight: 500; text-transform: uppercase; letter-spacing: .05em; font-size: 11px; }
      td { padding: 10px 12px; border-bottom: 1px solid rgba(148,163,184,.08); }
      tr:hover td { background: rgba(148,163,184,.05); }
      tr.selected td { background: rgba(56,189,248,.1); }
      .mono { font-family: monospace; font-size: 12px; word-break: break-all; }
      .tag { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 11px; }
      .tag.info { background: rgba(56,189,248,.15); color: #38bdf8; }
      .tag.success { background: rgba(52,211,153,.15); color: #34d399; }
      .tag.warning { background: rgba(251,146,60,.15); color: #fb923c; }
      .controls { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; margin-bottom: 16px; }
      .split { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
      .detail-section { margin-bottom: 16px; }
      .detail-section:last-child { margin-bottom: 0; }
      .detail-title { font-size: 12px; color: #93c5fd; text-transform: uppercase; letter-spacing: .1em; margin-bottom: 8px; }
      .detail-content { background: rgba(2,6,23,.78); border-radius: 10px; padding: 12px; font-size: 12px; line-height: 1.5; }
      .detail-content pre { margin: 0; white-space: pre-wrap; }
      .diff-line { font-family: monospace; font-size: 12px; line-height: 1.4; padding: 2px 8px; }
      .diff-line.added { background: rgba(52,211,153,.15); color: #34d399; }
      .diff-line.removed { background: rgba(248,113,113,.15); color: #f87171; }
      .diff-line.context { color: #94a3b8; }
      .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.7); display: flex; align-items: center; justify-content: center; z-index: 1000; }
      .modal { background: rgba(11,18,32,.95); border: 1px solid rgba(148,163,184,.18); border-radius: 18px; padding: 24px; max-width: 500px; width: 90%; }
      .modal h3 { margin: 0 0 12px; font-size: 18px; }
      .modal p { color: #94a3b8; margin-bottom: 16px; }
      .modal .warning-box { background: rgba(251,146,60,.15); border: 1px solid rgba(251,146,60,.3); border-radius: 10px; padding: 12px; margin-bottom: 16px; color: #fb923c; font-size: 13px; }
      .modal-actions { display: flex; gap: 12px; justify-content: flex-end; }
      .empty { color: #64748b; text-align: center; padding: 40px; }
      .loading { text-align: center; padding: 40px; color: #64748b; }
      .error-msg { background: rgba(248,113,113,.1); border: 1px solid rgba(248,113,113,.2); border-radius: 12px; padding: 16px; color: #f87171; }
      @media (max-width: 720px) { .split { grid-template-columns: 1fr; } .header { flex-direction: column; } }
    </style>
  </head>
  <body>
    <main class="app">
      <section class="panel header">
        <div>
          <div class="eyebrow">Snapshot Management</div>
          <h1>Snapshot Manager</h1>
          <p>Lista, compara y restaura snapshots del workspace.</p>
        </div>
        <div id="header-badges" class="badges"></div>
      </section>

      <section class="panel">
        <div class="stats">
          <div class="stat">
            <div class="stat-value" id="total-count">0</div>
            <div class="stat-label">Total Snapshots</div>
          </div>
          <button id="btn-refresh" onclick="loadSnapshots()">Refresh</button>
        </div>
      </section>

      <section class="panel">
        <div class="controls">
          <select id="snapshot-a"><option value="">Select snapshot A</option></select>
          <span style="color:#94a3b8;font-size:13px;">vs</span>
          <select id="snapshot-b"><option value="">Select snapshot B</option></select>
          <button class="secondary" id="btn-diff" onclick="showDiff()" disabled>Diff</button>
        </div>
        <div id="snapshots-table"></div>
      </section>

      <section class="panel" id="detail-panel" style="display:none;">
        <div class="detail-section">
          <div class="detail-title">Snapshot Detail</div>
          <div id="detail-content"></div>
        </div>
      </section>

      <section class="panel" id="diff-panel" style="display:none;">
        <div class="detail-title">Diff Comparison</div>
        <div id="diff-content"></div>
      </section>
    </main>

    <div id="restore-modal" class="modal-overlay" style="display:none;">
      <div class="modal">
        <h3>Confirm Restore</h3>
        <div class="warning-box">⚠️ This action is irreversible. The current workspace state will be replaced by the snapshot contents.</div>
        <p>Snapshot: <strong id="restore-snapshot-id"></strong></p>
        <div class="modal-actions">
          <button class="secondary" onclick="closeRestoreModal()">Cancel</button>
          <button class="danger" id="btn-confirm-restore" onclick="confirmRestore()">Restore Snapshot</button>
        </div>
      </div>
    </div>

    <script>
      let snapshots = [];
      let selectedSnapshot = null;
      let pendingRestore = null;

      async function callTool(name, payload) {
        if (!window.openai || typeof window.openai.callTool !== 'function') {
          throw new Error('window.openai.callTool no disponible');
        }
        return await window.openai.callTool(name, payload);
      }

      async function loadSnapshots() {
        const btn = document.getElementById('btn-refresh');
        const table = document.getElementById('snapshots-table');
        btn.disabled = true;
        table.innerHTML = '<div class="loading">Loading snapshots...</div>';

        try {
          const response = await callTool('talend_snapshot_list', {});
          const data = response?.structuredContent?.data ?? response;
          snapshots = Array.isArray(data) ? data : data?.snapshots ?? [];
          renderSnapshots();
          document.getElementById('total-count').textContent = snapshots.length;
          document.getElementById('header-badges').innerHTML = '<span class="badge info">' + snapshots.length + ' snapshots</span>';
        } catch (err) {
          table.innerHTML = '<div class="error-msg">Error: ' + err.message + '</div>';
        } finally {
          btn.disabled = false;
        }
      }

      function formatDate(timestamp) {
        if (!timestamp) return 'N/A';
        const d = new Date(timestamp);
        if (isNaN(d.getTime())) return 'N/A';
        return d.toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' });
      }

      function renderSnapshots() {
        const table = document.getElementById('snapshots-table');
        if (!snapshots.length) {
          table.innerHTML = '<div class="empty">No snapshots found. Click Refresh to load.</div>';
          return;
        }

        const selectA = document.getElementById('snapshot-a');
        const selectB = document.getElementById('snapshot-b');
        selectA.innerHTML = '<option value="">Select snapshot A</option>';
        selectB.innerHTML = '<option value="">Select snapshot B</option>';

        const rows = snapshots.map(s => {
          const filesAffected = s.filesAffected?.length ?? s.affectedFiles?.length ?? 0;
          selectA.innerHTML += '<option value="' + s.id + '">' + s.id + '</option>';
          selectB.innerHTML += '<option value="' + s.id + '">' + s.id + '</option>';
          return '<tr data-id="' + s.id + '" onclick="selectSnapshot(\'' + s.id + '\')" style="cursor:pointer;">' +
            '<td class="mono">' + s.id + '</td>' +
            '<td>' + (s.jobName || s.label || '-') + '</td>' +
            '<td>' + formatDate(s.timestamp || s.createdAt) + '</td>' +
            '<td>' + (s.reason || s.description || '-') + '</td>' +
            '<td><span class="tag info">' + filesAffected + ' files</span></td>' +
            '<td><button class="secondary" onclick="event.stopPropagation();viewSnapshot(\'' + s.id + '\')">View</button></td>' +
            '<td><button class="secondary" onclick="event.stopPropagation();selectForDiff(\'' + s.id + '\')">Diff</button></td>' +
            '<td><button class="danger" onclick="event.stopPropagation();initiateRestore(\'' + s.id + '\')">Restore</button></td>' +
            '</tr>';
        }).join('');

        table.innerHTML = '<table><thead><tr><th>ID</th><th>Job</th><th>Date</th><th>Reason</th><th>Files</th><th colspan="3">Actions</th></tr></thead><tbody>' + rows + '</tbody></table>';
      }

      function selectSnapshot(id) {
        document.querySelectorAll('tr').forEach(tr => tr.classList.remove('selected'));
        const row = document.querySelector('tr[data-id="' + id + '"]');
        if (row) row.classList.add('selected');
        selectedSnapshot = snapshots.find(s => s.id === id);
      }

      async function viewSnapshot(id) {
        const detailPanel = document.getElementById('detail-panel');
        const detailContent = document.getElementById('detail-content');
        detailPanel.style.display = 'block';
        detailContent.innerHTML = '<div class="loading">Loading snapshot details...</div>';

        try {
          const response = await callTool('talend_snapshot_read', { snapshotId: id });
          const data = response?.structuredContent?.data ?? response;
          renderSnapshotDetail(data);
        } catch (err) {
          detailContent.innerHTML = '<div class="error-msg">Error: ' + err.message + '</div>';
        }
      }

      function renderSnapshotDetail(data) {
        if (!data) {
          document.getElementById('detail-content').innerHTML = '<div class="error-msg">No data available</div>';
          return;
        }

        const filesAffected = data.filesAffected || data.affectedFiles || [];
        const content = data.content || data.snapshotContent || data;

        let filesHtml = '';
        if (filesAffected.length > 0) {
          filesHtml = '<div class="detail-section"><div class="detail-title">Files Affected</div>' +
            '<div class="detail-content"><pre>' + filesAffected.map(f => escapeHtml(f)).join('\n') + '</pre></div></div>';
        }

        let contentHtml = '';
        if (content) {
          const contentStr = typeof content === 'object' ? JSON.stringify(content, null, 2) : String(content);
          contentHtml = '<div class="detail-section"><div class="detail-title">Content</div>' +
            '<div class="detail-content"><pre>' + escapeHtml(contentStr) + '</pre></div></div>';
        }

        document.getElementById('detail-content').innerHTML = '<div class="detail-section"><div class="detail-title">Metadata</div>' +
          '<div class="detail-content"><pre>' + JSON.stringify(data.metadata || data, null, 2) + '</pre></div></div>' +
          filesHtml + contentHtml;
      }

      function selectForDiff(id) {
        const selectA = document.getElementById('snapshot-a');
        const selectB = document.getElementById('snapshot-b');
        if (!selectA.value) {
          selectA.value = id;
        } else if (!selectB.value) {
          selectB.value = id;
          document.getElementById('btn-diff').disabled = false;
        } else {
          selectA.value = id;
          selectB.value = '';
          document.getElementById('btn-diff').disabled = true;
        }
      }

      async function showDiff() {
        const snapshotA = document.getElementById('snapshot-a').value;
        const snapshotB = document.getElementById('snapshot-b').value;
        if (!snapshotA || !snapshotB) return;

        const diffPanel = document.getElementById('diff-panel');
        const diffContent = document.getElementById('diff-content');
        diffPanel.style.display = 'block';
        diffContent.innerHTML = '<div class="loading">Computing diff...</div>';

        try {
          const response = await callTool('talend_snapshot_diff', { snapshotIdA: snapshotA, snapshotIdB: snapshotB });
          const data = response?.structuredContent?.data ?? response;
          renderDiff(data);
        } catch (err) {
          diffContent.innerHTML = '<div class="error-msg">Error: ' + err.message + '</div>';
        }
      }

      function renderDiff(data) {
        const diffContent = document.getElementById('diff-content');
        if (!data) {
          diffContent.innerHTML = '<div class="error-msg">No diff data available</div>';
          return;
        }

        const lines = data.diff || data.changes || data;
        if (typeof lines === 'string') {
          diffContent.innerHTML = '<div class="detail-content"><pre>' + escapeHtml(lines) + '</pre></div>';
          return;
        }

        if (Array.isArray(lines)) {
          diffContent.innerHTML = lines.map(line => {
            const cls = line.type === 'added' ? 'added' : line.type === 'removed' ? 'removed' : 'context';
            return '<div class="diff-line ' + cls + '">' + escapeHtml(line.content || line.text || JSON.stringify(line)) + '</div>';
          }).join('');
          return;
        }

        diffContent.innerHTML = '<div class="detail-content"><pre>' + escapeHtml(JSON.stringify(data, null, 2)) + '</pre></div>';
      }

      function initiateRestore(id) {
        pendingRestore = id;
        document.getElementById('restore-snapshot-id').textContent = id;
        document.getElementById('restore-modal').style.display = 'flex';
      }

      function closeRestoreModal() {
        pendingRestore = null;
        document.getElementById('restore-modal').style.display = 'none';
      }

      async function confirmRestore() {
        if (!pendingRestore) return;

        const btn = document.getElementById('btn-confirm-restore');
        btn.disabled = true;
        btn.textContent = 'Restoring...';

        try {
          const response = await callTool('talend_snapshot_restore', { snapshotId: pendingRestore });
          const data = response?.structuredContent?.data ?? response;
          closeRestoreModal();
          alert('Snapshot restored successfully: ' + JSON.stringify(data, null, 2));
          loadSnapshots();
        } catch (err) {
          alert('Error restoring snapshot: ' + err.message);
        } finally {
          btn.disabled = false;
          btn.textContent = 'Restore Snapshot';
        }
      }

      function escapeHtml(str) {
        if (!str) return '';
        return String(str)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      }

      document.getElementById('snapshot-a').addEventListener('change', updateDiffButton);
      document.getElementById('snapshot-b').addEventListener('change', updateDiffButton);

      function updateDiffButton() {
        const a = document.getElementById('snapshot-a').value;
        const b = document.getElementById('snapshot-b').value;
        document.getElementById('btn-diff').disabled = !(a && b);
      }

      loadSnapshots();
    </script>
  </body>
</html>`;
}

function createDeliverablesHtml(): string {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Deliverables</title>
    <style>
      :root { color-scheme: light dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
      body { margin: 0; background: #0b1220; color: #e5eefc; }
      .app { min-height: 100vh; padding: 24px; box-sizing: border-box; display: grid; gap: 20px; }
      .panel { background: rgba(11,18,32,.82); border: 1px solid rgba(148,163,184,.18); border-radius: 18px; padding: 18px; box-shadow: 0 24px 60px rgba(0,0,0,.28); }
      .header { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px; align-items: start; }
      .eyebrow { text-transform: uppercase; letter-spacing: .12em; font-size: 12px; color: #93c5fd; }
      h1 { margin: 4px 0 6px; font-size: 28px; }
      p { margin: 0; color: #cbd5e1; line-height: 1.5; }
      .badges { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
      .badge { font-size: 11px; padding: 4px 10px; border-radius: 6px; background: rgba(56,189,248,.15); color: #38bdf8; }
      .badge.success { background: rgba(52,211,153,.15); color: #34d399; }
      .badge.warning { background: rgba(251,146,60,.15); color: #fb923c; }
      .badge.error { background: rgba(248,113,113,.15); color: #f87171; }
      .badge.info { background: rgba(99,102,241,.15); color: #a78bfa; }
      .stats { display: flex; gap: 16px; flex-wrap: wrap; align-items: center; }
      .stat { display: flex; flex-direction: column; align-items: center; padding: 12px 20px; background: rgba(15,23,42,.5); border-radius: 12px; min-width: 80px; }
      .stat-value { font-size: 24px; font-weight: 700; color: #38bdf8; }
      .stat-label { font-size: 11px; color: #94a3b8; margin-top: 4px; }
      button { border: 0; border-radius: 12px; padding: 10px 14px; background: linear-gradient(135deg, #38bdf8, #6366f1); color: white; cursor: pointer; font-weight: 600; font-size: 13px; }
      button:hover { filter: brightness(1.05); }
      button.secondary { background: rgba(148,163,184,.2); color: #e5eefc; }
      button.danger { background: linear-gradient(135deg, #f87171, #dc2626); }
      button:disabled { opacity: 0.5; cursor: not-allowed; }
      input { padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(148,163,184,.25); background: rgba(15,23,42,.82); color: #e5eefc; font-size: 13px; width: 250px; }
      input::placeholder { color: #64748b; }
      .controls { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; margin-bottom: 16px; }
      .form-row { display: flex; gap: 12px; flex-wrap: wrap; align-items: flex-end; }
      .form-group { display: grid; gap: 6px; }
      .form-group label { font-size: 11px; color: #93c5fd; text-transform: uppercase; letter-spacing: .05em; }
      .checklist { display: grid; gap: 8px; }
      .check-item { display: flex; align-items: center; gap: 12px; padding: 12px; background: rgba(15,23,42,.5); border-radius: 10px; border-left: 3px solid; }
      .check-item.pass { border-color: #34d399; }
      .check-item.fail { border-color: #f87171; }
      .check-item.pending { border-color: #94a3b8; }
      .check-icon { font-size: 16px; width: 24px; text-align: center; }
      .check-icon.pass { color: #34d399; }
      .check-icon.fail { color: #f87171; }
      .check-icon.pending { color: #94a3b8; }
      .check-label { font-size: 13px; flex: 1; }
      .check-meta { font-size: 11px; color: #64748b; }
      .file-list { display: grid; gap: 6px; }
      .file-item { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: rgba(15,23,42,.5); border-radius: 8px; font-size: 12px; }
      .file-name { font-family: monospace; color: #38bdf8; }
      .file-size { color: #64748b; font-size: 11px; }
      .preview-section { background: rgba(15,23,42,.62); border: 1px solid rgba(148,163,184,.1); border-radius: 12px; padding: 14px; margin-top: 12px; }
      .preview-title { font-size: 13px; font-weight: 600; margin-bottom: 8px; color: #e5eefc; }
      .preview-meta { display: flex; gap: 12px; flex-wrap: wrap; font-size: 12px; color: #94a3b8; }
      .progress-bar { width: 100%; height: 6px; background: rgba(148,163,184,.2); border-radius: 3px; overflow: hidden; margin-top: 8px; }
      .progress-fill { height: 100%; background: linear-gradient(90deg, #38bdf8, #6366f1); border-radius: 3px; transition: width .3s ease; }
      .empty { color: #64748b; text-align: center; padding: 40px; }
      .loading { text-align: center; padding: 40px; color: #64748b; }
      .error-msg { background: rgba(248,113,113,.1); border: 1px solid rgba(248,113,113,.2); border-radius: 12px; padding: 16px; color: #f87171; }
      .success-msg { background: rgba(52,211,153,.1); border: 1px solid rgba(52,211,153,.2); border-radius: 12px; padding: 16px; color: #34d399; }
      .result { white-space: pre-wrap; font-size: 13px; line-height: 1.5; color: #cbd5e1; max-height: 300px; overflow-y: auto; }
      .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.7); display: flex; align-items: center; justify-content: center; z-index: 1000; }
      .modal { background: rgba(11,18,32,.95); border: 1px solid rgba(148,163,184,.18); border-radius: 18px; padding: 24px; max-width: 500px; width: 90%; }
      .modal h3 { margin: 0 0 12px; font-size: 18px; }
      .modal p { color: #94a3b8; margin-bottom: 16px; }
      .modal .warning-box { background: rgba(251,146,60,.15); border: 1px solid rgba(251,146,60,.3); border-radius: 10px; padding: 12px; margin-bottom: 16px; color: #fb923c; font-size: 13px; }
      .modal-actions { display: flex; gap: 12px; justify-content: flex-end; }
      @media (max-width: 720px) { .header { flex-direction: column; } .controls { flex-direction: column; align-items: stretch; } input { width: 100%; } }
    </style>
  </head>
  <body>
    <main class="app">
      <section class="panel header">
        <div>
          <div class="eyebrow">Package Manager</div>
          <h1>Deliverables</h1>
          <p>Prepara, valida y exporta paquetes de entregables para jobs de Talend.</p>
        </div>
        <div id="header-badges" class="badges"></div>
      </section>

      <section class="panel">
        <div class="form-row">
          <div class="form-group">
            <label>Job Name</label>
            <input type="text" id="jobName" placeholder="my_job" />
          </div>
          <button id="btn-collect" onclick="collectFiles()">Collect Files</button>
          <button id="btn-validate" class="secondary" onclick="validateChecklist()" disabled>Validate Checklist</button>
          <button id="btn-export" class="secondary" onclick="prepareExport()" disabled>Prepare Export</button>
        </div>
        <div id="progress-section" style="display:none; margin-top:12px;">
          <div id="progress-text" style="font-size:12px;color:#94a3b8;margin-bottom:4px;">Recolectando archivos...</div>
          <div class="progress-bar"><div id="progress-fill" class="progress-fill" style="width:0%"></div></div>
        </div>
      </section>

      <section class="panel">
        <div class="eyebrow">Status</div>
        <div class="stats" style="margin-top:8px;">
          <div class="stat">
            <div class="stat-value" id="stat-files">0</div>
            <div class="stat-label">Files</div>
          </div>
          <div class="stat">
            <div class="stat-value" id="stat-size">0 KB</div>
            <div class="stat-label">Size</div>
          </div>
          <div class="stat">
            <div class="stat-value" id="stat-checks-pass">0</div>
            <div class="stat-label">Checks Pass</div>
          </div>
          <div class="stat">
            <div class="stat-value" id="stat-checks-fail">0</div>
            <div class="stat-label">Checks Fail</div>
          </div>
        </div>
        <div id="status-badges" class="badges" style="margin-top:12px;"></div>
      </section>

      <section class="panel">
        <div class="eyebrow">Checklist</div>
        <div id="checklist" class="checklist" style="margin-top:8px;">
          <div class="empty">Ingresa un job name y recolecta archivos para ver el checklist</div>
        </div>
      </section>

      <section class="panel">
        <div class="eyebrow">Files Collected</div>
        <div id="files-list" class="file-list" style="margin-top:8px;">
          <div class="empty">No hay archivos recolectados</div>
        </div>
        <div id="preview-section" class="preview-section" style="display:none;">
          <div class="preview-title">Package Preview</div>
          <div id="preview-meta" class="preview-meta"></div>
        </div>
      </section>

      <section class="panel">
        <div class="eyebrow">Export</div>
        <div id="export-controls" style="margin-top:8px;">
          <button id="btn-create-package" class="danger" onclick="initiateCreatePackage()" disabled>Create Package (ZIP)</button>
          <button id="btn-download" class="secondary" onclick="downloadPackage()" disabled style="display:none;">Download ZIP</button>
        </div>
        <div id="export-result" style="margin-top:12px;"></div>
      </section>

      <section class="panel">
        <div class="eyebrow">Validation Report</div>
        <div id="validation-report" style="margin-top:8px;">
          <div class="empty">Ejecuta la validación para ver el reporte</div>
        </div>
      </section>
    </main>

    <div id="confirm-modal" class="modal-overlay" style="display:none;">
      <div class="modal">
        <h3>Confirm Package Creation</h3>
        <div class="warning-box">⚠️ Esta acción creará un archivo ZIP con todos los archivos del paquete. Esta acción no se puede deshacer.</div>
        <p>Job: <strong id="confirm-job-name"></strong></p>
        <p>Archivos: <strong id="confirm-file-count"></strong></p>
        <div class="modal-actions">
          <button class="secondary" onclick="closeConfirmModal()">Cancel</button>
          <button class="danger" id="btn-confirm-create" onclick="confirmCreatePackage()">Create Package</button>
        </div>
      </div>
    </div>

    <script>
      let currentState = {
        jobName: null,
        files: [],
        checklist: [],
        validated: false,
        exportReady: false,
        packagePath: null
      };

      async function callTool(name, payload) {
        if (!window.openai || typeof window.openai.callTool !== 'function') {
          throw new Error('window.openai.callTool no disponible');
        }
        return await window.openai.callTool(name, payload);
      }

      function formatSize(bytes) {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
      }

      function updateStats() {
        const totalSize = currentState.files.reduce((sum, f) => sum + (f.size || 0), 0);
        const passCount = currentState.checklist.filter(c => c.status === 'pass').length;
        const failCount = currentState.checklist.filter(c => c.status === 'fail').length;

        document.getElementById('stat-files').textContent = currentState.files.length;
        document.getElementById('stat-size').textContent = formatSize(totalSize);
        document.getElementById('stat-checks-pass').textContent = passCount;
        document.getElementById('stat-checks-fail').textContent = failCount;

        const badges = document.getElementById('status-badges');
        let html = '';
        if (currentState.files.length > 0) {
          html += '<span class="badge info">' + currentState.files.length + ' files collected</span>';
        }
        if (currentState.validated) {
          if (failCount === 0) {
            html += '<span class="badge success">Checklist passed</span>';
          } else {
            html += '<span class="badge error">' + failCount + ' checks failed</span>';
          }
        }
        if (currentState.exportReady) {
          html += '<span class="badge success">Ready to export</span>';
        }
        badges.innerHTML = html;
      }

      function renderChecklist() {
        const container = document.getElementById('checklist');
        if (!currentState.checklist.length) {
          container.innerHTML = '<div class="empty">No checklist items. Collect files first.</div>';
          return;
        }

        container.innerHTML = currentState.checklist.map(item => {
          const icon = item.status === 'pass' ? '✓' : item.status === 'fail' ? '✗' : '○';
          const cls = item.status || 'pending';
          return '<div class="check-item ' + cls + '">' +
            '<span class="check-icon ' + cls + '">' + icon + '</span>' +
            '<div style="flex:1;">' +
              '<div class="check-label">' + escapeHtml(item.label || item.name || item.item || 'Item') + '</div>' +
              (item.message ? '<div class="check-meta">' + escapeHtml(item.message) + '</div>' : '') +
            '</div>' +
          '</div>';
        }).join('');
      }

      function renderFiles() {
        const container = document.getElementById('files-list');
        if (!currentState.files.length) {
          container.innerHTML = '<div class="empty">No files collected</div>';
          return;
        }

        container.innerHTML = currentState.files.map(f => {
          const name = f.relativePath || f.path || f.name || 'Unknown';
          const size = f.size ? formatSize(f.size) : '';
          return '<div class="file-item">' +
            '<span class="file-name">' + escapeHtml(name) + '</span>' +
            (size ? '<span class="file-size">' + size + '</span>' : '') +
          '</div>';
        }).join('');
      }

      function renderValidationReport(data) {
        const container = document.getElementById('validation-report');
        if (!data) {
          container.innerHTML = '<div class="empty">Ejecuta la validación para ver el reporte</div>';
          return;
        }

        const report = data.report || data.validationReport || data;
        const passed = report.passedCount || report.passed || 0;
        const failed = report.failedCount || report.failed || 0;
        const items = report.items || report.checklist || report.checks || [];

        if (items.length > 0) {
          container.innerHTML = '<div class="checklist">' + items.map(item => {
            const icon = item.passed || item.status === 'pass' ? '✓' : item.failed || item.status === 'fail' ? '✗' : '○';
            const cls = item.passed ? 'pass' : item.failed ? 'fail' : 'pending';
            return '<div class="check-item ' + cls + '">' +
              '<span class="check-icon ' + cls + '">' + icon + '</span>' +
              '<div style="flex:1;">' +
                '<div class="check-label">' + escapeHtml(item.label || item.name || item.description || 'Item') + '</div>' +
                (item.message ? '<div class="check-meta">' + escapeHtml(item.message) + '</div>' : '') +
              '</div>' +
            '</div>';
          }).join('') + '</div>';
        } else {
          const summary = data.summary || data;
          container.innerHTML = '<div class="success-msg">Validation complete: ' + passed + ' passed, ' + failed + ' failed</div>';
        }
      }

      function showProgress(text, percent) {
        const section = document.getElementById('progress-section');
        section.style.display = 'block';
        document.getElementById('progress-text').textContent = text;
        document.getElementById('progress-fill').style.width = percent + '%';
      }

      function hideProgress() {
        document.getElementById('progress-section').style.display = 'none';
      }

      function updateButtons() {
        const hasJob = !!currentState.jobName;
        const hasFiles = currentState.files.length > 0;
        const hasChecklist = currentState.checklist.length > 0;

        document.getElementById('btn-validate').disabled = !hasFiles;
        document.getElementById('btn-export').disabled = !hasChecklist || !currentState.validated;
        document.getElementById('btn-create-package').disabled = !currentState.exportReady;
        document.getElementById('btn-download').style.display = currentState.packagePath ? 'inline-block' : 'none';
        document.getElementById('btn-download').disabled = !currentState.packagePath;
      }

      async function collectFiles() {
        const jobName = document.getElementById('jobName').value.trim();
        if (!jobName) {
          alert('Ingresa el nombre del job');
          return;
        }

        currentState.jobName = jobName;
        const btn = document.getElementById('btn-collect');
        btn.disabled = true;
        showProgress('Collecting files...', 20);

        try {
          showProgress('Collecting files for ' + jobName + '...', 40);
          const response = await callTool('talend_deliverable_collect_files', { jobName });
          const data = response?.structuredContent?.data ?? response;

          currentState.files = data?.files || data?.collectedFiles || [];
          currentState.checklist = data?.checklist || data?.requirements || [];
          currentState.validated = false;
          currentState.exportReady = false;
          currentState.packagePath = null;

          renderFiles();
          renderChecklist();
          updateStats();
          updateButtons();
          hideProgress();

          document.getElementById('header-badges').innerHTML =
            '<span class="badge info">' + currentState.files.length + ' files</span>';

        } catch (err) {
          hideProgress();
          document.getElementById('files-list').innerHTML =
            '<div class="error-msg">Error: ' + escapeHtml(err.message) + '</div>';
        } finally {
          btn.disabled = false;
        }
      }

      async function validateChecklist() {
        if (!currentState.jobName) return;

        const btn = document.getElementById('btn-validate');
        btn.disabled = true;
        showProgress('Validating checklist...', 30);

        try {
          showProgress('Validating requirements...', 60);
          const response = await callTool('talend_deliverable_validate_checklist', {
            jobName: currentState.jobName
          });
          const data = response?.structuredContent?.data ?? response;

          currentState.checklist = data?.items || data?.checklist || data?.validationResults || data?.results || [];
          currentState.validated = true;

          const failedCount = currentState.checklist.filter(c =>
            c.status === 'fail' || c.failed || c.status === false
          ).length;

          currentState.exportReady = failedCount === 0;

          renderChecklist();
          renderValidationReport(data);
          updateStats();
          updateButtons();
          hideProgress();

          document.getElementById('header-badges').innerHTML =
            '<span class="badge info">' + currentState.files.length + ' files</span>' +
            (currentState.exportReady
              ? '<span class="badge success">Ready to export</span>'
              : '<span class="badge warning">Validation failed</span>');

        } catch (err) {
          hideProgress();
          document.getElementById('validation-report').innerHTML =
            '<div class="error-msg">Error: ' + escapeHtml(err.message) + '</div>';
        } finally {
          btn.disabled = false;
        }
      }

      async function prepareExport() {
        if (!currentState.jobName) return;

        const btn = document.getElementById('btn-export');
        btn.disabled = true;
        showProgress('Preparing export...', 50);

        try {
          showProgress('Preparing export package...', 70);
          const response = await callTool('talend_deliverable_export_job', {
            jobName: currentState.jobName
          });
          const data = response?.structuredContent?.data ?? response;

          const preview = document.getElementById('preview-section');
          const previewMeta = document.getElementById('preview-meta');
          preview.style.display = 'block';

          const totalSize = currentState.files.reduce((sum, f) => sum + (f.size || 0), 0);
          previewMeta.innerHTML =
            '<span>Job: ' + escapeHtml(currentState.jobName) + '</span>' +
            '<span>Files: ' + currentState.files.length + '</span>' +
            '<span>Total size: ' + formatSize(totalSize) + '</span>';

          hideProgress();
          updateButtons();

        } catch (err) {
          hideProgress();
          document.getElementById('export-result').innerHTML =
            '<div class="error-msg">Error: ' + escapeHtml(err.message) + '</div>';
        } finally {
          btn.disabled = false;
        }
      }

      function initiateCreatePackage() {
        if (!currentState.exportReady) return;

        document.getElementById('confirm-job-name').textContent = currentState.jobName;
        document.getElementById('confirm-file-count').textContent = currentState.files.length;
        document.getElementById('confirm-modal').style.display = 'flex';
      }

      function closeConfirmModal() {
        document.getElementById('confirm-modal').style.display = 'none';
      }

      async function confirmCreatePackage() {
        const btn = document.getElementById('btn-confirm-create');
        btn.disabled = true;
        btn.textContent = 'Creating...';

        try {
          const response = await callTool('talend_deliverable_create_package', {
            jobName: currentState.jobName
          });
          const data = response?.structuredContent?.data ?? response;

          currentState.packagePath = data?.path || data?.packagePath || data?.zipPath || data?.filePath;

          closeConfirmModal();
          document.getElementById('export-result').innerHTML =
            '<div class="success-msg">Package created successfully: ' +
            escapeHtml(currentState.packagePath || JSON.stringify(data)) + '</div>';

          updateButtons();

        } catch (err) {
          closeConfirmModal();
          document.getElementById('export-result').innerHTML =
            '<div class="error-msg">Error: ' + escapeHtml(err.message) + '</div>';
        } finally {
          btn.disabled = false;
          btn.textContent = 'Create Package';
        }
      }

      async function downloadPackage() {
        if (!currentState.packagePath) return;
        alert('Download functionality requires native integration. Package path: ' + currentState.packagePath);
      }

      function escapeHtml(str) {
        if (!str) return '';
        return String(str)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      }

      updateButtons();
    </script>
  </body>
</html>`;
}

function createComponentCatalogHtml(): string {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Component Catalog</title>
    <style>
      :root { color-scheme: light dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
      body { margin: 0; background: #0b1220; color: #e5eefc; }
      .app { min-height: 100vh; padding: 24px; box-sizing: border-box; display: grid; gap: 20px; }
      .panel { background: rgba(11,18,32,.82); border: 1px solid rgba(148,163,184,.18); border-radius: 18px; padding: 18px; box-shadow: 0 24px 60px rgba(0,0,0,.28); }
      .header { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px; align-items: start; }
      .eyebrow { text-transform: uppercase; letter-spacing: .12em; font-size: 12px; color: #93c5fd; }
      h1 { margin: 4px 0 6px; font-size: 28px; }
      h2 { margin: 4px 0 6px; font-size: 20px; }
      p { margin: 0; color: #cbd5e1; line-height: 1.5; }
      .badges { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
      .badge { font-size: 11px; padding: 4px 10px; border-radius: 6px; background: rgba(56,189,248,.15); color: #38bdf8; }
      .badge.success { background: rgba(52,211,153,.15); color: #34d399; }
      .badge.warning { background: rgba(251,146,60,.15); color: #fb923c; }
      .badge.error { background: rgba(248,113,113,.15); color: #f87171; }
      .badge.info { background: rgba(99,102,241,.15); color: #a78bfa; }
      .badge.purple { background: rgba(168,85,247,.15); color: #c084fc; }
      button { border: 0; border-radius: 12px; padding: 10px 14px; background: linear-gradient(135deg, #38bdf8, #6366f1); color: white; cursor: pointer; font-weight: 600; font-size: 13px; }
      button:hover { filter: brightness(1.05); }
      button.secondary { background: rgba(148,163,184,.2); color: #e5eefc; }
      button:disabled { opacity: 0.5; cursor: not-allowed; }
      input, select { padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(148,163,184,.25); background: rgba(15,23,42,.82); color: #e5eefc; font-size: 13px; }
      input::placeholder { color: #64748b; }
      input { flex: 1; min-width: 200px; }
      select { cursor: pointer; }
      .controls { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; margin-bottom: 16px; }
      .controls-row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
      .form-row { display: flex; gap: 12px; flex-wrap: wrap; align-items: flex-end; }
      .form-group { display: grid; gap: 6px; }
      .form-group label { font-size: 11px; color: #93c5fd; text-transform: uppercase; letter-spacing: .05em; }
      .component-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
      .component-card { background: rgba(15,23,42,.62); border: 1px solid rgba(148,163,184,.12); border-radius: 12px; padding: 14px; cursor: pointer; transition: border-color .2s, background .2s; }
      .component-card:hover { border-color: rgba(56,189,248,.4); background: rgba(56,189,248,.08); }
      .component-card.selected { border-color: #38bdf8; background: rgba(56,189,248,.12); }
      .component-name { font-weight: 600; font-size: 14px; margin-bottom: 6px; color: #e5eefc; }
      .component-meta { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
      .component-desc { font-size: 12px; color: #94a3b8; line-height: 1.4; }
      .detail-section { margin-bottom: 20px; }
      .detail-section:last-child { margin-bottom: 0; }
      .detail-title { font-size: 12px; color: #93c5fd; text-transform: uppercase; letter-spacing: .1em; margin-bottom: 10px; }
      .detail-content { background: rgba(2,6,23,.78); border-radius: 10px; padding: 14px; font-size: 13px; line-height: 1.5; }
      .detail-content pre { margin: 0; white-space: pre-wrap; font-family: monospace; }
      .param-list { display: grid; gap: 6px; }
      .param-item { display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: rgba(15,23,42,.5); border-radius: 6px; font-size: 12px; }
      .param-name { font-family: monospace; color: #38bdf8; }
      .param-type { color: #94a3b8; font-size: 11px; }
      .connector-item { display: inline-flex; padding: 4px 10px; border-radius: 6px; font-size: 12px; background: rgba(99,102,241,.15); color: #a78bfa; margin: 2px; }
      .template-section { background: rgba(15,23,42,.62); border: 1px solid rgba(148,163,184,.1); border-radius: 12px; padding: 14px; margin-top: 12px; }
      .template-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
      .template-title { font-size: 13px; font-weight: 600; }
      .template-code { background: rgba(2,6,23,.78); border-radius: 8px; padding: 12px; font-family: monospace; font-size: 12px; max-height: 300px; overflow-y: auto; white-space: pre-wrap; color: #94a3b8; }
      .empty { color: #64748b; text-align: center; padding: 40px; }
      .empty-sm { color: #64748b; text-align: center; padding: 20px; font-size: 13px; }
      .loading { text-align: center; padding: 40px; color: #64748b; }
      .error-msg { background: rgba(248,113,113,.1); border: 1px solid rgba(248,113,113,.2); border-radius: 12px; padding: 16px; color: #f87171; }
      .result { white-space: pre-wrap; font-size: 13px; line-height: 1.5; color: #cbd5e1; max-height: 300px; overflow-y: auto; }
      .split { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
      .split-three { display: grid; grid-template-columns: 1fr 2fr; gap: 20px; }
      .stats { display: flex; gap: 16px; flex-wrap: wrap; align-items: center; }
      .stat { display: flex; flex-direction: column; align-items: center; padding: 12px 20px; background: rgba(15,23,42,.5); border-radius: 12px; min-width: 80px; }
      .stat-value { font-size: 24px; font-weight: 700; color: #38bdf8; }
      .stat-label { font-size: 11px; color: #94a3b8; margin-top: 4px; }
      .family-filter { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
      .family-btn { padding: 6px 12px; border-radius: 8px; border: 1px solid rgba(148,163,184,.2); background: transparent; color: #94a3b8; cursor: pointer; font-size: 12px; }
      .family-btn:hover { border-color: rgba(56,189,248,.4); color: #38bdf8; }
      .family-btn.active { background: rgba(56,189,248,.15); border-color: rgba(56,189,248,.4); color: #38bdf8; }
      @media (max-width: 1024px) { .split-three { grid-template-columns: 1fr; } .split { grid-template-columns: 1fr; } }
      @media (max-width: 720px) { .header { flex-direction: column; } .controls { flex-direction: column; align-items: stretch; } input { width: 100%; } }
    </style>
  </head>
  <body>
    <main class="app">
      <section class="panel header">
        <div>
          <div class="eyebrow">Component Library</div>
          <h1>Component Catalog</h1>
          <p>Explora, busca e inspecciona componentes de Talend Studio.</p>
        </div>
        <div id="header-badges" class="badges"></div>
      </section>

      <section class="panel">
        <div class="eyebrow">Buscar</div>
        <div class="controls-row">
          <input type="text" id="search-query" placeholder="Buscar componente (ej: mysql, json, map)" onkeyup="handleSearchKeyup(event)" />
          <select id="family-filter">
            <option value="">Todas las familias</option>
            <option value="Input">Input</option>
            <option value="Output">Output</option>
            <option value="Transform">Transform</option>
            <option value="Process">Process</option>
            <option value="Orchestration">Orchestration</option>
            <option value="Connectivity">Connectivity</option>
            <option value="Data Quality">Data Quality</option>
          </select>
          <button id="btn-search" onclick="searchComponents()">Search</button>
          <button class="secondary" onclick="scanComponents()">Scan</button>
        </div>
        <div class="family-filter" id="family-filter-tags"></div>
      </section>

      <div class="split-three">
        <section class="panel">
          <div class="eyebrow">Componentes</div>
          <div id="component-count" style="font-size:12px;color:#94a3b8;margin-bottom:12px;"></div>
          <div id="component-list">
            <div class="empty-sm">Busca o escanea componentes para verlos aquí</div>
          </div>
        </section>

        <section class="panel" id="detail-panel">
          <div class="eyebrow">Detalle</div>
          <div id="component-detail">
            <div class="empty-sm">Selecciona un componente para ver sus detalles</div>
          </div>
        </section>
      </div>

      <section class="panel">
        <div class="eyebrow">Resultado</div>
        <div id="result" class="result">Ejecuta una acción para ver el resultado.</div>
      </section>
    </main>

    <script>
      let catalogStatus = null;
      let currentComponents = [];
      let selectedComponent = null;
      let currentFamily = "";

      async function callTool(name, payload) {
        if (!window.openai || typeof window.openai.callTool !== "function") {
          throw new Error("window.openai.callTool no disponible");
        }
        return await window.openai.callTool(name, payload);
      }

      function setResult(text, data) {
        document.getElementById("result").textContent = text;
      }

      function setHeaderBadges() {
        const badges = document.getElementById("header-badges");
        let html = "";
        if (catalogStatus) {
          if (catalogStatus.scanned) {
            html += '<span class="badge success">Catalog scanned</span>';
            html += '<span class="badge info">' + (catalogStatus.componentCount || 0) + ' components</span>';
          } else {
            html += '<span class="badge warning">Not scanned</span>';
          }
        }
        if (selectedComponent) {
          html += '<span class="badge purple">Selected: ' + selectedComponent.name + '</span>';
        }
        badges.innerHTML = html;
      }

      function renderFamilyFilter() {
        const container = document.getElementById("family-filter-tags");
        const families = ["Input", "Output", "Transform", "Process", "Orchestration", "Connectivity", "Data Quality"];
        container.innerHTML = families.map(f => 
          '<button class="family-btn ' + (currentFamily === f ? 'active' : '') + '" onclick="filterByFamily(\'' + f + '\')">' + f + '</button>'
        ).join('');
      }

      async function loadCatalogStatus() {
        try {
          const response = await callTool("talend_components_catalog_status", {});
          const data = response?.structuredContent?.data ?? response;
          catalogStatus = data;
          setHeaderBadges();
        } catch (err) {
          console.error("Error loading catalog status:", err);
        }
      }

      async function scanComponents() {
        const btn = document.querySelector('button[onclick="scanComponents()"]');
        btn.disabled = true;
        btn.textContent = "Scanning...";
        
        try {
          const response = await callTool("talend_components_scan_installed", {});
          const data = response?.structuredContent?.data ?? response;
          catalogStatus = data;
          setHeaderBadges();
          setResult("Scan completed: " + (data.componentCount || 0) + " components found", data);
          if (data.componentCount > 0) {
            await searchComponents();
          }
        } catch (err) {
          setResult("Error scanning: " + err.message);
        } finally {
          btn.disabled = false;
          btn.textContent = "Scan";
        }
      }

      async function searchComponents() {
        const query = document.getElementById("search-query").value.trim();
        const btn = document.getElementById("btn-search");
        btn.disabled = true;
        btn.textContent = "Searching...";

        try {
          const response = await callTool("talend_components_search", { 
            query: query || " ",
            maxResults: 50 
          });
          const data = response?.structuredContent?.data ?? response;
          currentComponents = data?.results || [];
          renderComponentList();
          document.getElementById("component-count").textContent = currentComponents.length + " componentes encontrados";
          setResult("Search completed: " + currentComponents.length + " results");
        } catch (err) {
          setResult("Error searching: " + err.message);
        } finally {
          btn.disabled = false;
          btn.textContent = "Search";
        }
      }

      function filterByFamily(family) {
        currentFamily = currentFamily === family ? "" : family;
        document.getElementById("family-filter").value = currentFamily;
        renderFamilyFilter();
        renderComponentList();
      }

      function renderComponentList() {
        const container = document.getElementById("component-list");
        let components = currentComponents;

        if (currentFamily) {
          components = components.filter(c => {
            const fam = (c.family || c.families || "").toString().toLowerCase();
            return fam.includes(currentFamily.toLowerCase());
          });
        }

        if (!components.length) {
          container.innerHTML = '<div class="empty-sm">No se encontraron componentes</div>';
          return;
        }

        container.innerHTML = '<div class="component-grid">' + components.map(c => {
          const isSelected = selectedComponent && selectedComponent.name === c.name;
          const families = Array.isArray(c.family) ? c.family : (c.families || [c.family || "General"]);
          return '<div class="component-card ' + (isSelected ? 'selected' : '') + '" onclick="selectComponent(\'' + escapeHtml(c.name) + '\')">' +
            '<div class="component-name">' + escapeHtml(c.name) + '</div>' +
            '<div class="component-meta">' +
              families.slice(0, 2).map(f => '<span class="badge">' + escapeHtml(f) + '</span>').join('') +
              (c.version ? '<span class="badge info">v' + escapeHtml(c.version) + '</span>' : '') +
            '</div>' +
            '<div class="component-desc">' + escapeHtml(c.description || c.shortDescription || "Sin descripción") + '</div>' +
          '</div>';
        }).join('') + '</div>';
      }

      async function selectComponent(name) {
        selectedComponent = currentComponents.find(c => c.name === name);
        if (!selectedComponent) return;

        setHeaderBadges();
        renderComponentList();
        await loadComponentDetail(name);
      }

      async function loadComponentDetail(name) {
        const container = document.getElementById("component-detail");
        container.innerHTML = '<div class="loading">Cargando detalles...</div>';

        try {
          const response = await callTool("talend_components_inspect", { componentName: name });
          const data = response?.structuredContent?.data ?? response;
          const component = data?.component || data;
          
          if (!component) {
            container.innerHTML = '<div class="error-msg">No se pudieron cargar los detalles</div>';
            return;
          }

          renderComponentDetail(component);
        } catch (err) {
          container.innerHTML = '<div class="error-msg">Error: ' + escapeHtml(err.message) + '</div>';
        }
      }

      async function loadParameters(name) {
        try {
          const response = await callTool("talend_components_parameters", { componentName: name });
          const data = response?.structuredContent?.data ?? response;
          return data?.parameters || [];
        } catch (err) {
          return [];
        }
      }

      async function loadConnectors(name) {
        try {
          const response = await callTool("talend_components_connectors", { componentName: name });
          const data = response?.structuredContent?.data ?? response;
          return data?.connectors || [];
        } catch (err) {
          return [];
        }
      }

      async function renderComponentDetail(component) {
        const container = document.getElementById("component-detail");
        const name = component.name;

        const [parameters, connectors] = await Promise.all([
          loadParameters(name),
          loadConnectors(name)
        ]);

        const families = Array.isArray(component.family) ? component.family : (component.families || [component.family || "General"]);

        container.innerHTML = \`
          <div class="detail-section">
            <div class="detail-title">Información General</div>
            <div class="detail-content">
              <div style="margin-bottom:8px;">
                <strong style="font-size:16px;color:#e5eefc;">\${escapeHtml(component.name)}</strong>
                \${component.version ? '<span class="badge info" style="margin-left:8px;">v' + escapeHtml(component.version) + '</span>' : ''}
              </div>
              <div style="margin-bottom:8px;">
                <span class="badge">\${families.map(f => escapeHtml(f)).join('</span> <span class="badge">')}</span>
              </div>
              <p style="color:#94a3b8;font-size:13px;margin:8px 0 0;">\${escapeHtml(component.description || component.shortDescription || "Sin descripción disponible")}</p>
            </div>
          </div>

          \${connectors.length > 0 ? \`
          <div class="detail-section">
            <div class="detail-title">Conectores Soportados</div>
            <div class="detail-content">
              \${connectors.map(conn => '<span class="connector-item">' + escapeHtml(conn.name || conn) + '</span>').join('')}
            </div>
          </div>
          \` : ''}

          \${parameters.length > 0 ? \`
          <div class="detail-section">
            <div class="detail-title">Parámetros (\${parameters.length})</div>
            <div class="detail-content">
              <div class="param-list">
                \${parameters.slice(0, 20).map(p => 
                  '<div class="param-item">' +
                    '<span class="param-name">' + escapeHtml(p.name || p.label || p) + '</span>' +
                    '<span class="param-type">' + escapeHtml(p.type || p.dataType || "string") + '</span>' +
                  '</div>'
                ).join('')}
                \${parameters.length > 20 ? '<div class="param-item"><span class="param-name" style="color:#64748b;">... y ' + (parameters.length - 20) + ' más</span></div>' : ''}
              </div>
            </div>
          </div>
          \` : ''}

          \${component.schema !== undefined ? \`
          <div class="detail-section">
            <div class="detail-title">Schema Support</div>
            <div class="detail-content">
              <span class="badge \${component.schema ? 'success' : 'warning'}">\${component.schema ? 'Sí' : 'No'}</span>
            </div>
          </div>
          \` : ''}

          <div class="detail-section">
            <button onclick="generateTemplate('\${escapeHtml(component.name)}')" style="width:100%;">
              Generate Template
            </button>
            <div id="template-output" class="template-section" style="display:none;">
              <div class="template-header">
                <span class="template-title">Código Generado</span>
                <button class="secondary" onclick="copyTemplate()">Copy</button>
              </div>
              <pre id="template-code" class="template-code"></pre>
            </div>
          </div>
        \`;
      }

      async function generateTemplate(componentName) {
        const output = document.getElementById("template-output");
        const code = document.getElementById("template-code");
        output.style.display = "block";
        code.textContent = "Generando template...";

        try {
          const response = await callTool("talend_components_generate_template", { componentName });
          const data = response?.structuredContent?.data ?? response;
          
          if (data?.template || data?.code || data?.fixture) {
            code.textContent = data.template || data.code || data.fixture;
          } else if (data?.ok === false) {
            code.textContent = "// No se pudo generar el template: " + (data.error || "Error desconocido");
          } else {
            code.textContent = JSON.stringify(data, null, 2);
          }
          setResult("Template generated for " + componentName, data);
        } catch (err) {
          code.textContent = "// Error: " + err.message;
          setResult("Error generating template: " + err.message);
        }
      }

      function copyTemplate() {
        const code = document.getElementById("template-code").textContent;
        navigator.clipboard.writeText(code).then(() => {
          setResult("Template copied to clipboard");
        }).catch(() => {
          setResult("Failed to copy template");
        });
      }

      function handleSearchKeyup(event) {
        if (event.key === "Enter") {
          searchComponents();
        }
      }

      function escapeHtml(str) {
        if (!str) return "";
        return String(str)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");
      }

      renderFamilyFilter();
      loadCatalogStatus();
      searchComponents();
    </script>
  </body>
</html>`;
}

function createEnvironmentDoctorHtml(): string {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Environment Doctor</title>
    <style>
      :root { color-scheme: light dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
      body { margin: 0; background: #0b1220; color: #e5eefc; }
      .doctor { min-height: 100vh; padding: 24px; box-sizing: border-box; display: grid; gap: 20px; }
      .header { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px; align-items: start; }
      .eyebrow { text-transform: uppercase; letter-spacing: .12em; font-size: 12px; color: #93c5fd; }
      h1 { margin: 4px 0 6px; font-size: 28px; }
      p { margin: 0; color: #cbd5e1; line-height: 1.5; }
      .panel { background: rgba(11,18,32,.82); border: 1px solid rgba(148,163,184,.18); border-radius: 18px; padding: 18px; box-shadow: 0 24px 60px rgba(0,0,0,.28); }
      .badges { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
      .badge { font-size: 11px; padding: 4px 10px; border-radius: 6px; background: rgba(56,189,248,.15); color: #38bdf8; }
      .badge.success { background: rgba(52,211,153,.15); color: #34d399; }
      .badge.warning { background: rgba(251,146,60,.15); color: #fb923c; }
      .badge.error { background: rgba(248,113,113,.15); color: #f87171; }
      .badge.info { background: rgba(99,102,241,.15); color: #a78bfa; }
      table { width: 100%; border-collapse: collapse; font-size: 13px; }
      th { text-align: left; padding: 10px 12px; background: rgba(15,23,42,.62); border-bottom: 1px solid rgba(148,163,184,.12); color: #94a3b8; font-weight: 500; }
      td { padding: 10px 12px; border-bottom: 1px solid rgba(148,163,184,.08); }
      tr:last-child td { border-bottom: none; }
      .path-cell { font-family: monospace; font-size: 12px; word-break: break-all; }
      .path-ok { color: #34d399; }
      .path-missing { color: #f87171; }
      .path-section { margin-bottom: 16px; }
      .path-section:last-child { margin-bottom: 0; }
      .path-label { font-size: 13px; font-weight: 600; margin-bottom: 8px; color: #e5eefc; }
      .path-triple { display: grid; gap: 4px; }
      .path-row { display: flex; gap: 12px; font-size: 12px; }
      .path-key { color: #94a3b8; min-width: 60px; }
      .path-value { font-family: monospace; word-break: break-all; }
      .check-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid rgba(148,163,184,.08); }
      .check-item:last-child { border-bottom: none; }
      .check-name { font-weight: 500; }
      .check-status { display: flex; gap: 6px; align-items: center; }
      .loading { text-align: center; padding: 40px; color: #64748b; }
      .error-msg { background: rgba(248,113,113,.1); border: 1px solid rgba(248,113,113,.2); border-radius: 12px; padding: 16px; color: #f87171; }
      @media (max-width: 720px) { .header { flex-direction: column; } }
    </style>
  </head>
  <body>
    <main class="doctor">
      <section class="panel header">
        <div>
          <div class="eyebrow">Diagnostic Tool</div>
          <h1>Environment Doctor</h1>
          <p>Diagnostica el entorno de Talend MCP: plataforma, paths, workspace y bridge.</p>
        </div>
        <div id="header-badges" class="badges"></div>
      </section>

      <section id="main-content" class="loading">Cargando diagnóstico...</section>
    </main>

    <script>
      async function loadDiagnosis() {
        const content = document.getElementById('main-content');
        const badges = document.getElementById('header-badges');

        async function callTool(name, payload) {
          if (!window.openai || typeof window.openai.callTool !== 'function') {
            throw new Error('window.openai.callTool no disponible');
          }
          return await window.openai.callTool(name, payload);
        }

        try {
          const response = await callTool('talend_diagnose_environment', {});
          const result = response?.structuredContent?.data ?? response;
          const report = result?.report ?? result;

          if (!report || !report.platform) {
            content.innerHTML = '<div class="error-msg">No se pudo obtener el diagnóstico. Verifica que el bridge esté configurado.</div>';
            return;
          }

          badges.innerHTML = renderBadges(report);
          content.innerHTML = renderDiagnosis(report);
        } catch (err) {
          content.innerHTML = '<div class="error-msg">Error: ' + err.message + '</div>';
        }
      }

      function renderBadges(report) {
        const p = report.platform;
        let html = '<span class="badge ' + getOsBadgeClass(p.runtimeOs) + '">' + p.runtimeOs + '</span>';
        html += '<span class="badge ' + getOsBadgeClass(p.talendHostOs) + '">Talend Host: ' + p.talendHostOs + '</span>';
        html += '<span class="badge info">' + p.pathMode + '</span>';
        if (report.studioProcess?.data?.running) {
          html += '<span class="badge success">Studio running</span>';
        } else {
          html += '<span class="badge warning">Studio stopped</span>';
        }
        if (report.bridgeStatus?.data?.connected) {
          html += '<span class="badge success">Bridge connected</span>';
        } else {
          html += '<span class="badge error">Bridge disconnected</span>';
        }
        return html;
      }

      function getOsBadgeClass(os) {
        if (os === 'windows') return 'info';
        if (os === 'macos') return 'success';
        if (os === 'linux') return 'warning';
        return '';
      }

      function renderDiagnosis(report) {
        const p = report.platform;
        return '<section class="panel path-section">' +
          '<div class="eyebrow">Platform</div>' +
          table([
            ['Runtime OS', p.runtimeOs],
            ['Talend Host OS', p.talendHostOs],
            ['Path Mode', p.pathMode],
            ['WSL', p.isWsl ? 'Yes' : 'No'],
            ['Node Version', p.nodeVersion],
            ['Working Directory', p.cwd],
          ]) +
        '</section>' +

        '<section class="panel path-section">' +
          '<div class="eyebrow">Paths</div>' +
          renderPathTriple('TALEND_PROJECT', report.paths?.TALEND_PROJECT) +
          renderPathTriple('TALEND_WORKSPACE', report.paths?.TALEND_WORKSPACE) +
          renderPathTriple('TALEND_STUDIO_HOME', report.paths?.TALEND_STUDIO_HOME) +
          renderPathTriple('TALEND_STUDIO_PLUGINS_DIR', report.paths?.TALEND_STUDIO_PLUGINS_DIR) +
          renderPathTriple('TALEND_BUILDS_DIR', report.paths?.TALEND_BUILDS_DIR) +
        '</section>' +

        '<section class="panel path-section">' +
          '<div class="eyebrow">Checks</div>' +
          renderCheck('Workspace', report.workspace) +
          renderCheck('Project', report.project) +
          renderCheck('Metadata', report.metadata) +
          renderCheck('Studio Process', report.studioProcess) +
          renderCheck('Bridge Status', report.bridgeStatus) +
        '</section>' +

        '<section class="panel path-section">' +
          '<div class="eyebrow">Environment Variables</div>' +
          renderEnvVars(report.env) +
        '</section>';
      }

      function table(rows) {
        return '<table>' + rows.map(([k, v]) => '<tr><th>' + k + '</th><td>' + (v ?? '<em>undefined</em>') + '</td></tr>').join('') + '</table>';
      }

      function renderPathTriple(name, pathData) {
        if (!pathData) return '';
        const items = [];
        if (pathData.raw) items.push([name + ' (raw)', pathData.raw]);
        if (pathData.mcp) items.push([name + ' (MCP)', pathData.mcp]);
        if (pathData.talendHost) items.push([name + ' (Talend Host)', pathData.talendHost]);
        if (!items.length && pathData.raw === undefined && pathData.mcp === undefined) {
          items.push([name, '<em>not configured</em>']);
        }
        return '<div style="margin-bottom:12px;">' +
          '<div class="path-label">' + name + '</div>' +
          items.map(([label, value]) => '<div class="path-row"><span class="path-key">' + label.split(' ').pop() + ':</span><span class="path-value ' + (value.startsWith('<em>') ? 'path-missing' : 'path-ok') + '">' + value + '</span></div>').join('') +
        '</div>';
      }

      function renderCheck(label, evidence) {
        const ok = evidence?.ok;
        const icon = ok ? '✅' : '❌';
        const cls = ok ? 'success' : 'error';
        const extra = evidence?.data ? ' ' + formatCheckData(evidence.data) : '';
        const error = evidence?.error ? ' (' + evidence.error + ')' : '';
        return '<div class="check-item"><span class="check-name">' + label + '</span><span class="check-status"><span class="badge ' + cls + '">' + icon + ' ' + (ok ? 'OK' : 'Fail') + error + '</span>' + extra + '</span></div>';
      }

      function formatCheckData(data) {
        if (typeof data !== 'object') return '';
        if (data.path) return data.path;
        if (data.projectName) return data.projectName + ' (' + data.jobCount + ' jobs)';
        if (data.running !== undefined) return data.running ? 'PID ' + (data.pid ?? '?') : 'not running';
        if (data.connected !== undefined) return data.host + ':' + data.port;
        return '';
      }

      function renderEnvVars(env) {
        if (!env) return '<p class="loading">No environment data</p>';
        const entries = Object.entries(env).filter(([k, v]) => v !== undefined);
        if (!entries.length) return '<p class="loading">No TALEND_* variables configured</p>';
        return table(entries.map(([k, v]) => [k, v ?? '<em>undefined</em>']));
      }

      loadDiagnosis();
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
  if (app.id === "environment-doctor") {
    return createEnvironmentDoctorHtml();
  }
  if (app.id === "secret-safety") {
    return createSecretSafetyHtml();
  }
  if (app.id === "snapshot-manager") {
    return createSnapshotManagerHtml();
  }
  if (app.id === "deliverables") {
    return createDeliverablesHtml();
  }
  if (app.id === "component-catalog") {
    return createComponentCatalogHtml();
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
