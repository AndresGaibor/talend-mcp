import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";

const BG = "#0b0f14";
const PANEL = "#111820";
const BORDER = "#222c38";
const TEXT = "#e6edf3";
const MUTED = "#7d8a99";
const ACCENT = "#4cc38a";
const MONO = "Consolas, 'Cascadia Mono', Menlo, monospace";
const SANS = "'Segoe UI', Inter, system-ui, sans-serif";

export const FPS = 30;
export const WIDTH = 1280;
export const HEIGHT = 640;

const SCENES = { title: 75, mapa: 105, vivo: 360, cierre: 60 } as const;
export const DURATION =
  SCENES.title + SCENES.mapa + SCENES.vivo + SCENES.cierre;

const fade = (frame: number, total: number) =>
  interpolate(frame, [0, 10, total - 10, total], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

const rise = (frame: number, delay = 0) =>
  interpolate(frame, [delay, delay + 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

const Title: React.FC = () => {
  const frame = useCurrentFrame();
  const stats = [
    "240 tools MCP",
    "877 de 897 componentes",
    "Talend Studio 8.0.1",
  ];
  return (
    <AbsoluteFill
      style={{
        opacity: fade(frame, SCENES.title),
        alignItems: "center",
        justifyContent: "center",
        fontFamily: SANS,
      }}
    >
      <div
        style={{
          fontSize: 104,
          fontWeight: 700,
          letterSpacing: -2,
          color: TEXT,
          opacity: rise(frame),
          transform: `translateY(${(1 - rise(frame)) * 16}px)`,
        }}
      >
        Talend <span style={{ color: ACCENT }}>MCP</span>
      </div>
      <div
        style={{
          marginTop: 20,
          fontSize: 30,
          color: MUTED,
          maxWidth: 1100,
          textAlign: "center",
          lineHeight: 1.35,
          opacity: rise(frame, 10),
        }}
      >
        Un agente de IA crea, edita, compila y ejecuta jobs de Qlik Talend
        Studio.
      </div>
      <div style={{ display: "flex", gap: 14, marginTop: 44 }}>
        {stats.map((label, i) => (
          <div
            key={label}
            style={{
              fontFamily: MONO,
              fontSize: 22,
              color: TEXT,
              padding: "10px 18px",
              border: `1px solid ${BORDER}`,
              borderRadius: 8,
              background: PANEL,
              opacity: rise(frame, 24 + i * 8),
            }}
          >
            {label}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

const TerminalFrame: React.FC<{
  title: string;
  children: React.ReactNode;
}> = ({ title, children }) => (
  <div
    style={{
      width: 1040,
      background: PANEL,
      border: `1px solid ${BORDER}`,
      borderRadius: 12,
      overflow: "hidden",
      boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "12px 16px",
        borderBottom: `1px solid ${BORDER}`,
        fontFamily: MONO,
        fontSize: 16,
        color: MUTED,
      }}
    >
      <span style={dot("#ff5f57")} />
      <span style={dot("#febc2e")} />
      <span style={dot("#28c840")} />
      <span style={{ marginLeft: 12 }}>{title}</span>
    </div>
    <div style={{ padding: "22px 28px", fontFamily: MONO, fontSize: 24 }}>
      {children}
    </div>
  </div>
);

const dot = (color: string): React.CSSProperties => ({
  width: 12,
  height: 12,
  borderRadius: 6,
  background: color,
});

const typed = (text: string, frame: number, start: number, cps = 1.4) =>
  text.slice(0, Math.max(0, Math.floor((frame - start) * cps)));

// Salida real de `bun run mapa` (seccion "Tools MCP por preset").
const PRESETS: Array<[string, number]> = [
  ["all", 240],
  ["agent", 55],
  ["core", 22],
  ["jobs", 21],
  ["runs", 11],
  ["bridge", 39],
  ["components", 20],
];

const Mapa: React.FC = () => {
  const frame = useCurrentFrame();
  const command = "bun run mapa";
  const typedCommand = typed(command, frame, 8);
  const done = typedCommand.length === command.length;
  return (
    <AbsoluteFill
      style={{
        opacity: fade(frame, SCENES.mapa),
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <TerminalFrame title="talend-mcp">
        <div style={{ color: TEXT }}>
          <span style={{ color: ACCENT }}>$ </span>
          {typedCommand}
        </div>
        {done && (
          <div style={{ marginTop: 18, color: TEXT }}>
            <div style={{ opacity: rise(frame, 30) }}>
              Tools MCP (240 en total). Por preset (TALEND_MCP_FILTER):
            </div>
            {PRESETS.map(([name, count], i) => (
              <div
                key={name}
                style={{
                  display: "flex",
                  gap: 24,
                  marginTop: 6,
                  opacity: rise(frame, 36 + i * 6),
                  color: name === "agent" ? ACCENT : TEXT,
                }}
              >
                <span style={{ width: 180, paddingLeft: 24 }}>{name}</span>
                <span>{count}</span>
              </div>
            ))}
          </div>
        )}
      </TerminalFrame>
    </AbsoluteFill>
  );
};

// Llamadas reales a las tools contra un Talend Studio 8.0.1 abierto, con los
// tiempos medidos en esa ejecucion. `at` es el fotograma en que aparece cada una.
const LLAMADAS = [
  { tool: "talend_job_create_in_studio", detalle: "job nuevo", tiempo: "2,7 s", at: 10 },
  { tool: "talend_job_add_node", detalle: "x3 componentes", tiempo: "146 ms", at: 70 },
  { tool: "talend_job_set_schema", detalle: "x2", tiempo: "50 ms", at: 120 },
  { tool: "talend_job_configure_node", detalle: "monto > 150", tiempo: "9 ms", at: 150 },
  { tool: "talend_job_connect_nodes", detalle: "x2", tiempo: "135 ms", at: 180 },
  { tool: "talend_job_verify", detalle: "compila y ejecuta", tiempo: "5,2 s", at: 215 },
] as const;

// Captura del lienzo de Studio que corresponde a cada momento.
const LIENZOS = [
  { from: 0, file: "canvas-s0.png" },
  { from: 70, file: "canvas-s1.png" },
  { from: 195, file: "canvas-s2.png" },
  { from: 280, file: "canvas-s3.png" },
] as const;

const VERIFY_AT = 280;

const WindowFrame: React.FC<{
  title: string;
  width: number;
  children: React.ReactNode;
}> = ({ title, width, children }) => (
  <div
    style={{
      width,
      background: PANEL,
      border: `1px solid ${BORDER}`,
      borderRadius: 10,
      overflow: "hidden",
      boxShadow: "0 18px 44px rgba(0,0,0,0.4)",
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 7,
        padding: "9px 14px",
        borderBottom: `1px solid ${BORDER}`,
        fontFamily: MONO,
        fontSize: 14,
        color: MUTED,
      }}
    >
      <span style={dot("#ff5f57")} />
      <span style={dot("#febc2e")} />
      <span style={dot("#28c840")} />
      <span style={{ marginLeft: 10 }}>{title}</span>
    </div>
    {children}
  </div>
);

const Vivo: React.FC = () => {
  const frame = useCurrentFrame();
  const lienzo = [...LIENZOS].reverse().find((l) => frame >= l.from) ?? LIENZOS[0];
  const verified = frame >= VERIFY_AT;
  return (
    <AbsoluteFill
      style={{
        opacity: fade(frame, SCENES.vivo),
        fontFamily: SANS,
        padding: "58px 40px 0",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
        <div style={{ fontSize: 34, fontWeight: 700, color: TEXT }}>
          Automatizando Talend Studio
        </div>
        <div style={{ fontSize: 20, color: MUTED }}>
          llamadas reales a las tools, sin tocar la interfaz
        </div>
      </div>
      <div style={{ display: "flex", gap: 24, marginTop: 26 }}>
        <WindowFrame title="cliente MCP" width={440}>
          <div style={{ padding: "16px 18px", fontFamily: MONO, fontSize: 17, minHeight: 330 }}>
            {LLAMADAS.map((c) => (
              <div
                key={c.tool}
                style={{
                  marginBottom: 14,
                  opacity: rise(frame, c.at),
                  color: c.tool === "talend_job_verify" ? ACCENT : TEXT,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>{c.tool}</span>
                  <span style={{ color: MUTED }}>{c.tiempo}</span>
                </div>
                <div style={{ color: MUTED, fontSize: 15, marginTop: 2 }}>{c.detalle}</div>
              </div>
            ))}
            {verified && (
              <div
                style={{
                  marginTop: 6,
                  paddingTop: 12,
                  borderTop: `1px solid ${BORDER}`,
                  opacity: rise(frame, VERIFY_AT),
                  color: TEXT,
                  lineHeight: 1.5,
                }}
              >
                <span style={{ color: ACCENT }}>verdict: ok</span>
                <br />
                compiles: true &nbsp; executed: true
                <br />
                problemas: 0
              </div>
            )}
          </div>
        </WindowFrame>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <WindowFrame title="Talend Studio 8.0.1 | lienzo del job" width={760}>
            <Img
              src={staticFile(lienzo.file)}
              style={{ width: 760, display: "block", background: "#fff" }}
            />
          </WindowFrame>
          <div style={{ opacity: verified ? rise(frame, VERIFY_AT) : 0 }}>
            <WindowFrame title="Talend Studio 8.0.1 | Run" width={760}>
              <Img
                src={staticFile("console.png")}
                style={{ width: 760, display: "block", background: "#fff" }}
              />
            </WindowFrame>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Cierre: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        opacity: fade(frame, SCENES.cierre),
        alignItems: "center",
        justifyContent: "center",
        fontFamily: SANS,
      }}
    >
      <div style={{ fontSize: 56, fontWeight: 700, color: TEXT }}>
        Talend <span style={{ color: ACCENT }}>MCP</span>
      </div>
      <div style={{ marginTop: 16, fontFamily: MONO, fontSize: 24, color: MUTED }}>
        Servidor MCP para Qlik Talend Studio
      </div>
    </AbsoluteFill>
  );
};

export const MyComposition: React.FC = () => {
  let from = 0;
  const at = (n: number) => {
    const start = from;
    from += n;
    return start;
  };
  return (
    <AbsoluteFill style={{ background: BG }}>
      <Sequence from={at(SCENES.title)} durationInFrames={SCENES.title}>
        <Title />
      </Sequence>
      <Sequence from={at(SCENES.mapa)} durationInFrames={SCENES.mapa}>
        <Mapa />
      </Sequence>
      <Sequence from={at(SCENES.vivo)} durationInFrames={SCENES.vivo}>
        <Vivo />
      </Sequence>
      <Sequence from={at(SCENES.cierre)} durationInFrames={SCENES.cierre}>
        <Cierre />
      </Sequence>
    </AbsoluteFill>
  );
};
