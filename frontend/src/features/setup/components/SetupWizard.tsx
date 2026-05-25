import { StepWizard } from '../../../components/overlays/StepWizard';
import { useSetupWizard } from '../hooks/useSetupWizard';
import { STEP_HEADINGS } from '../setupMeta';
import { ProviderStep } from './ProviderStep';
import { ModelStep } from './ModelStep';
import { ProjectStep } from './ProjectStep';
import { ApiKeyStep } from './ApiKeyStep';

export function SetupWizard() {
  const wiz = useSetupWizard();

  const steps = [
    {
      label: 'Provider',
      content: (
        <ProviderStep
          providerKind={wiz.providerKind}
          providerName={wiz.providerName}
          providerEndpoint={wiz.providerEndpoint}
          providerApiKey={wiz.providerApiKey}
          providerFilled={wiz.providerFilled}
          testing={wiz.testing}
          testResult={wiz.testResult}
          error={wiz.currentStep === 0 ? wiz.error : null}
          onKindChange={wiz.handleKindChange}
          onNameChange={(v) => { wiz.setProviderName(v); wiz.setTestResult(null); wiz.setModels(null); }}
          onEndpointChange={(v) => { wiz.setProviderEndpoint(v); wiz.setTestResult(null); wiz.setModels(null); }}
          onApiKeyChange={(v) => { wiz.setProviderApiKey(v); wiz.setTestResult(null); wiz.setModels(null); }}
          onTestConnection={wiz.handleTestConnection}
          onKeyDown={wiz.handleEnter}
        />
      ),
    },
    {
      label: 'Model',
      content: (
        <ModelStep
          modelName={wiz.modelName}
          inputCost={wiz.inputCost}
          outputCost={wiz.outputCost}
          models={wiz.models}
          modelsLoading={wiz.modelsLoading}
          modelsError={wiz.modelsError}
          error={wiz.currentStep === 1 ? wiz.error : null}
          onModelChange={wiz.setModelName}
          onInputCostChange={wiz.setInputCost}
          onOutputCostChange={wiz.setOutputCost}
          onLoadModels={wiz.loadModels}
          onKeyDown={wiz.handleEnter}
        />
      ),
    },
    {
      label: 'Project',
      content: (
        <ProjectStep
          projectName={wiz.projectName}
          error={wiz.currentStep === 2 ? wiz.error : null}
          onProjectNameChange={wiz.setProjectName}
          onKeyDown={wiz.handleEnter}
        />
      ),
    },
    {
      label: 'API Key',
      content: (
        <ApiKeyStep
          done={wiz.done}
          apiKeyValue={wiz.apiKeyValue}
          keyName={wiz.keyName}
          error={wiz.currentStep === 3 ? wiz.error : null}
          onKeyNameChange={wiz.setKeyName}
          onKeyDown={wiz.handleEnter}
        />
      ),
    },
  ];

  const heading = STEP_HEADINGS[wiz.currentStep];

  return (
    <div className="relative min-h-screen bg-surface flex items-center justify-center p-6 sm:p-10 overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_-10%,color-mix(in srgb, var(--accent-primary) 10%, transparent),transparent_55%),radial-gradient(circle_at_80%_110%,color-mix(in srgb, var(--teal) 8%, transparent),transparent_55%)]"
      />

      <div className="relative w-full max-w-[600px]">
        <div className="flex items-center justify-between mb-7">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-base bg-[image:var(--grad-accent-hover)] shadow-[var(--shadow-btn)]">
              T
            </div>
            <div>
              <div className="font-bold text-[15px] tracking-[-0.01em] text-primary leading-tight">Proxytrace</div>
              <div className="text-[11px] text-muted">Agent observability platform</div>
            </div>
          </div>
          <div className="text-[11px] text-muted hidden sm:block">~ 2 minutes</div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-7 sm:p-8 shadow-[var(--shadow-float)] backdrop-blur-sm">
          {!wiz.done && heading && (
            <div className="mb-7">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-accent mb-2">
                {`Step ${wiz.currentStep + 1}`}
              </div>
              <h1 className="text-[20px] font-bold text-primary leading-snug tracking-[-0.01em]">
                {heading.title}
              </h1>
              <p className="text-[13px] text-secondary mt-1.5 leading-relaxed">
                {heading.subtitle}
              </p>
            </div>
          )}

          <StepWizard
            steps={steps}
            currentStep={wiz.currentStep}
            onNext={wiz.handleNext}
            onBack={wiz.handleBack}
            onSubmit={wiz.handleSubmit}
            canAdvance={wiz.canAdvance}
            submitLabel={wiz.done ? 'Go to Traces →' : 'Generate Key'}
            loading={wiz.loading}
          />
        </div>

        <div className="text-center text-[11px] text-muted mt-6">
          Press <kbd className="px-1.5 py-0.5 rounded bg-card-2 border border-border text-[10px] font-mono text-secondary">Enter</kbd> to continue
        </div>
      </div>
    </div>
  );
}
