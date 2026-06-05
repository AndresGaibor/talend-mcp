import { useState, useCallback } from "react";

interface ToolActionButtonProps {
  label: string;
  description?: string;
  variant?: "primary" | "secondary" | "danger";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  disabled?: boolean;
  onExecute: () => void | Promise<void>;
  onConfirm?: () => Promise<boolean>;
}

export function ToolActionButton({
  label,
  description,
  variant = "secondary",
  size = "md",
  isLoading: externalLoading,
  disabled = false,
  onExecute,
  onConfirm,
}: ToolActionButtonProps) {
  const [internalLoading, setInternalLoading] = useState(false);
  const isLoading = externalLoading ?? internalLoading;

  const handleClick = useCallback(async () => {
    if (onConfirm) {
      const confirmed = await onConfirm();
      if (!confirmed) return;
    }
    setInternalLoading(true);
    try {
      await onExecute();
    } finally {
      setInternalLoading(false);
    }
  }, [onConfirm, onExecute]);

  const variantStyles = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500",
    secondary: "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-blue-500",
    danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
  };

  const sizeStyles = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled || isLoading}
      title={description}
      className={`
        inline-flex items-center gap-2 rounded-md font-medium
        focus:outline-none focus:ring-2 focus:ring-offset-2
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-colors
        ${variantStyles[variant]}
        ${sizeStyles[size]}
      `}
    >
      {isLoading && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {label}
    </button>
  );
}
