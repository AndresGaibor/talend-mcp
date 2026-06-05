import { Card } from "../../components/Card";
import { Button } from "../../components/Button";

export function HomeQuickActions() {
  return (
    <Card className="p-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
      <div className="flex flex-wrap gap-3">
        <Button variant="primary" size="sm">
          ⚡ Run Job
        </Button>
        <Button variant="secondary" size="sm">
          📸 Take Snapshot
        </Button>
        <Button variant="outline" size="sm">
          🔄 Restart Studio
        </Button>
        <Button variant="ghost" size="sm">
          📊 View Logs
        </Button>
        <Button variant="ghost" size="sm">
          ⚙️ Settings
        </Button>
      </div>
    </Card>
  );
}
