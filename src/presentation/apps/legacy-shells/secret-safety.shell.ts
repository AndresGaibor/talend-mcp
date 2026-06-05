import { BASE_CSS } from "./shared";

export function createSecretSafetyHtml(): string {
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
