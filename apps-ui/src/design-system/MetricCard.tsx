import type { ReactNode } from "react";

interface MetricCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  variant?: "default" | "success" | "warning" | "error" | "info";
  icon?: ReactNode;
}

const variantBorder = {
  default: "border-gray-200",
  success: "border-emerald-200",
  warning: "border-amber-200",
  error: "border-red-200",
  info: "border-sky-200",
};

const variantLabel = {
  default: "text-gray-500",
  success: "text-emerald-600",
  warning: "text-amber-600",
  error: "text-red-600",
  info: "text-sky-600",
};

const variantValue = {
  default: "text-gray-900",
  success: "text-emerald-700",
  warning: "text-amber-700",
  error: "text-red-700",
  info: "text-sky-700",
};

export function MetricCard({ label, value, sublabel, variant = "default", icon }: MetricCardProps) {
  return (
    <div className={`bg-white rounded-lg border ${variantBorder[variant]} p-4`}>
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-xs font-medium uppercase tracking-wide ${variantLabel[variant]}`}>{label}</p>
          <p className={`text-2xl font-bold mt-1 ${variantValue[variant]}`}>{value}</p>
          {sublabel && <p className="text-xs text-gray-400 mt-1">{sublabel}</p>}
        </div>
        {icon && <div className="text-gray-400">{icon}</div>}
      </div>
    </div>
  );
}
