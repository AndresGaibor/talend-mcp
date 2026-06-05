import { BASE_CSS } from "./shared";

export function createRunMonitorProHtml(): string {
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
            \${r.startedAt ? \`<span>▶ \${r.startedAt.toLocaleTimeString()}</span>\` : ''}
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
            document.getElementById('log-output').innerHTML = '<div class="run-duration">' + (duration / 1000).toFixed(2) + 's</div>';
          }
        } catch (err) {
          setResult('Error: ' + err.message);
        }
      }
    </script>
  </body>
</html>`;
}
