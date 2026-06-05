import { useState } from "react";

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "info";
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

const variantStyles = {
  danger: {
    icon: "bg-red-100 text-red-600",
    button: "bg-red-600 hover:bg-red-700 focus:ring-red-500",
  },
  warning: {
    icon: "bg-amber-100 text-amber-600",
    button: "bg-amber-600 hover:bg-amber-700 focus:ring-amber-500",
  },
  info: {
    icon: "bg-blue-100 text-blue-600",
    button: "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500",
  },
};

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  onConfirm,
  onCancel,
  isLoading = false,
}: ConfirmDialogProps) {
  const style = variantStyles[variant];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${style.icon}`}>
            <span className="text-lg">
              {variant === "danger" ? "!" : variant === "warning" ? "?" : "i"}
            </span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        </div>
        <p className="text-sm text-gray-600 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 text-sm font-medium text-white rounded-md disabled:opacity-50 ${style.button}`}
          >
            {isLoading ? "Processing..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

type UseConfirmDialogProps = Omit<ConfirmDialogProps, "onConfirm" | "onCancel"> & {
  onConfirmAction?: () => void | Promise<void>;
};

export function useConfirmDialog() {
  const [dialog, setDialog] = useState<{
    props: ConfirmDialogProps;
    resolve: (confirmed: boolean) => void;
  } | null>(null);

  const confirm = (props: UseConfirmDialogProps): Promise<boolean> => {
    return new Promise((resolve) => {
      const action = props.onConfirmAction ?? (() => {});
      setDialog({
        props: {
          title: props.title,
          message: props.message,
          confirmLabel: props.confirmLabel,
          cancelLabel: props.cancelLabel,
          variant: props.variant,
          isLoading: props.isLoading,
          onConfirm: async () => {
            await action();
            setDialog(null);
            resolve(true);
          },
          onCancel: () => {
            setDialog(null);
            resolve(false);
          },
        },
        resolve,
      });
    });
  };

  return {
    dialog,
    confirm,
  };
}
