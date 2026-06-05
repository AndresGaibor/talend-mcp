import type { ActiveJobDetails } from "../types";

interface ActiveJobHeaderProps {
  job: ActiveJobDetails;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export function ActiveJobHeader({ job, onRefresh, isRefreshing }: ActiveJobHeaderProps) {
  const jobName = job.job?.getLabel || job.job?.getName || "Desconocido";
  const jobVersion = job.job?.getVersion || "";
  const isAvailable = job.job?.available;

  return (
    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 0122v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-800">{jobName}</h2>
            <div className="flex items-center space-x-3 text-xs text-gray-500">
              {jobVersion && <span>Versión {jobVersion}</span>}
              <span className="flex items-center space-x-1">
                <span className={`w-2 h-2 rounded-full ${isAvailable ? "bg-green-500" : "bg-gray-300"}`}></span>
                <span>{isAvailable ? "Activo" : "Inactivo"}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {job.activeEditor && (
            <div className="text-right hidden sm:block">
              <p className="text-xs font-medium text-gray-700">{job.activeEditor.title}</p>
              <p className="text-[10px] text-gray-400">
                {job.activeEditor.dirty ? "Modificado" : "Sin cambios"}
              </p>
            </div>
          )}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-950 text-white rounded-xl text-xs font-semibold transition-all shadow-sm flex items-center space-x-1.5 disabled:opacity-50"
          >
            <svg className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18" />
            </svg>
            <span>{isRefreshing ? "Refrescando..." : "Refrescar"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
