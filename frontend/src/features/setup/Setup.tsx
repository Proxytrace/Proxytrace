import { useState, type KeyboardEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { StepWizard } from '../../components/overlays/StepWizard';
import { FormField, formInputCls } from '../../components/ui/FormField';
import { CodeBlock } from '../../components/ui/CodeBlock';
import { useToast } from '../../components/ui/Toast';
import { setupApi } from '../../api/setup';
import { ModelProviderKind } from '../../api/models';

const PROVIDER_ENDPOINTS: Record<ModelProviderKind, string> = {
  [ModelProviderKind.Anthropic]: 'https://api.anthropic.com/v1',
  [ModelProviderKind.OpenAi]: 'https://api.openai.com/v1',
  [ModelProviderKind.OpenAiCompatible]: '',
  [ModelProviderKind.Unknown]: '',
};

const STEP_HEADINGS = [
  { title: 'Create your admin account', subtitle: 'The first user becomes the workspace owner.' },
  { title: 'Connect a model provider', subtitle: 'Trsr proxies and records every call to this upstream API.' },
  { title: 'Add a model', subtitle: 'Pick which model to route through this provider. Costs are optional.' },
  { title: 'Create your project', subtitle: 'Projects group your agents, traces, and benchmarks.' },
  { title: 'Generate your Trsr API key', subtitle: 'Replace your upstream key with this one in your client.' },
];

const PROVIDER_KIND_OPTIONS: { kind: ModelProviderKind; label: string }[] = [
  { kind: ModelProviderKind.Anthropic, label: 'Anthropic' },
  { kind: ModelProviderKind.OpenAi, label: 'OpenAI' },
  { kind: ModelProviderKind.OpenAiCompatible, label: 'OpenAI compatible' },
];

export default function Setup() {
  const toast = useToast();
  const qc = useQueryClient();

  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [apiKeyValue, setApiKeyValue] = useState<string | null>(null);

  // Step 1 — Admin User
  const [userName, setUserName] = useState('');

  // Step 2 — Provider
  const [providerName, setProviderName] = useState('');
  const [providerEndpoint, setProviderEndpoint] = useState('https://api.anthropic.com/v1');
  const [providerApiKey, setProviderApiKey] = useState('');
  const [providerKind, setProviderKind] = useState<ModelProviderKind>(ModelProviderKind.Anthropic);

  // Step 3 — Model
  const [modelName, setModelName] = useState('');
  const [inputCost, setInputCost] = useState('');
  const [outputCost, setOutputCost] = useState('');

  // Step 4 — Project
  const [projectName, setProjectName] = useState('');

  // Step 5 — API Key
  const [keyName, setKeyName] = useState('default');

  const stepValid = [
    userName.trim().length > 0,
    providerName.trim().length > 0 && providerEndpoint.trim().length > 0 && providerApiKey.trim().length > 0,
    modelName.trim().length > 0,
    projectName.trim().length > 0,
    keyName.trim().length > 0,
  ];

  function handleNext() {
    setError(null);
    setCurrentStep(s => s + 1);
  }

  async function handleSubmit() {
    if (done) {
      qc.setQueryData(['setup-status'], { isConfigured: true });
      window.location.assign('/traces');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const result = await setupApi.complete({
        userName: userName.trim(),
        providerName: providerName.trim(),
        providerEndpoint: providerEndpoint.trim(),
        providerUpstreamApiKey: providerApiKey.trim(),
        providerKind,
        modelName: modelName.trim(),
        inputTokenCost: inputCost ? parseFloat(inputCost) : null,
        outputTokenCost: outputCost ? parseFloat(outputCost) : null,
        projectName: projectName.trim(),
        apiKeyName: keyName.trim(),
      });
      try { localStorage.setItem('trsr:current-project-id', result.projectId); } catch { /* ignore */ }
      setApiKeyValue(result.apiKeyValue);
      setDone(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'An unexpected error occurred.';
      setError(msg);
      toast.show(msg, 'error');
    } finally {
      setLoading(false);
    }
  }

  function handleBack() {
    if (currentStep > 0) {
      setError(null);
      setCurrentStep(s => s - 1);
    }
  }

  function handleKindChange(kind: ModelProviderKind) {
    setProviderKind(kind);
    setProviderEndpoint(PROVIDER_ENDPOINTS[kind]);
  }

  const canAdvance = done ? true : (stepValid[currentStep] ?? false) && !loading;

  function handleEnter(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (!canAdvance) return;
    if (currentStep === 4) handleSubmit(); else handleNext();
  }

  const stepContent = [
    // Step 1 — Admin User
    <div key="step-1" className="flex flex-col gap-4">
      <FormField label="Your name" error={currentStep === 0 ? error ?? undefined : undefined}>
        <input
          className={formInputCls}
          placeholder="e.g. Jane Smith"
          value={userName}
          onChange={e => setUserName(e.target.value)}
          onKeyDown={handleEnter}
          autoFocus
        />
      </FormField>
    </div>,

    // Step 2 — Provider
    <div key="step-2" className="flex flex-col gap-4">
      <FormField label="Provider type">
        <div className="grid grid-cols-3 gap-2">
          {PROVIDER_KIND_OPTIONS.map(opt => {
            const active = providerKind === opt.kind;
            return (
              <button
                key={opt.kind}
                type="button"
                onClick={() => handleKindChange(opt.kind)}
                className={`cursor-pointer text-[12px] font-medium px-3 py-[9px] rounded-[9px] border transition-colors duration-150 ${
                  active
                    ? 'bg-accent-subtle border-[color:var(--accent-primary)] text-primary'
                    : 'bg-card-2 border-border text-secondary hover:text-primary hover:border-[color:var(--hairline)]'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </FormField>
      <FormField label="Provider name">
        <input
          className={formInputCls}
          placeholder="e.g. Anthropic Production"
          value={providerName}
          onChange={e => setProviderName(e.target.value)}
          onKeyDown={handleEnter}
        />
      </FormField>
      <FormField label="Endpoint URL">
        <input
          className={formInputCls}
          placeholder="https://api.anthropic.com/v1"
          value={providerEndpoint}
          onChange={e => setProviderEndpoint(e.target.value)}
          onKeyDown={handleEnter}
        />
      </FormField>
      <FormField label="Upstream API key" error={currentStep === 1 ? error ?? undefined : undefined}>
        <input
          className={formInputCls}
          type="password"
          placeholder="sk-..."
          value={providerApiKey}
          onChange={e => setProviderApiKey(e.target.value)}
          onKeyDown={handleEnter}
          autoComplete="off"
        />
      </FormField>
      <p className="text-[11px] text-muted leading-relaxed">
        Stored encrypted. Used only to forward proxied requests upstream.
      </p>
    </div>,

    // Step 3 — Model
    <div key="step-3" className="flex flex-col gap-4">
      <FormField label="Model name" error={currentStep === 2 ? error ?? undefined : undefined}>
        <input
          className={formInputCls}
          placeholder="e.g. claude-sonnet-4-5"
          value={modelName}
          onChange={e => setModelName(e.target.value)}
          onKeyDown={handleEnter}
          autoFocus
        />
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Input cost / 1M tokens">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-muted pointer-events-none">$</span>
            <input
              className={`${formInputCls} pl-6`}
              type="number"
              min="0"
              step="0.01"
              placeholder="3.00"
              value={inputCost}
              onChange={e => setInputCost(e.target.value)}
              onKeyDown={handleEnter}
            />
          </div>
        </FormField>
        <FormField label="Output cost / 1M tokens">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-muted pointer-events-none">$</span>
            <input
              className={`${formInputCls} pl-6`}
              type="number"
              min="0"
              step="0.01"
              placeholder="15.00"
              value={outputCost}
              onChange={e => setOutputCost(e.target.value)}
              onKeyDown={handleEnter}
            />
          </div>
        </FormField>
      </div>
      <p className="text-[11px] text-muted leading-relaxed">
        Costs are optional but enable per-call spend tracking and ROI proposals.
      </p>
    </div>,

    // Step 4 — Project
    <div key="step-4" className="flex flex-col gap-4">
      <FormField label="Project name" error={currentStep === 3 ? error ?? undefined : undefined}>
        <input
          className={formInputCls}
          placeholder="e.g. Customer Support Bot"
          value={projectName}
          onChange={e => setProjectName(e.target.value)}
          onKeyDown={handleEnter}
          autoFocus
        />
      </FormField>
    </div>,

    // Step 5 — API Key
    <div key="step-5">
      {done && apiKeyValue ? (
        <div className="flex flex-col gap-5">
          <div className="flex items-start gap-3 p-4 rounded-xl bg-[var(--success-subtle)] border border-[color:var(--success)]/30">
            <div className="w-8 h-8 rounded-full bg-success flex items-center justify-center shrink-0 mt-px">
              <svg viewBox="0 0 16 16" className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 8.5l3.5 3.5L13 5" />
              </svg>
            </div>
            <div className="flex flex-col gap-0.5">
              <div className="text-[14px] font-semibold text-primary">Setup complete</div>
              <div className="text-[12px] text-secondary leading-relaxed">
                Save the key below — it's shown once and cannot be retrieved later.
              </div>
            </div>
          </div>
          <CodeBlock
            heading="Your Trsr API key"
            content={apiKeyValue}
            maxLines={1}
          />
          <CodeBlock
            heading="Proxy endpoint usage"
            content={`POST http://localhost:5001/openai/v1/chat/completions\nAuthorization: Bearer ${apiKeyValue}\nContent-Type: application/json`}
            maxLines={5}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <FormField label="Key name" error={currentStep === 4 ? error ?? undefined : undefined}>
            <input
              className={formInputCls}
              placeholder="default"
              value={keyName}
              onChange={e => setKeyName(e.target.value)}
              onKeyDown={handleEnter}
              autoFocus
            />
          </FormField>
          <p className="text-[11px] text-muted leading-relaxed">
            Use this key in your application instead of your upstream provider key.
            Trsr will forward the request and record the trace.
          </p>
        </div>
      )}
    </div>,
  ];

  const steps = [
    { label: 'Admin', content: stepContent[0] },
    { label: 'Provider', content: stepContent[1] },
    { label: 'Model', content: stepContent[2] },
    { label: 'Project', content: stepContent[3] },
    { label: 'API Key', content: stepContent[4] },
  ];

  const heading = STEP_HEADINGS[currentStep];

  return (
    <div className="relative min-h-screen bg-surface flex items-center justify-center p-6 sm:p-10 overflow-hidden">
      {/* Ambient backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_-10%,rgba(201,148,74,0.10),transparent_55%),radial-gradient(circle_at_80%_110%,rgba(107,158,170,0.08),transparent_55%)]"
      />

      <div className="relative w-full max-w-[600px]">
        {/* Brand header */}
        <div className="flex items-center justify-between mb-7">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-base bg-[linear-gradient(135deg,#deb073,#a57038)] shadow-[0_6px_20px_-6px_rgba(201,148,74,0.6)]">
              T
            </div>
            <div>
              <div className="font-bold text-[15px] tracking-[-0.01em] text-primary leading-tight">Trsr</div>
              <div className="text-[11px] text-muted">Agent observability platform</div>
            </div>
          </div>
          <div className="text-[11px] text-muted hidden sm:block">~ 2 minutes</div>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl p-7 sm:p-8 shadow-[var(--shadow-float)] backdrop-blur-sm">
          {!done && (
            <div className="mb-7">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-accent mb-2">
                {currentStep === 0 ? 'Welcome' : `Step ${currentStep + 1}`}
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
            currentStep={currentStep}
            onNext={handleNext}
            onBack={handleBack}
            onSubmit={handleSubmit}
            canAdvance={canAdvance}
            submitLabel={done ? 'Go to Traces →' : 'Generate Key'}
            loading={loading}
          />
        </div>

        <div className="text-center text-[11px] text-muted mt-6">
          Press <kbd className="px-1.5 py-0.5 rounded bg-card-2 border border-border text-[10px] font-mono text-secondary">Enter</kbd> to continue
        </div>
      </div>
    </div>
  );
}
