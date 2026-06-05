import type { PresentationAppDefinition } from "../app-types";
import { BASE_CSS, escapeForScript } from "./shared";

export function createStudioBridgeAppHtml(app: PresentationAppDefinition): string {
  const appJson = escapeForScript(JSON.stringify(app));

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${app.title}</title>
    <style>
      ${BASE_CSS}
      .banner {
        background: linear-gradient(135deg, #dc2626, #b91c1c);
        color: white;
        padding: 16px 20px;
        border-radius: 12px;
        margin-bottom: 20px;
        display: flex;
        align-items: center;
        gap: 16px;
      }
      .banner-icon {
        font-size: 24px;
        flex-shrink: 0;
      }
      .banner-content {
        flex: 1;
      }
      .banner-title {
        font-weight: 700;
        font-size: 15px;
        margin-bottom: 4px;
      }
      .banner-message {
        font-size: 13px;
        opacity: 0.9;
      }
      .banner button {
        background: white;
        color: #dc2626;
        border: none;
        border-radius: 8px;
        padding: 10px 16px;
        font-weight: 600;
        cursor: pointer;
        flex-shrink: 0;
      }
      .banner button:hover {
        filter: brightness(0.95);
      }
      .status-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 16px;
        margin-bottom: 20px;
      }
      .status-card {
        background: rgba(15,23,42,.62);
        border: 1px solid rgba(148,163,184,.16);
        border-radius: 16px;
        padding: 16px;
      }
      .status-card h3 {
        font-size: 12px;
        color: #94a3b8;
        text-transform: uppercase;
        margin: 0 0 8px 0;
      }
      .status-card .value {
        font-size: 24px;
        font-weight: 700;
        color: #e5eefc;
      }
      .status-card .value.ok { color: #4ade80; }
      .status-card .value.warning { color: #fbbf24; }
      .status-card .value.error { color: #f87171; }
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
      button.action-btn { border: 0; border-radius: 12px; padding: 12px 14px; background: linear-gradient(135deg, #38bdf8, #6366f1); color: white; cursor: pointer; font-weight: 600; }
      button.action-btn:hover { filter: brightness(1.05); }
      .result { white-space: pre-wrap; font-size: 13px; line-height: 1.5; color: #cbd5e1; }
      .hint { color: #94a3b8; font-size: 12px; }
      .empty { color: #64748b; }
      @media (max-width: 720px) { .meta { justify-items: start; text-align: left; } .header { flex-direction: column; } }
    </style>
  </head>
  <body>
    <main class="app">
      <section id="outdated-banner" class="banner" style="display: none;">
        <div class="banner-icon">⚠️</div>
        <div class="banner-content">
          <div class="banner-title">Bridge plugin desactualizado</div>
          <div class="banner-message">El plugin de Talend Studio bridge no tiene los endpoints necesarios. Por favor, reinstala el plugin.</div>
        </div>
        <button onclick="window.open('https://talend.com/bridge-reinstall', '_blank')">Ver instrucciones</button>
      </section>

      <section class="panel header">
        <div>
          <div class="eyebrow">Talend MCP</div>
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
        <div class="eyebrow">Estado del Bridge</div>
        <div id="bridge-status" class="status-grid">
          <div class="status-card">
            <h3>Conexión</h3>
            <div id="connection-status" class="value">—</div>
          </div>
          <div class="status-card">
            <h3>Versión</h3>
            <div id="version-status" class="value">—</div>
          </div>
          <div class="status-card">
            <h3>Endpoints</h3>
            <div id="endpoints-status" class="value">—</div>
          </div>
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
    </main>

    <script>
      const app = ${appJson};
      const actionsRoot = document.getElementById("actions");
      const resultRoot = document.getElementById("result");
      const outdatedBanner = document.getElementById("outdated-banner");
      const connectionStatus = document.getElementById("connection-status");
      const versionStatus = document.getElementById("version-status");
      const endpointsStatus = document.getElementById("endpoints-status");

      function renderInitialState(output) {
        const data = output?.initialState ?? output?.structuredContent?.initialState ?? output;
        if (!data) return;

        if (data.bridgeOutdated) {
          outdatedBanner.style.display = "flex";
        }

        if (data.bridgeStatus) {
          const status = data.bridgeStatus;
          connectionStatus.textContent = status.connected ? "Conectado" : "Desconectado";
          connectionStatus.className = "value " + (status.connected ? "ok" : "error");
          versionStatus.textContent = status.version || "—";
          versionStatus.className = "value " + (status.version ? "ok" : "warning");
          endpointsStatus.textContent = status.endpointCount || "0";
          endpointsStatus.className = "value " + (status.endpointCount > 0 ? "ok" : "warning");
        }
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
        button.className = "action-btn";
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

          if (response?.structuredContent?.limitations) {
            outdatedBanner.style.display = "flex";
          }
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