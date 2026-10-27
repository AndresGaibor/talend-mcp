import React from "react";
import {
  AbsoluteFill,
  Easing,
  Sequence,
  interpolate,
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

const SCENES = { title: 90, mapa: 150, flujo: 150, cierre: 60 } as const;
export const DURATION =
  SCENES.title + SCENES.mapa + SCENES.flujo + SCENES.cierre;

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

// Pasos del flujo "crear-job" de `talend_guide`.
const PASOS = [
  "talend_guide",
  "talend_components_definition",
  "talend_job_create_in_studio",
  "talend_job_add_node",
  "talend_job_set_schema",
  "talend_job_connect_nodes",
  "talend_job_verify",
];

const Flujo: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        opacity: fade(frame, SCENES.flujo),
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <TerminalFrame title="flujo crear-job">
        <div style={{ color: MUTED, fontSize: 20, marginBottom: 14 }}>
          El asistente encadena las tools; la ultima comprueba el resultado.
        </div>
        {PASOS.map((name, i) => {
          const last = i === PASOS.length - 1;
          return (
            <div
              key={name}
              style={{
                display: "flex",
                gap: 16,
                marginTop: 8,
                opacity: rise(frame, 6 + i * 14),
                color: last ? ACCENT : TEXT,
              }}
            >
              <span style={{ color: MUTED, width: 32 }}>{i + 1}.</span>
              <span>{name}</span>
              {last && (
                <span style={{ color: MUTED, fontSize: 20, alignSelf: "center" }}>
                  diseno, compilacion, ejecucion y avisos
                </span>
              )}
            </div>
          );
        })}
      </TerminalFrame>
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
        github.com/AndresGaibor/talend-mcp
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
      <Sequence from={at(SCENES.flujo)} durationInFrames={SCENES.flujo}>
        <Flujo />
      </Sequence>
      <Sequence from={at(SCENES.cierre)} durationInFrames={SCENES.cierre}>
        <Cierre />
      </Sequence>
    </AbsoluteFill>
  );
};
