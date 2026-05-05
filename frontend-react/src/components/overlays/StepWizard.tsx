interface Step {
  label: string;
  content: React.ReactNode;
}

interface StepWizardProps {
  steps: Step[];
  currentStep: number;
  onNext: () => void;
  onBack: () => void;
  onSubmit: () => void;
  canAdvance?: boolean;
  submitLabel?: string;
  loading?: boolean;
}

export function StepWizard({ steps, currentStep, onNext, onBack, onSubmit, canAdvance = true, submitLabel = 'Create', loading }: StepWizardProps) {
  const isLast = currentStep === steps.length - 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Step indicators */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        {steps.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '24px', height: '24px', borderRadius: '50%',
              background: i === currentStep ? 'var(--accent-primary)' : i < currentStep ? 'var(--success)' : 'var(--bg-card-2)',
              color: i <= currentStep ? '#fff' : 'var(--text-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '11px', fontWeight: 700, flexShrink: 0,
              border: i === currentStep ? 'none' : '1px solid var(--border-color)',
            }}>
              {i < currentStep ? '✓' : i + 1}
            </div>
            <span style={{
              fontSize: '12px', fontWeight: i === currentStep ? 600 : 400,
              color: i === currentStep ? 'var(--text-primary)' : 'var(--text-muted)',
            }}>
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <div style={{ width: '24px', height: '1px', background: 'var(--border-color)', flexShrink: 0 }} />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div>{steps[currentStep].content}</div>

      {/* Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="btn-ghost" onClick={onBack} disabled={currentStep === 0}>
          ← Back
        </button>
        {isLast ? (
          <button className="btn-primary" onClick={onSubmit} disabled={!canAdvance || loading}>
            {loading ? 'Creating…' : submitLabel}
          </button>
        ) : (
          <button className="btn-primary" onClick={onNext} disabled={!canAdvance}>
            Next →
          </button>
        )}
      </div>
    </div>
  );
}
