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
    <div className="flex flex-col gap-5">
      {/* Step indicators */}
      <div className="flex gap-2 items-center">
        {steps.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                i === currentStep
                  ? 'bg-accent text-white border-none'
                  : i < currentStep
                  ? 'bg-success text-white border-none'
                  : 'bg-card-2 text-muted border border-border'
              }`}
            >
              {i < currentStep ? '✓' : i + 1}
            </div>
            <span
              className={`text-xs ${i === currentStep ? 'text-primary font-semibold' : 'text-muted font-normal'}`}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <div className="w-6 h-px bg-border shrink-0" />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div>{steps[currentStep].content}</div>

      {/* Navigation */}
      <div className="flex justify-between items-center">
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
