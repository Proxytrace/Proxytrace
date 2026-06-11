import { useCallback, useState, type KeyboardEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { setupApi } from '../../../api/setup';
import { QUERY_KEYS } from '../../../api/query-keys';
import { ModelProviderKind } from '../../../api/models';
import { PROVIDER_ENDPOINTS, PROVIDER_KIND_OPTIONS } from '../setupMeta';
import { useModelLoader } from './useModelLoader';

export function useSetupWizard() {
  const qc = useQueryClient();

  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [apiKeyValue, setApiKeyValue] = useState<string | null>(null);

  // Step 1 — Provider
  const [providerName, setProviderName] = useState('OpenAI');
  const [providerEndpoint, setProviderEndpoint] = useState('https://api.openai.com/v1');
  const [providerApiKey, setProviderApiKey] = useState('');
  const [providerKind, setProviderKind] = useState<ModelProviderKind>(ModelProviderKind.OpenAi);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Step 2 — Model
  const [modelName, setModelName] = useState('');
  const [inputCost, setInputCost] = useState('');
  const [outputCost, setOutputCost] = useState('');

  // Step 3 — Project
  const [projectName, setProjectName] = useState('');

  // Step 4 — API Key
  const [keyName, setKeyName] = useState('default');

  const providerFilled =
    providerName.trim().length > 0 &&
    providerEndpoint.trim().length > 0 &&
    providerApiKey.trim().length > 0;

  const onFirstModel = useCallback((first: string) => {
    setModelName(prev => (prev.trim() === '' ? first : prev));
  }, []);

  const modelLoader = useModelLoader(
    { currentStep, providerName, providerEndpoint, providerApiKey, providerKind, providerFilled },
    onFirstModel,
  );

  const stepValid = [
    providerFilled,
    modelName.trim().length > 0,
    projectName.trim().length > 0,
    keyName.trim().length > 0,
  ];

  function handleNext() {
    setError(null);
    setCurrentStep(s => s + 1);
  }

  function handleBack() {
    if (currentStep > 0) {
      setError(null);
      setCurrentStep(s => s - 1);
    }
  }

  function handleKindChange(kind: ModelProviderKind) {
    const prevLabel = PROVIDER_KIND_OPTIONS.find(o => o.kind === providerKind)?.label ?? '';
    const nextLabel = PROVIDER_KIND_OPTIONS.find(o => o.kind === kind)?.label ?? '';
    setProviderKind(kind);
    setProviderEndpoint(PROVIDER_ENDPOINTS[kind]);
    if (providerName.trim() === '' || providerName === prevLabel) {
      setProviderName(nextLabel);
    }
    setTestResult(null);
    modelLoader.reset();
  }

  async function handleTestConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await setupApi.testConnection({
        providerName: providerName.trim(),
        providerEndpoint: providerEndpoint.trim(),
        providerUpstreamApiKey: providerApiKey.trim(),
        providerKind,
      });
      setTestResult({
        ok: res.success,
        message: res.success ? 'Connection successful.' : (res.error ?? 'Connection failed.'),
      });
    } catch (e) {
      setTestResult({ ok: false, message: e instanceof Error ? e.message : 'Connection failed.' });
    } finally {
      setTesting(false);
    }
  }

  async function handleSubmit() {
    if (done) {
      qc.setQueryData(QUERY_KEYS.setupStatus, { isConfigured: true });
      window.location.assign('/traces');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const result = await setupApi.complete({
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
      try { localStorage.setItem('proxytrace:current-project-id', result.projectId); } catch { /* ignore */ }
      setApiKeyValue(result.apiKeyValue);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }

  const canAdvance = done ? true : (stepValid[currentStep] ?? false) && !loading;

  function handleEnter(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (!canAdvance) return;
    if (currentStep === 3) { void handleSubmit(); } else handleNext();
  }

  return {
    currentStep,
    loading,
    error,
    done,
    apiKeyValue,
    providerName,
    providerEndpoint,
    providerApiKey,
    providerKind,
    testing,
    testResult,
    modelName,
    inputCost,
    outputCost,
    projectName,
    keyName,
    providerFilled,
    canAdvance,
    stepValid,
    // model loader
    models: modelLoader.models,
    modelsLoading: modelLoader.modelsLoading,
    modelsError: modelLoader.modelsError,
    loadModels: modelLoader.loadModels,
    setModels: modelLoader.setModels,
    // setters
    setProviderName,
    setProviderEndpoint,
    setProviderApiKey,
    setModelName,
    setInputCost,
    setOutputCost,
    setProjectName,
    setKeyName,
    setTestResult,
    // handlers
    handleNext,
    handleBack,
    handleSubmit,
    handleKindChange,
    handleTestConnection,
    handleEnter,
  };
}
