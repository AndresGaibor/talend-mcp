interface ErrorBannerProps {
  message: string | null;
  onDismiss?: () => void;
}

export function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  if (!message) return null;

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-start gap-3">
      <span className="text-red-500 text-sm mt-0.5">!</span>
      <p className="text-sm text-red-700 flex-1">{message}</p>
      {onDismiss && (
        <button onClick={onDismiss} className="text-red-400 hover:text-red-600 text-sm">
          x
        </button>
      )}
    </div>
  );
}
