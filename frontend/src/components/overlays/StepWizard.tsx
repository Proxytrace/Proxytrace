import { CheckIcon } from '../icons';

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
    <div className="flex flex-col gap-6">
      {/* Step indicators */}
      <div className="flex items-center w-full">
        {steps.map((s, i) => {
          const isActive = i === currentStep;
          const isDone = i < currentStep;
          return (
            <div key={i} className={`flex items-center ${i < steps.length - 1 ? 'flex-1' : ''}`}>
              <div className="flex items-center gap-2 shrink-0">
                <div
                  className={`relative w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 transition-all duration-200 ${
                    isActive
                      ? 'bg-accent text-white shadow-[0_0_0_4px_var(--accent-subtle)]'
                      : isDone
                      ? 'bg-success text-white'
                      : 'bg-card-2 text-muted border border-border'
                  }`}
                >
                  {isDone ? (
                    <CheckIcon className="w-3.5 h-3.5" strokeWidth={2.5} />
                  ) : (
                    i + 1
                  )}
                </div>
                <span
                  className={`text-xs whitespace-nowrap transition-colors ${
                    isActive ? 'text-primary font-semibold' : isDone ? 'text-secondary font-medium' : 'text-muted font-normal'
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div className="flex-1 mx-3 h-px bg-border relative overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-success transition-all duration-300"
                    style={{ width: isDone ? '100%' : '0%' }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <div>{steps[currentStep].content}</div>

      {/* Navigation */}
      <div className="flex justify-between items-center pt-1">
        <button type="button" className="btn-ghost" onClick={onBack} disabled={currentStep === 0}>
          ← Back
        </button>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-muted hidden sm:inline">
            Step {currentStep + 1} of {steps.length}
          </span>
          {isLast ? (
            <button type="button" className="btn-primary" onClick={onSubmit} disabled={!canAdvance || loading}>
              {loading ? 'Creating…' : submitLabel}
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={onNext} disabled={!canAdvance}>
              Next →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
