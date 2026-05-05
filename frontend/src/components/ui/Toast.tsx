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
      <div style={{
        position: 'fixed', bottom: '24px', right: '24px',
        display: 'flex', flexDirection: 'column', gap: '8px',
        zIndex: 100, pointerEvents: 'none',
      }}>
        {toasts.map(t => (
          <div key={t.id} className="fade-up" style={{
            padding: '10px 16px', borderRadius: '10px',
            background: 'var(--bg-card)',
            border: `1px solid ${typeColor(t.type)}44`,
            boxShadow: 'var(--shadow-float)',
            fontSize: '13px', fontWeight: 500,
            color: typeColor(t.type),
            maxWidth: '320px',
          }}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() { return useContext(ToastContext); }
