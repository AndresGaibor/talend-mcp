import { Card } from "../../components/Card";

export type TaskStatus = "pending" | "in_progress" | "needs_evidence" | "done" | "blocked";

export interface WorkshopTask {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}

interface TaskCardProps {
  task: WorkshopTask;
  onStatusChange: (id: string, newStatus: TaskStatus) => void;
  onDelete: (id: string) => void;
}

const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; bgColor: string; borderColor: string }> = {
  pending: {
    label: "Pending",
    color: "text-gray-700",
    bgColor: "bg-gray-50",
    borderColor: "border-gray-200",
  },
  in_progress: {
    label: "In Progress",
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
  },
  needs_evidence: {
    label: "Needs Evidence",
    color: "text-yellow-700",
    bgColor: "bg-yellow-50",
    borderColor: "border-yellow-200",
  },
  done: {
    label: "Done",
    color: "text-green-700",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
  },
  blocked: {
    label: "Blocked",
    color: "text-red-700",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
  },
};

const STATUS_ORDER: TaskStatus[] = ["pending", "in_progress", "needs_evidence", "done", "blocked"];

export function TaskCard({ task, onStatusChange, onDelete }: TaskCardProps) {
  const config = STATUS_CONFIG[task.status];

  const handleMoveRight = () => {
    const currentIndex = STATUS_ORDER.indexOf(task.status);
    if (currentIndex < STATUS_ORDER.length - 1) {
      onStatusChange(task.id, STATUS_ORDER[currentIndex + 1]);
    }
  };

  const handleMoveLeft = () => {
    const currentIndex = STATUS_ORDER.indexOf(task.status);
    if (currentIndex > 0) {
      onStatusChange(task.id, STATUS_ORDER[currentIndex - 1]);
    }
  };

  return (
    <Card className={`p-3 border-l-4 ${config.borderColor.replace("border", "border-l")}`}>
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-medium text-gray-900 text-sm">{task.title}</h4>
          <button
            onClick={() => onDelete(task.id)}
            className="text-gray-400 hover:text-red-500 text-xs"
            title="Eliminar tarea"
          >
            ✕
          </button>
        </div>
        {task.description && (
          <p className="text-xs text-gray-500">{task.description}</p>
        )}
        <div className="flex items-center justify-between">
          <span className={`text-xs px-2 py-0.5 rounded ${config.bgColor} ${config.color}`}>
            {config.label}
          </span>
          <div className="flex gap-1">
            <button
              onClick={handleMoveLeft}
              disabled={STATUS_ORDER.indexOf(task.status) === 0}
              className="text-xs px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-30"
              title="Mover a la izquierda"
            >
              ←
            </button>
            <button
              onClick={handleMoveRight}
              disabled={STATUS_ORDER.indexOf(task.status) === STATUS_ORDER.length - 1}
              className="text-xs px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-30"
              title="Mover a la derecha"
            >
              →
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}