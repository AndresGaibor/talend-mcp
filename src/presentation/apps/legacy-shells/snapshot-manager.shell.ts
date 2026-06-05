import { BASE_CSS } from "./shared";

export function createSnapshotManagerHtml(): string {
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
