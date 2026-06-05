import { BASE_CSS } from "./shared";

export function createDeliverablesHtml(): string {
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
