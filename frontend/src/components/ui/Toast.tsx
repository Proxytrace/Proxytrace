import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal } from '../overlays/Modal';
import { XIcon } from '../icons';
import { FormField } from './FormField';
import ToastContext, { type ErrorToastOptions, type ToastItem } from '../../contexts/ToastContext';

let globalShow: ((message: string, type: ToastItem['type'], options?: ErrorToastOptions) => void) | null = null;

// eslint-disable-next-line react-refresh/only-export-components
export function showToast(message: string, type: ToastItem['type'] = 'info', options?: ErrorToastOptions) {
  globalShow?.(message, type, options);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const show = useCallback((message: string, type: ToastItem['type'] = 'info', options?: ErrorToastOptions) => {
    const id = ++nextId.current;
    setToasts(prev => [...prev, { id, message, type, ...options }]);

    if (type !== 'error') {
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
    }
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    globalShow = show;
    return () => { globalShow = null; };
  }, [show]);

  const isDev = import.meta.env.DEV;

  const typeColor = (t: ToastItem['type']) =>
    t === 'success' ? 'var(--success)' : t === 'error' ? 'var(--danger)' : 'var(--accent-primary)';

  // Error report modal state
  const [reportTarget, setReportTarget] = useState<{
    toastId: number;
    message: string;
    stacktrace?: string;
    errorType?: string;
    url?: string;
    sendReport?: (details: { description: string; timestamp: string }) => void;
  } | null>(null);

  const [description, setDescription] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = useCallback(async () => {
    if (!reportTarget) return;
    setSending(true);
    await reportTarget.sendReport?.({ description, timestamp: new Date().toISOString() });
    setSending(false);
    setReportTarget(null);
    setDescription('');
    dismiss(reportTarget.toastId);
  }, [reportTarget, description, dismiss]);

  const openReport = useCallback((t: ToastItem) => {
    setReportTarget({
      toastId: t.id,
      message: t.message,
      stacktrace: t.stacktrace,
      errorType: t.errorType,
      url: t.url,
      sendReport: t.sendReport,
    });
    setDescription('');
  }, []);

  const closeReport = useCallback(() => {
    setReportTarget(null);
    setDescription('');
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-[100] pointer-events-none">
        {toasts.map(t =>
          t.type === 'error' ? (
            <div
              key={t.id}
              className="fade-up bg-card rounded-lg px-4 py-3 shadow-[var(--shadow-float)] pointer-events-auto"
              style={{
                border: `1px solid color-mix(in srgb, ${typeColor(t.type)} 32%, transparent)`,
                maxWidth: 420,
              }}
            >
              <div className="flex items-start gap-2">
                <span className="flex-1 text-[14px] font-semibold min-w-0 leading-snug" style={{ color: typeColor(t.type) }}>
                  {t.message}
                </span>
                <div className="flex items-center gap-2 shrink-0 mt-0.5">
                  {t.sendReport && (
                    <button
                      onClick={() => openReport(t)}
                      className="px-2 py-0.5 text-title font-medium text-muted hover:text-primary rounded-md hover:bg-[rgba(255,255,255,0.06)] transition-colors cursor-pointer"
                    >
                      Send
                    </button>
                  )}
                  <button
                    onClick={() => dismiss(t.id)}
                    className="text-muted hover:text-primary transition-colors leading-none cursor-pointer"
                    aria-label="Dismiss"
                  >
                    <XIcon size={16} strokeWidth={1.5} />
                  </button>
                </div>
              </div>
              {isDev && t.stacktrace && (
                <details className="mt-2">
                  <summary className="text-body-sm text-muted cursor-pointer hover:text-secondary transition-colors select-none">
                    Stacktrace
                  </summary>
                  <pre className="mt-1 text-body-sm text-muted font-mono whitespace-pre-wrap overflow-x-auto max-h-[200px] overflow-y-auto">
                    {t.stacktrace}
                  </pre>
                </details>
              )}
            </div>
          ) : (
            <div
              key={t.id}
              className="fade-up bg-card rounded-md px-4 py-2.5 text-[13px] font-medium max-w-[320px] shadow-[var(--shadow-float)]"
              style={{
                border: `1px solid color-mix(in srgb, ${typeColor(t.type)} 32%, transparent)`,
                color: typeColor(t.type),
              }}
            >
              {t.message}
            </div>
          ),
        )}
      </div>

      {reportTarget && (
        <Modal title="Report error" onClose={closeReport} size="sm">
          <div className="flex flex-col gap-3">
            <FormField label="Error message">
              <div className="w-full px-3 py-2 bg-card-2 border border-border rounded-md text-title text-primary">
                {reportTarget.message}
              </div>
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              {reportTarget.errorType && (
                <FormField label="Type">
                  <div className="w-full px-3 py-2 bg-card-2 border border-border rounded-md text-title text-primary">
                    {reportTarget.errorType}
                  </div>
                </FormField>
              )}
              {reportTarget.url && (
                <FormField label="URL">
                  <div className="w-full px-3 py-2 bg-card-2 border border-border rounded-md text-title text-primary truncate">
                    {reportTarget.url}
                  </div>
                </FormField>
              )}
            </div>

            <FormField label="Timestamp">
              <div className="w-full px-3 py-2 bg-card-2 border border-border rounded-md text-title text-primary">
                {new Date().toISOString()}
              </div>
            </FormField>

            {isDev && reportTarget.stacktrace && (
              <FormField label="Stacktrace">
                <pre className="w-full px-3 py-2 bg-card-2 border border-border rounded-md text-body-sm text-muted font-mono whitespace-pre-wrap max-h-[200px] overflow-y-auto">
                  {reportTarget.stacktrace}
                </pre>
              </FormField>
            )}

            <FormField label="Description">
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="What were you doing when this error occurred?"
                rows={3}
                className="w-full px-3 py-2 bg-card-2 border border-border rounded-md text-title text-primary font-[inherit] outline-none transition-[border-color,box-shadow] duration-[var(--motion-fast)] focus:border-accent focus:ring-1 focus:ring-[color-mix(in_srgb,var(--accent-primary)_45%,transparent)] resize-none"
              />
            </FormField>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <button className="btn-ghost" onClick={closeReport}>Cancel</button>
            <button
              data-write
              className="btn-primary"
              onClick={handleSend}
              disabled={sending || !description.trim()}
            >
              {sending ? 'Sending…' : 'Send report'}
            </button>
          </div>
        </Modal>
      )}
    </ToastContext.Provider>
  );
}
