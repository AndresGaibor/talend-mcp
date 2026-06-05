import { useState, useEffect, useCallback } from "react";
import { useAppSession } from "../../openai/useAppSession";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { TaskCard, type WorkshopTask, type TaskStatus } from "./TaskCard";

const COLUMNS: { id: TaskStatus; label: string; color: string }[] = [
  { id: "pending", label: "Pending", color: "bg-gray-100" },
  { id: "in_progress", label: "In Progress", color: "bg-blue-100" },
  { id: "needs_evidence", label: "Needs Evidence", color: "bg-yellow-100" },
  { id: "done", label: "Done", color: "bg-green-100" },
  { id: "blocked", label: "Blocked", color: "bg-red-100" },
];

const STORAGE_KEY = "workshop_progress_tasks";

export function WorkshopProgressApp() {
  const { session, updateSession } = useAppSession();
  const [tasks, setTasks] = useState<WorkshopTask[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");

  useEffect(() => {
    if (session?.workshopTasks && Array.isArray(session.workshopTasks)) {
      setTasks(session.workshopTasks as WorkshopTask[]);
    } else {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          setTasks(JSON.parse(stored));
        } catch {
          setTasks([]);
        }
      }
    }
  }, [session]);

  const saveTasks = useCallback(async (updatedTasks: WorkshopTask[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedTasks));
    await updateSession({ workshopTasks: updatedTasks });
  }, [updateSession]);

  const handleAddTask = useCallback(() => {
    if (!newTaskTitle.trim()) return;
    const now = new Date().toISOString();
    const newTask: WorkshopTask = {
      id: crypto.randomUUID(),
      title: newTaskTitle.trim(),
      description: newTaskDescription.trim(),
      status: "pending",
      createdAt: now,
      updatedAt: now,
    };
    const updatedTasks = [...tasks, newTask];
    setTasks(updatedTasks);
    saveTasks(updatedTasks);
    setNewTaskTitle("");
    setNewTaskDescription("");
    setShowAddForm(false);
  }, [newTaskTitle, newTaskDescription, tasks, saveTasks]);

  const handleStatusChange = useCallback((id: string, newStatus: TaskStatus) => {
    const updatedTasks = tasks.map((t) =>
      t.id === id ? { ...t, status: newStatus, updatedAt: new Date().toISOString() } : t
    );
    setTasks(updatedTasks);
    saveTasks(updatedTasks);
  }, [tasks, saveTasks]);

  const handleDeleteTask = useCallback((id: string) => {
    const updatedTasks = tasks.filter((t) => t.id !== id);
    setTasks(updatedTasks);
    saveTasks(updatedTasks);
  }, [tasks, saveTasks]);

  const getTasksByStatus = (status: TaskStatus) => {
    return tasks.filter((t) => t.status === status);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Workshop Progress</h2>
          <p className="text-gray-500 mt-1">Gestionar progreso de tareas del workshop</p>
        </div>
        <Button onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? "Cancelar" : "+ Nueva Tarea"}
        </Button>
      </div>

      {showAddForm && (
        <Card className="p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Nueva Tarea</h3>
          <div className="space-y-3">
            <div>
              <label htmlFor="task-title" className="block text-sm font-medium text-gray-700 mb-1">
                Titulo *
              </label>
              <input
                id="task-title"
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Nombre de la tarea"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="task-desc" className="block text-sm font-medium text-gray-700 mb-1">
                Descripcion
              </label>
              <textarea
                id="task-desc"
                value={newTaskDescription}
                onChange={(e) => setNewTaskDescription(e.target.value)}
                placeholder="Descripcion opcional de la tarea"
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="secondary" onClick={() => setShowAddForm(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddTask} disabled={!newTaskTitle.trim()}>
              Crear Tarea
            </Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-5 gap-4 overflow-x-auto">
        {COLUMNS.map((column) => {
          const columnTasks = getTasksByStatus(column.id);
          return (
            <div key={column.id} className="min-w-[200px]">
              <div className={`${column.color} px-3 py-2 rounded-t-lg`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-800 text-sm">{column.label}</h3>
                  <span className="text-xs bg-white px-1.5 py-0.5 rounded-full text-gray-600">
                    {columnTasks.length}
                  </span>
                </div>
              </div>
              <div className="bg-gray-50 border border-t-0 border-gray-200 rounded-b-lg p-2 space-y-2 min-h-[200px]">
                {columnTasks.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">Sin tareas</p>
                ) : (
                  columnTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onStatusChange={handleStatusChange}
                      onDelete={handleDeleteTask}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}