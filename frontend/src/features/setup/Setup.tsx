import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { StepWizard } from '../../components/overlays/StepWizard';
import { FormField, formInputCls } from '../../components/ui/FormField';
import { CodeBlock } from '../../components/ui/CodeBlock';
import { useToast } from '../../components/ui/Toast';
import { setupApi } from '../../api/setup';
import { providersApi } from '../../api/providers';
import { ModelProviderKind } from '../../api/models';

interface SetupIds {
  userId: string | null;
  providerId: string | null;
  endpointId: string | null;
  projectId: string | null;
  apiKeyValue: string | null;
}

const PROVIDER_ENDPOINTS: Record<ModelProviderKind, string> = {
  [ModelProviderKind.Anthropic]: 'https://api.anthropic.com/v1',
  [ModelProviderKind.OpenAi]: 'https://api.openai.com/v1',
  [ModelProviderKind.OpenAiCompatible]: '',
  [ModelProviderKind.Unknown]: '',
};

export default function Setup() {
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();

  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const [ids, setIds] = useState<SetupIds>({
    userId: null,
    providerId: null,
    endpointId: null,
    projectId: null,
    apiKeyValue: null,
  });

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

  function isStepAlreadyDone(s: number): boolean {
    switch (s) {
      case 0: return ids.userId !== null;
      case 1: return ids.providerId !== null;
      case 2: return ids.endpointId !== null;
      case 3: return ids.projectId !== null;
      default: return false;
    }
  }

  const stepValid = [
    userName.trim().length > 0,
    providerName.trim().length > 0 && providerEndpoint.trim().length > 0 && providerApiKey.trim().length > 0,
    modelName.trim().length > 0,
    projectName.trim().length > 0,
    keyName.trim().length > 0,
  ];

  async function handleNext() {
    setError(null);

    if (isStepAlreadyDone(currentStep)) {
      setCurrentStep(s => s + 1);
      return;
    }

    setLoading(true);
    try {
      switch (currentStep) {
        case 0: {
          const user = await setupApi.createUser(userName.trim());
          setIds(prev => ({ ...prev, userId: user.id }));
          break;
        }
        case 1: {
          const provider = await providersApi.create({
            name: providerName.trim(),
            endpoint: providerEndpoint.trim(),
            upstreamApiKey: providerApiKey.trim(),
            kind: providerKind,
          });
          setIds(prev => ({ ...prev, providerId: provider.id }));
          break;
        }
        case 2: {
          const endpoint = await providersApi.createModel(ids.providerId!, {
            modelName: modelName.trim(),
            inputTokenCost: inputCost ? parseFloat(inputCost) : null,
            outputTokenCost: outputCost ? parseFloat(outputCost) : null,
          });
          setIds(prev => ({ ...prev, endpointId: endpoint.id }));
          break;
        }
        case 3: {
          const project = await setupApi.createProject(projectName.trim());
          setIds(prev => ({ ...prev, projectId: project.id }));
          break;
        }
      }
      setCurrentStep(s => s + 1);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'An unexpected error occurred.';
      setError(msg);
      toast.show(msg, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    if (done) {
      qc.setQueryData(['setup-status'], { isConfigured: true });
      navigate('/traces');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const key = await providersApi.createKey(ids.providerId!, {
        name: keyName.trim(),
        projectId: ids.projectId!,
      });
      setIds(prev => ({ ...prev, apiKeyValue: key.keyValue }));
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

  const stepContent = [
    // Step 1 — Admin User
    <div key="step-1" className="flex flex-col gap-4">
      <p className="text-[13px] text-muted leading-relaxed">
        Create the first admin user for this Trsr installation.
      </p>
      <FormField label="Your name" error={currentStep === 0 ? error ?? undefined : undefined}>
        <input
          className={formInputCls}
          placeholder="e.g. Jane Smith"
          value={userName}
          onChange={e => setUserName(e.target.value)}
          autoFocus
        />
      </FormField>
    </div>,

    // Step 2 — Provider
    <div key="step-2" className="flex flex-col gap-4">
      <p className="text-[13px] text-muted leading-relaxed">
        Connect an upstream model provider. Trsr will proxy requests to this endpoint.
      </p>
      <FormField label="Provider name">
        <input
          className={formInputCls}
          placeholder="e.g. Anthropic"
          value={providerName}
          onChange={e => setProviderName(e.target.value)}
        />
      </FormField>
      <FormField label="Provider type">
        <select
          className={formInputCls}
          value={providerKind}
          onChange={e => handleKindChange(e.target.value as ModelProviderKind)}
        >
          <option value={ModelProviderKind.Anthropic}>Anthropic</option>
          <option value={ModelProviderKind.OpenAi}>OpenAI</option>
          <option value={ModelProviderKind.OpenAiCompatible}>OpenAI Compatible</option>
        </select>
      </FormField>
      <FormField label="Endpoint URL">
        <input
          className={formInputCls}
          placeholder="https://api.anthropic.com/v1"
          value={providerEndpoint}
          onChange={e => setProviderEndpoint(e.target.value)}
        />
      </FormField>
      <FormField label="Upstream API key" error={currentStep === 1 ? error ?? undefined : undefined}>
        <input
          className={formInputCls}
          type="password"
          placeholder="sk-..."
          value={providerApiKey}
          onChange={e => setProviderApiKey(e.target.value)}
        />
      </FormField>
    </div>,

    // Step 3 — Model
    <div key="step-3" className="flex flex-col gap-4">
      <p className="text-[13px] text-muted leading-relaxed">
        Add a model to route through this provider. Token costs are optional and used for cost tracking.
      </p>
      <FormField label="Model name" error={currentStep === 2 ? error ?? undefined : undefined}>
        <input
          className={formInputCls}
          placeholder="e.g. claude-sonnet-4-5"
          value={modelName}
          onChange={e => setModelName(e.target.value)}
        />
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Input cost / 1M tokens (optional)">
          <input
            className={formInputCls}
            type="number"
            min="0"
            step="0.01"
            placeholder="3.00"
            value={inputCost}
            onChange={e => setInputCost(e.target.value)}
          />
        </FormField>
        <FormField label="Output cost / 1M tokens (optional)">
          <input
            className={formInputCls}
            type="number"
            min="0"
            step="0.01"
            placeholder="15.00"
            value={outputCost}
            onChange={e => setOutputCost(e.target.value)}
          />
        </FormField>
      </div>
    </div>,

    // Step 4 — Project
    <div key="step-4" className="flex flex-col gap-4">
      <p className="text-[13px] text-muted leading-relaxed">
        Create a project to group your agents and traces.
      </p>
      <FormField label="Project name" error={currentStep === 3 ? error ?? undefined : undefined}>
        <input
          className={formInputCls}
          placeholder="e.g. My AI App"
          value={projectName}
          onChange={e => setProjectName(e.target.value)}
        />
      </FormField>
    </div>,

    // Step 5 — API Key
    <div key="step-5" className="flex flex-col gap-4">
      {done && ids.apiKeyValue ? (
        <div className="flex flex-col gap-4">
          <p className="text-[13px] text-muted leading-relaxed">
            Your installation is ready. Point any OpenAI-compatible client at the Trsr proxy using this key.
          </p>
          <CodeBlock
            heading="Your Trsr API key — save it now"
            content={ids.apiKeyValue}
            maxLines={1}
          />
          <CodeBlock
            heading="Proxy endpoint usage"
            content={`POST http://localhost:5001/openai/v1/chat/completions\nAuthorization: Bearer ${ids.apiKeyValue}\nContent-Type: application/json`}
            maxLines={5}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-[13px] text-muted leading-relaxed">
            Generate a Trsr API key. Use it instead of your upstream key — Trsr will proxy and record all calls.
          </p>
          <FormField label="Key name" error={currentStep === 4 ? error ?? undefined : undefined}>
            <input
              className={formInputCls}
              placeholder="default"
              value={keyName}
              onChange={e => setKeyName(e.target.value)}
            />
          </FormField>
        </div>
      )}
    </div>,
  ];

  const steps = [
    { label: 'Admin User', content: stepContent[0] },
    { label: 'Provider', content: stepContent[1] },
    { label: 'Model', content: stepContent[2] },
    { label: 'Project', content: stepContent[3] },
    { label: 'API Key', content: stepContent[4] },
  ];

  const canAdvance = done
    ? true
    : (stepValid[currentStep] ?? false) && !loading;

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-8">
      <div className="w-full max-w-[560px]">
        {/* Brand */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-[15px] bg-[linear-gradient(135deg,#c9944a,#a57038)] shadow-[0_4px_16px_-4px_rgba(201,148,74,0.55)]">
            T
          </div>
          <div>
            <div className="font-bold text-base tracking-[-0.01em] text-primary">Trsr</div>
            <div className="text-[11px] text-muted">First-time setup</div>
          </div>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl p-8 shadow-[var(--shadow-card)]">
          <div className="mb-6">
            <h1 className="text-[17px] font-bold text-primary leading-snug">Welcome to Trsr</h1>
            <p className="text-[13px] text-muted mt-1">
              Let's set up your installation. This takes about 2 minutes.
            </p>
          </div>

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
      </div>
    </div>
  );
}
