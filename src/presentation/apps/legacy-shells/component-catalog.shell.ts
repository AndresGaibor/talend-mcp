import { BASE_CSS } from "./shared";
export function createComponentCatalogHtml(): string {
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

