import { BASE_CSS } from "./shared";

export function createValidationReportHtml(): string {
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
