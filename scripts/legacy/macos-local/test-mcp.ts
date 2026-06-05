import { spawn } from "node:child_process";

const TALEND_PROJECT = "/Applications/TalendStudio-8.0.1/studio/workspace/CAPACITACION_GL3-1327321152/PRJ_GENIUS_LAB";

const proc = spawn("bun", ["run", "index.ts"], {
  cwd: "/Users/andresgaibor/code/javascript/talend-mcp",
  stdio: ["pipe", "pipe", "pipe"],
  env: { ...process.env, TALEND_PROJECT },
});

let response = "";
proc.stdout.on("data", (d) => {
  response += d.toString();
});
proc.stderr.on("data", (d) => {
  console.error("STDERR:", d.toString());
});

const send = (obj: unknown) => {
  const line = JSON.stringify(obj) + "\n";
  proc.stdin.write(line);
};

const initParams = {
  protocolVersion: "2024-11-05",
  capabilities: {},
  clientInfo: { name: "test", version: "1.0.0" },
  processId: process.pid,
};

setTimeout(() => {
  send({ jsonrpc: "2.0", id: 1, method: "initialize", params: initParams });
}, 200);

setTimeout(() => {
  send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
}, 500);

setTimeout(() => {
  send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "talend_list_jobs", arguments: {} } });
}, 800);

setTimeout(() => {
  send({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "talend_detect_open_job", arguments: {} } });
}, 1100);

setTimeout(() => {
  send({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "talend_summarize_open_job", arguments: {} } });
}, 1400);

setTimeout(() => {
  send({ jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "talend_show_flow", arguments: { jobName: "lab04_olist_orders_to_staging" } } });
}, 1700);

setTimeout(() => {
  send({ jsonrpc: "2.0", id: 7, method: "tools/call", params: { name: "talend_read_contexts", arguments: { jobName: "lab04_olist_orders_to_staging" } } });
}, 2000);

setTimeout(() => {
  send({ jsonrpc: "2.0", id: 8, method: "tools/call", params: { name: "talend_analyze_tdboutput", arguments: { jobName: "lab04_olist_orders_to_staging" } } });
}, 2300);

setTimeout(async () => {
  await new Promise((r) => setTimeout(r, 3000));
  console.log("=== RAW RESPONSE ===");
  console.log(response);
  proc.kill();
  process.exit(0);
}, 3000);
