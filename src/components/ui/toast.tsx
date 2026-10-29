'use client';

import * as React from 'react';
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from 'lucide-react';

import { cn, randomId } from '@/lib/utils';

export type ToastTone = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
  /** 0 keeps the toast until it is dismissed. */
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  push: (toast: Omit<Toast, 'id'>) => string;
  dismiss: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used inside <ToastProvider>');
  }
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const timers = React.useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = React.useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = React.useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = randomId(10);
      setToasts((current) => [...current.slice(-3), { ...toast, id }]);
      const duration = toast.duration ?? (toast.tone === 'error' ? 8000 : 5000);
      if (duration > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), duration),
        );
      }
      return id;
    },
    [dismiss],
  );

  // Clear every pending timer when the provider unmounts.
  React.useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    };
  }, []);

  const value = React.useMemo(
    () => ({ toasts, push, dismiss }),
    [toasts, push, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

const toneConfig: Record<
  ToastTone,
  { icon: React.ElementType; className: string; role: 'status' | 'alert' }
> = {
  success: {
    icon: CheckCircle2,
    className: 'border-success-600/30 bg-success-100 text-success-600',
    role: 'status',
  },
  error: {
    icon: XCircle,
    className: 'border-danger-600/30 bg-danger-100 text-danger-600',
    role: 'alert',
  },
  warning: {
    icon: TriangleAlert,
    className: 'border-warning-600/30 bg-warning-100 text-warning-600',
    role: 'status',
  },
  info: {
    icon: Info,
    className: 'border-info-600/30 bg-info-100 text-info-600',
    role: 'status',
  },
};

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      // Bottom on phones (reachable), top-right on desktop (out of the way).
      className={cn(
        'pointer-events-none fixed inset-x-0 bottom-0 z-[90] flex flex-col gap-2 p-4',
        'sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-0 sm:w-[24rem]',
      )}
    >
      {toasts.map((toast) => {
        const { icon: Icon, className, role } = toneConfig[toast.tone];
        return (
          <div
            key={toast.id}
            role={role}
            aria-live={role === 'alert' ? 'assertive' : 'polite'}
            className={cn(
              'animate-fade-up pointer-events-auto flex items-start gap-3',
              'rounded-lg border px-4 py-3 shadow-[var(--shadow-raised)]',
              className,
            )}
          >
            <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{toast.title}</p>
              {toast.description ? (
                <p className="mt-0.5 text-sm leading-relaxed opacity-90">
                  {toast.description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="-m-1 rounded p-1 opacity-60 transition-opacity hover:opacity-100"
            >
              <X className="size-4" aria-hidden="true" />
              <span className="sr-only">Yopish</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
