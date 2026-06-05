import { BASE_CSS } from "./shared";

export function createHomeHtml(): string {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Talend Home</title>
    <style>${BASE_CSS}</style>
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
        { label: "List jobs", toolName: "talend_jobs_list", inputMode: "none" },
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
