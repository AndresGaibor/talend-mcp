import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";

interface ScoreCardProps {
  score: number;
  totalChecks: number;
  passedChecks: number;
  warningsCount: number;
  errorsCount: number;
}

export function ScoreCard({ score, totalChecks, passedChecks, warningsCount, errorsCount }: ScoreCardProps) {
  const scoreColor = score >= 80 ? "text-emerald-600" : score >= 60 ? "text-amber-600" : "text-rose-600";
  const badgeVariant = score >= 80 ? "success" : score >= 60 ? "warning" : "error";
  const scoreLabel = score >= 80 ? "Aprobado" : score >= 60 ? "Con Warnings" : "Con Errores";

  const circumference = 2 * Math.PI * 15.5;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Validation Score</p>
          <div className="flex items-baseline gap-3 mt-3">
            <span className={`text-6xl font-black ${scoreColor} tabular-nums`}>{score}</span>
            <span className="text-2xl font-light text-gray-400">%</span>
            <Badge variant={badgeVariant} className="text-sm px-3 py-1">{scoreLabel}</Badge>
          </div>
          <div className="flex items-center gap-4 mt-4">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="text-sm text-gray-600">{passedChecks} OK</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span className="text-sm text-gray-600">{warningsCount} Warnings</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              <span className="text-sm text-gray-600">{errorsCount} Errors</span>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">
            {passedChecks} de {totalChecks} verificaciones pasadas
          </p>
        </div>
        <div className="relative w-28 h-28">
          <svg className="w-28 h-28 transform -rotate-90" viewBox="0 0 36 36">
            <circle
              cx="18"
              cy="18"
              r="15.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className="text-gray-100"
            />
            <circle
              cx="18"
              cy="18"
              r="15.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeDasharray={`${circumference}`}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className={`${scoreColor} transition-all duration-700 ease-out`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-gray-800">{score}</span>
            <span className="text-[10px] text-gray-400 uppercase">Score</span>
          </div>
        </div>
      </div>
    </Card>
  );
}