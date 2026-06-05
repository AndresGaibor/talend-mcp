import { BASE_CSS } from "./shared";

export function createEnvironmentDoctorHtml(): string {
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
