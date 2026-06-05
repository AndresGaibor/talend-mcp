import type { ActiveJobConnection } from "../types";

interface ComponentConnectionsPanelProps {
  incoming: ActiveJobConnection[];
  outgoing: ActiveJobConnection[];
  onSelectComponent: (name: string) => void;
}

export function ComponentConnectionsPanel({
  incoming,
  outgoing,
  onSelectComponent,
}: ComponentConnectionsPanelProps) {
  const hasIncoming = incoming.length > 0;
  const hasOutgoing = outgoing.length > 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Incoming connections */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
        <h3 className="font-semibold text-gray-800 text-sm flex items-center space-x-2">
          <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
          </svg>
          <span>Conexiones Entrantes ({incoming.length})</span>
        </h3>

        {!hasIncoming ? (
          <div className="text-center text-xs text-gray-400 py-8 bg-gray-50/30 rounded-xl border border-dashed border-gray-100">
            No tiene conexiones de entrada (nodo origen)
          </div>
        ) : (
          <div className="space-y-2.5">
            {incoming.map((conn, idx) => (
              <div
                key={idx}
                className="p-3.5 bg-gray-50/55 rounded-xl border border-gray-100 hover:border-blue-100/50 transition-colors flex items-center justify-between gap-3"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-xs text-gray-800 font-mono">{conn.name}</span>
                    <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded font-medium">
                      {conn.connectorName || conn.type}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400">
                    Desde: <button onClick={() => onSelectComponent(conn.source)} className="text-blue-600 hover:underline font-semibold font-mono">{conn.source}</button>
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Outgoing connections */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
        <h3 className="font-semibold text-gray-800 text-sm flex items-center space-x-2">
          <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 003 3h4a3 3 0 003-3V7a3 3 0 00-3-3h-4a3 3 0 00-3 3v1" />
          </svg>
          <span>Conexiones Salientes ({outgoing.length})</span>
        </h3>

        {!hasOutgoing ? (
          <div className="text-center text-xs text-gray-400 py-8 bg-gray-50/30 rounded-xl border border-dashed border-gray-100">
            No tiene conexiones de salida (nodo terminal)
          </div>
        ) : (
          <div className="space-y-2.5">
            {outgoing.map((conn, idx) => (
              <div
                key={idx}
                className="p-3.5 bg-gray-50/55 rounded-xl border border-gray-100 hover:border-green-100/50 transition-colors flex items-center justify-between gap-3"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-xs text-gray-800 font-mono">{conn.name}</span>
                    <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded font-medium">
                      {conn.connectorName || conn.type}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400">
                    Hacia: <button onClick={() => onSelectComponent(conn.target)} className="text-blue-600 hover:underline font-semibold font-mono">{conn.target}</button>
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
