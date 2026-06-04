import type { PresentationAppDefinition } from "./app-types";

function escapeForScript(value: string): string {
  return value.replace(/</g, "\\u003c");
}

export function createPresentationAppShellHtml(app: PresentationAppDefinition): string {
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

        const dangerousPattern = /(create|update|delete|patch|apply|restore|run|stop|start|duplicate|move|execute|save)$/i;
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
