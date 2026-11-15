import { Bell, X } from 'lucide-react';

export interface ToastItem {
  id: string;
  title: string;
  message: string;
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2.5 w-80 max-w-[calc(100vw-2rem)] pointer-events-none"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto glass-strong rounded-[20px] px-4 py-3.5 flex items-start gap-3"
        >
          <div className="w-7 h-7 rounded-xl bg-[#FCE8EC] dark:bg-[#8F3157]/40 text-[#7A2346] dark:text-[#F1BBC8] flex items-center justify-center shrink-0">
            <Bell className="w-3.5 h-3.5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-[#3D1023] dark:text-[#FFF5F6] truncate">
              {toast.title}
            </p>
            <p className="text-xs text-[#795D6B] dark:text-[#D9B7C4] mt-0.5 leading-snug">
              {toast.message}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            aria-label="Dismiss notification"
            className="text-[#A58C98] hover:text-[#7A2346] dark:hover:text-[#FFF5F6] p-1 rounded-lg hover:bg-[#FCE8EC] dark:hover:bg-white/10 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
