import { createContext, useCallback, useContext, useState } from 'react';

interface ToastItem { id: number; message: string; type: 'success' | 'error' | 'info'; }

interface ToastContextValue { show: (message: string, type?: ToastItem['type']) => void; }

const ToastContext = createContext<ToastContextValue>({ show: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  let nextId = 0;

  const show = useCallback((message: string, type: ToastItem['type'] = 'info') => {
    const id = ++nextId;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  const typeColor = (t: ToastItem['type']) =>
    t === 'success' ? 'var(--success)' : t === 'error' ? 'var(--danger)' : 'var(--accent-primary)';

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-[100] pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="fade-up bg-card rounded-md px-4 py-2.5 text-title font-medium max-w-[320px] shadow-[var(--shadow-float)]" style={{
            border: `1px solid color-mix(in srgb, ${typeColor(t.type)} 32%, transparent)`,
            color: typeColor(t.type),
          }}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() { return useContext(ToastContext); }
