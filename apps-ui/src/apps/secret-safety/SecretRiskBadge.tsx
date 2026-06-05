import { ReactNode } from "react";

type BadgeVariant = "default" | "success" | "warning" | "error" | "info";

interface SecretRiskBadgeProps {
  level: "critical" | "high" | "medium" | "low" | "info";
  children?: ReactNode;
  className?: string;
}

const levelConfig: Record<string, { variant: BadgeVariant; label: string }> = {
  critical: { variant: "error", label: "Critical" },
  high: { variant: "error", label: "High" },
  medium: { variant: "warning", label: "Medium" },
  low: { variant: "success", label: "Low" },
  info: { variant: "default", label: "Info" },
};

export function SecretRiskBadge({ level, children, className = "" }: SecretRiskBadgeProps) {
  const config = levelConfig[level] ?? levelConfig.info;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.variant} ${className}`}
    >
      {children ?? config.label}
    </span>
  );
}