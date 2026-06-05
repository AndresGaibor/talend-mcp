import { ReactNode } from "react";

interface ResultPanelProps {
  title?: string;
  children: ReactNode;
  className?: string;
}

export function ResultPanel({ title, children, className = "" }: ResultPanelProps) {
  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {title && (
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-900">{title}</h3>
        </div>
      )}
      <div className="p-4">
        {children}
      </div>
    </div>
  );
}