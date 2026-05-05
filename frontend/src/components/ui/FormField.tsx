interface FormFieldProps {
  label: string;
  error?: string;
  children: React.ReactNode;
}

export const formInputCls = 'w-full px-3 py-[9px] bg-card-2 border border-border rounded-[9px] text-[13px] text-primary font-[inherit] outline-none';

export function FormField({ label, error, children }: FormFieldProps) {
  return (
    <div className="flex flex-col gap-[5px]">
      <label className="text-[11px] font-semibold text-muted uppercase tracking-[0.05em]">{label}</label>
      {children}
      {error && <span className="text-[11px] text-danger">{error}</span>}
    </div>
  );
}
