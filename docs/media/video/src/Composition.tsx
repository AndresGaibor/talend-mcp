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

const SCENES = { title: 75, mapa: 90, chat: 450, cierre: 60 } as const;
export const DURATION =
  SCENES.title + SCENES.mapa + SCENES.chat + SCENES.cierre;

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

// Todo lo de esta escena sale de una ejecucion real contra un Talend Studio 8.0.1
// abierto: las llamadas, sus tiempos, las capturas de Studio y el contenido de los
// archivos. Solo el mensaje del usuario esta escrito a mano.
const PETICION =
  "De ventas.xls, filtrame las ventas de Bogota con monto mayor a 1000 y guardalas en un CSV.";

const COLUMNAS = ["id", "cliente", "ciudad", "producto", "monto"];
const VENTAS: string[][] = [
  ["1", "Ana Torres", "Bogota", "Laptop", "2400"],
  ["2", "Jose Ruiz", "Medellin", "Mouse", "85"],
  ["3", "Lucia Gomez", "Bogota", "Monitor", "980"],
  ["4", "Mateo Diaz", "Cali", "Teclado", "150"],
  ["5", "Sofia Rios", "Bogota", "Tablet", "1350"],
  ["6", "Camilo Vega", "Medellin", "Laptop", "2100"],
  ["7", "Paula Mora", "Bogota", "Impresora", "1100"],
  ["8", "Andres Leon", "Cali", "Monitor", "890"],
];
const FILTRADAS = VENTAS.filter((fila) => ["1", "5", "7"].includes(fila[0]!));

// `at` es el fotograma (dentro de la escena) en que aparece cada llamada.
const LLAMADAS = [
  { tool: "talend_job_create_in_studio", tiempo: "2,6 s", at: 100 },
  { tool: "talend_job_add_node  x3", tiempo: "107 ms", at: 125 },
  { tool: "talend_job_set_schema  x2", tiempo: "52 ms", at: 150 },
  { tool: "talend_job_configure_node  x3", tiempo: "30 ms", at: 175 },
  { tool: "talend_job_connect_nodes  x2", tiempo: "143 ms", at: 200 },
  { tool: "talend_job_verify", tiempo: "5,5 s", at: 225 },
] as const;

// Captura del lienzo de Studio que corresponde a cada momento.
const LIENZOS = [
  { from: 100, file: "canvas-t0.png" },
  { from: 125, file: "canvas-t1.png" },
  { from: 205, file: "canvas-t2.png" },
  { from: 295, file: "canvas-t3.png" },
] as const;

const VERIFY_AT = 295;
const RESPUESTA_AT = 325;

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

const Tabla: React.FC<{ filas: string[][]; ancho: number; tamano?: number }> = ({
  filas,
  ancho,
  tamano = 15,
}) => (
  <div style={{ width: ancho, fontFamily: MONO, fontSize: tamano, color: TEXT }}>
    {[COLUMNAS, ...filas].map((fila, i) => (
      <div
        key={i}
        style={{
          display: "grid",
          gridTemplateColumns: "0.4fr 1.4fr 1fr 1.2fr 0.8fr",
          padding: "5px 12px",
          background: i === 0 ? "#18222d" : "transparent",
          color: i === 0 ? MUTED : TEXT,
          borderTop: i === 0 ? "none" : `1px solid ${BORDER}`,
        }}
      >
        {fila.map((celda, j) => (
          <span key={j} style={{ textAlign: j === 4 ? "right" : "left" }}>
            {celda}
          </span>
        ))}
      </div>
    ))}
  </div>
);

const Chat: React.FC = () => {
  const frame = useCurrentFrame();
  const peticion = typed(PETICION, frame, 8, 1.7);
  const lienzo = [...LIENZOS].reverse().find((l) => frame >= l.from);
  const verified = frame >= VERIFY_AT;
  return (
    <AbsoluteFill
      style={{
        opacity: fade(frame, SCENES.chat),
        fontFamily: SANS,
        padding: "34px 40px 0",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
        <div style={{ fontSize: 32, fontWeight: 700, color: TEXT }}>
          Pidelo en lenguaje natural
        </div>
        <div style={{ fontSize: 19, color: MUTED }}>
          el asistente llama al MCP y Talend Studio hace el trabajo
        </div>
      </div>
      <div style={{ display: "flex", gap: 24, marginTop: 22 }}>
        <WindowFrame title="asistente (cliente MCP)" width={520}>
          <div style={{ padding: "16px 18px", minHeight: 470 }}>
            <div
              style={{
                background: "#1b2a3a",
                border: `1px solid ${BORDER}`,
                borderRadius: 10,
                padding: "10px 14px",
                fontSize: 18,
                color: TEXT,
                lineHeight: 1.4,
                minHeight: 52,
              }}
            >
              {peticion}
            </div>
            <div
              style={{
                marginTop: 16,
                fontSize: 17,
                color: TEXT,
                opacity: rise(frame, 82),
              }}
            >
              Voy a montar el job en Talend Studio.
            </div>
            <div style={{ marginTop: 10, fontFamily: MONO, fontSize: 15 }}>
              {LLAMADAS.map((c) => (
                <div
                  key={c.tool}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: 7,
                    opacity: rise(frame, c.at),
                    color: c.tool === "talend_job_verify" ? ACCENT : TEXT,
                  }}
                >
                  <span>{c.tool}</span>
                  <span style={{ color: MUTED }}>{c.tiempo}</span>
                </div>
              ))}
            </div>
            {frame >= RESPUESTA_AT && (
              <div style={{ marginTop: 16, opacity: rise(frame, RESPUESTA_AT) }}>
                <div style={{ fontSize: 17, color: TEXT, marginBottom: 8 }}>
                  Listo. De 8 ventas, 3 cumplen. Las guarde en{" "}
                  <span style={{ fontFamily: MONO, color: ACCENT }}>
                    ventas_filtradas.csv
                  </span>
                  .
                </div>
                <div
                  style={{
                    border: `1px solid ${BORDER}`,
                    borderRadius: 8,
                    overflow: "hidden",
                  }}
                >
                  <Tabla filas={FILTRADAS} ancho={482} tamano={14} />
                </div>
              </div>
            )}
          </div>
        </WindowFrame>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {lienzo ? (
            <WindowFrame title="Talend Studio 8.0.1 | lienzo del job" width={640}>
              <Img
                src={staticFile(lienzo.file)}
                style={{ width: 640, display: "block", background: "#fff" }}
              />
            </WindowFrame>
          ) : (
            <WindowFrame title="ventas.xls" width={640}>
              <Tabla filas={VENTAS} ancho={640} />
            </WindowFrame>
          )}
          <div style={{ opacity: verified ? rise(frame, VERIFY_AT) : 0 }}>
            <WindowFrame title="Talend Studio 8.0.1 | Run" width={640}>
              <Img
                src={staticFile("console.png")}
                style={{ width: 640, display: "block", background: "#fff" }}
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
      <Sequence from={at(SCENES.chat)} durationInFrames={SCENES.chat}>
        <Chat />
      </Sequence>
      <Sequence from={at(SCENES.cierre)} durationInFrames={SCENES.cierre}>
        <Cierre />
      </Sequence>
    </AbsoluteFill>
  );
};
