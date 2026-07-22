import { Trans, useLingui } from '@lingui/react/macro';
import { StepWizard } from '../../../components/overlays/StepWizard';
import { BrandMark } from '../../../components/ui/BrandMark';
import { useSetupWizard, SETUP_STEPS } from '../hooks/useSetupWizard';
import { STEP_HEADINGS } from '../setupMeta';
import { WelcomeStep } from './WelcomeStep';
import { ProviderStep } from './ProviderStep';
import { ModelStep } from './ModelStep';
import { ProjectStep } from './ProjectStep';
import { GetStartedStep } from './GetStartedStep';

export function SetupWizard() {
  const { t, i18n } = useLingui();
  const wiz = useSetupWizard();

  const steps = [
    {
      label: t`Welcome`,
      content: <WelcomeStep />,
    },
    {
      label: t`Provider`,
      content: (
        <ProviderStep
          presetId={wiz.presetId}
          providerName={wiz.providerName}
          providerEndpoint={wiz.providerEndpoint}
          providerApiKey={wiz.providerApiKey}
          providerFilled={wiz.providerFilled}
          testing={wiz.testing}
          testResult={wiz.testResult}
          error={wiz.currentStep === SETUP_STEPS.provider ? wiz.error : null}
          onPresetChange={wiz.handlePresetChange}
          onNameChange={(v) => { wiz.setProviderName(v); wiz.setTestResult(null); wiz.resetModels(); }}
          onEndpointChange={(v) => { wiz.setProviderEndpoint(v); wiz.setTestResult(null); wiz.resetModels(); }}
          onApiKeyChange={(v) => { wiz.setProviderApiKey(v); wiz.setTestResult(null); wiz.resetModels(); }}
          onTestConnection={wiz.handleTestConnection}
          onKeyDown={wiz.handleEnter}
        />
      ),
    },
    {
      label: t`Model`,
      content: (
        <ModelStep
          modelName={wiz.modelName}
          models={wiz.models}
          modelsLoading={wiz.modelsLoading}
          modelsError={wiz.modelsError}
          error={wiz.currentStep === SETUP_STEPS.model ? wiz.error : null}
          onModelChange={wiz.setModelName}
          onReloadModels={() => { void wiz.loadModels(true); }}
          onKeyDown={wiz.handleEnter}
        />
      ),
    },
    {
      label: t`Project`,
      content: (
        <ProjectStep
          projectName={wiz.projectName}
          error={wiz.currentStep === SETUP_STEPS.project ? wiz.error : null}
          onProjectNameChange={wiz.setProjectName}
          onKeyDown={wiz.handleEnter}
        />
      ),
    },
    {
      label: t`Get started`,
      content: (
        <GetStartedStep
          projectName={wiz.projectName}
          modelName={wiz.modelName}
          error={wiz.currentStep === SETUP_STEPS.getStarted ? wiz.error : null}
          loading={wiz.loading}
          onGetStarted={() => { void wiz.handleSubmit(); }}
        />
      ),
    },
  ];

  const heading = STEP_HEADINGS[wiz.currentStep];

  return (
    <div className="relative min-h-screen bg-surface flex items-center justify-center p-6 sm:p-10 overflow-hidden">
      <div className="relative w-full max-w-[640px]">
        <div className="flex items-center justify-between mb-7">
          <div className="flex items-center gap-3">
            <BrandMark size={36} />
            <div>
              {/* eslint-disable-next-line lingui/no-unlocalized-strings -- brand name */}
            <div className="font-bold text-h2 tracking-[-0.01em] text-primary leading-tight">Proxytrace</div>
              <div className="text-body-sm text-muted"><Trans>Agent observability platform</Trans></div>
            </div>
          </div>
          <div className="text-body-sm text-muted hidden sm:block"><Trans>~ 2 minutes</Trans></div>
        </div>

        <div className="bg-card border border-border rounded-xl p-7 sm:p-8">
          {heading && (
            <div className="mb-7">
              <div className="text-body-sm font-semibold uppercase tracking-[0.08em] text-accent mb-2">
                <Trans>Step {wiz.currentStep + 1}</Trans>
              </div>
              {/* display-tier: intentional, outside type scale */}
              <h1 className="text-[20px] font-bold text-primary leading-snug tracking-[-0.01em]">
                {i18n._(heading.title)}
              </h1>
              <p className="text-title text-secondary mt-1.5 leading-relaxed">
                {i18n._(heading.subtitle)}
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
            loading={wiz.loading}
            hideSubmit
          />
        </div>

        <div className="text-center text-body-sm text-muted mt-6">
          <Trans>Press <kbd className="px-1.5 py-0.5 rounded-sm bg-card-2 border border-border text-caption font-mono text-secondary">Enter</kbd> to continue</Trans>
        </div>
      </div>
    </div>
  );
}
