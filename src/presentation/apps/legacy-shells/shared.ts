export function escapeForScript(value: string): string {
  return value.replace(/</g, "\\u003c");
}

export const BASE_CSS = `
  :root { color-scheme: light dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
  body { margin: 0; background: #0b1220; color: #e5eefc; }
  .app { min-height: 100vh; padding: 24px; box-sizing: border-box; display: grid; gap: 20px; }
  .panel { background: rgba(11,18,32,.82); border: 1px solid rgba(148,163,184,.18); border-radius: 18px; padding: 18px; box-shadow: 0 24px 60px rgba(0,0,0,.28); }
  .header { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px; align-items: start; }
  .eyebrow { text-transform: uppercase; letter-spacing: .12em; font-size: 12px; color: #93c5fd; }
  h1 { margin: 4px 0 6px; font-size: 28px; }
  p { margin: 0; color: #cbd5e1; line-height: 1.5; }
  button { border: 0; border-radius: 12px; padding: 12px 14px; background: linear-gradient(135deg, #38bdf8, #6366f1); color: white; cursor: pointer; font-weight: 600; font-size: 13px; }
  button:hover { filter: brightness(1.05); }
  button.secondary { background: rgba(148,163,184,.2); color: #e5eefc; }
  button.danger { background: linear-gradient(135deg, #f87171, #dc2626); }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
  input, textarea, select { font: inherit; border-radius: 12px; border: 1px solid rgba(148,163,184,.24); background: rgba(2,6,23,.78); color: #e5eefc; padding: 12px; box-sizing: border-box; }
  input::placeholder, textarea::placeholder { color: #64748b; }
  textarea { min-height: 92px; resize: vertical; }
  select { cursor: pointer; }
  label { font-size: 12px; color: #93c5fd; display: grid; gap: 6px; }
  .badge { display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 11px; background: rgba(56,189,248,.15); color: #38bdf8; }
  .badge.success { background: rgba(52,211,153,.15); color: #34d399; }
  .badge.warning { background: rgba(251,146,60,.15); color: #fb923c; }
  .badge.error { background: rgba(248,113,113,.15); color: #f87171; }
  .badge.info { background: rgba(99,102,241,.15); color: #a78bfa; }
  .tag { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 11px; }
  .tag.info { background: rgba(56,189,248,.15); color: #38bdf8; }
  .tag.success { background: rgba(52,211,153,.15); color: #34d399; }
  .tag.warning { background: rgba(251,146,60,.15); color: #fb923c; }
  .tag.error, .tag.red { background: rgba(248,113,113,.15); color: #f87171; }
  .tag.green { background: rgba(52,211,153,.15); color: #34d399; }
  .tag.yellow { background: rgba(251,191,36,.15); color: #fbbf24; }
  .mono { font-family: monospace; font-size: 12px; }
  .empty { color: #64748b; text-align: center; padding: 40px; }
  .loading { text-align: center; padding: 40px; color: #64748b; }
  .error-msg { background: rgba(248,113,113,.1); border: 1px solid rgba(248,113,113,.2); border-radius: 12px; padding: 16px; color: #f87171; }
  .result { white-space: pre-wrap; font-size: 13px; line-height: 1.5; color: #cbd5e1; }
  .success-msg { background: rgba(52,211,153,.1); border: 1px solid rgba(52,211,153,.2); border-radius: 12px; padding: 16px; color: #34d399; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; padding: 10px 12px; background: rgba(15,23,42,.62); border-bottom: 1px solid rgba(148,163,184,.12); color: #94a3b8; font-weight: 500; }
  td { padding: 10px 12px; border-bottom: 1px solid rgba(148,163,184,.08); }
  tr:hover td { background: rgba(148,163,184,.05); }
  .path-cell { font-family: monospace; font-size: 12px; word-break: break-all; }
  .badges { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
  .controls { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
  .stats { display: flex; gap: 16px; flex-wrap: wrap; align-items: center; }
  .stat { display: flex; flex-direction: column; align-items: center; padding: 12px 20px; background: rgba(15,23,42,.5); border-radius: 12px; min-width: 80px; }
  .stat-value { font-size: 24px; font-weight: 700; color: #38bdf8; }
  .stat-label { font-size: 11px; color: #94a3b8; margin-top: 4px; }
  @media (max-width: 720px) { .header { flex-direction: column; } }
`;
