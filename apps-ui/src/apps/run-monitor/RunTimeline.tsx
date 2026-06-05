import { Card } from "../../components/Card";

interface TimelineEvent {
  timestamp: string;
  event: string;
  details?: string;
}

interface RunTimelineProps {
  events: TimelineEvent[];
}

export function RunTimeline({ events }: RunTimelineProps) {
  if (events.length === 0) {
    return (
      <Card className="p-4">
        <p className="text-gray-500">No hay eventos en la línea de tiempo</p>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Línea de Tiempo</h3>
      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
        <div className="space-y-4">
          {events.map((event, idx) => (
            <div key={idx} className="relative flex gap-4 pl-10">
              <div className="absolute left-2.5 w-3 h-3 rounded-full bg-blue-500 border-2 border-white" />
              <div>
                <p className="font-medium text-gray-900">{event.event}</p>
                {event.details && (
                  <p className="text-sm text-gray-500 mt-1">{event.details}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  {event.timestamp ? new Date(event.timestamp).toLocaleString() : "N/A"}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
