import { Button } from '../ui/Button';
import { CheckIcon } from '../icons';
import { cn } from '../../lib/cn';

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
  /** Hide the footer submit button on the last step — the step renders its own CTA. */
  hideSubmit?: boolean;
}

export function StepWizard({ steps, currentStep, onNext, onBack, onSubmit, canAdvance = true, submitLabel = 'Create', loading, hideSubmit }: StepWizardProps) {
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
                    isActive ? 'text-primary font-semibold' : isDone ? 'text-secondary font-medium max-sm:hidden' : 'text-muted font-normal max-sm:hidden'
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div className="flex-1 mx-3 h-px bg-border relative overflow-hidden">
                  <div
                    className={cn(
                      'absolute inset-y-0 left-0 bg-success transition-all duration-300',
                      isDone ? 'w-full' : 'w-0',
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Step content — keyed so each step animates in */}
      <div key={currentStep} className="fade-up">{steps[currentStep].content}</div>

      {/* Navigation */}
      <div className="flex justify-between items-center pt-1">
        <Button variant="ghost" onClick={onBack} disabled={currentStep === 0}>
          ← Back
        </Button>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-muted hidden sm:inline">
            Step {currentStep + 1} of {steps.length}
          </span>
          {isLast ? (
            !hideSubmit && (
              <Button variant="primary" onClick={onSubmit} disabled={!canAdvance} loading={loading}>
                {submitLabel}
              </Button>
            )
          ) : (
            <Button variant="primary" onClick={onNext} disabled={!canAdvance}>
              Next →
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
