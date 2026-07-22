import { useCallback, useRef, useState, type KeyboardEvent } from 'react';
import { useLingui } from '@lingui/react/macro';
import { useQueryClient } from '@tanstack/react-query';
import { setupApi } from '../../../api/setup';
import { QUERY_KEYS } from '../../../api/query-keys';
import { providerConnectionErrorMessage } from '../../../lib/providerConnection';
import { presetById, type ProviderPresetId } from '../setupMeta';
import { useModelLoader } from './useModelLoader';

export const SETUP_STEPS = {
  welcome: 0,
  provider: 1,
  model: 2,
  project: 3,
  getStarted: 4,
} as const;

const LAST_STEP = SETUP_STEPS.getStarted;

export function useSetupWizard() {
  const { t, i18n } = useLingui();
  const qc = useQueryClient();

  const [currentStep, setCurrentStep] = useState<number>(SETUP_STEPS.welcome);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step — Provider
  const [presetId, setPresetId] = useState<ProviderPresetId>('openai');
  const [providerName, setProviderName] = useState('OpenAI');
  const [providerEndpoint, setProviderEndpoint] = useState('https://api.openai.com/v1');
  const [providerApiKey, setProviderApiKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    tone: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);
  const testAttempt = useRef(0);

  const providerKind = presetById(presetId).kind;

  // Step — Model
  const [modelName, setModelName] = useState('');

  // Step — Project
  const [projectName, setProjectName] = useState('');

  const providerFilled =
    providerName.trim().length > 0 &&
    providerEndpoint.trim().length > 0 &&
    providerApiKey.trim().length > 0;

  const onFirstModel = useCallback((first: string) => {
    setModelName(prev => (prev.trim() === '' ? first : prev));
  }, []);

  const modelLoader = useModelLoader(
    { providerName, providerEndpoint, providerApiKey, providerKind, providerFilled },
    onFirstModel,
  );

  const stepValid = [
    true,
    providerFilled,
    modelName.trim().length > 0,
    projectName.trim().length > 0,
    true, // Get started — nothing left to enter
  ];

  function handleNext() {
    setError(null);
    // Entering the model step kicks off discovery — models always come from the provider.
    if (currentStep === SETUP_STEPS.provider) void modelLoader.loadModels();
    setCurrentStep(s => s + 1);
  }

  function handleBack() {
    if (currentStep > 0) {
      setError(null);
      setCurrentStep(s => s - 1);
    }
  }

  function handlePresetChange(id: ProviderPresetId) {
    const prev = presetById(presetId);
    const next = presetById(id);
    setPresetId(id);
    setProviderEndpoint(next.endpoint);
    if (providerName.trim() === '' || providerName === prev.defaultName) {
      setProviderName(next.defaultName);
    }
    clearTestResult();
    modelLoader.reset();
  }

  function clearTestResult() {
    testAttempt.current += 1;
    setTestResult(null);
  }

  async function handleTestConnection() {
    const attempt = ++testAttempt.current;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await setupApi.testConnection({
        providerName: providerName.trim(),
        providerEndpoint: providerEndpoint.trim(),
        providerUpstreamApiKey: providerApiKey.trim(),
        providerKind,
      });
      if (attempt !== testAttempt.current) return;
      if (res.success) {
        setTestResult(res.modelCount === 0
          ? { tone: 'warning', message: t`Connected, but the provider reported no models.` }
          : { tone: 'success', message: t`Connection successful.` });
      } else {
        setTestResult({ tone: 'error', message: providerConnectionErrorMessage(i18n, res) });
      }
    } catch (e) {
      if (attempt !== testAttempt.current) return;
      setTestResult({ tone: 'error', message: e instanceof Error ? e.message : t`Connection failed.` });
    } finally {
      setTesting(false);
    }
  }

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      const result = await setupApi.complete({
        providerName: providerName.trim(),
        providerEndpoint: providerEndpoint.trim(),
        providerUpstreamApiKey: providerApiKey.trim(),
        providerKind,
        modelName: modelName.trim(),
        projectName: projectName.trim(),
      });
      try { localStorage.setItem('proxytrace:current-project-id', result.projectId); } catch { /* ignore */ }
      qc.setQueryData(QUERY_KEYS.setupStatus, { isConfigured: true });
      window.location.assign('/traces');
    } catch (e) {
      setError(e instanceof Error ? e.message : t`An unexpected error occurred.`);
      setLoading(false);
    }
  }

  const canAdvance = (stepValid[currentStep] ?? false) && !loading;

  function handleEnter(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (!canAdvance) return;
    if (currentStep === LAST_STEP) { void handleSubmit(); } else handleNext();
  }

  return {
    currentStep,
    loading,
    error,
    presetId,
    providerName,
    providerEndpoint,
    providerApiKey,
    providerKind,
    testing,
    testResult,
    modelName,
    projectName,
    providerFilled,
    canAdvance,
    stepValid,
    // model loader
    models: modelLoader.models,
    modelsLoading: modelLoader.modelsLoading,
    modelsError: modelLoader.modelsError,
    loadModels: modelLoader.loadModels,
    setModels: modelLoader.setModels,
    resetModels: modelLoader.reset,
    // setters
    setProviderName,
    setProviderEndpoint,
    setProviderApiKey,
    setModelName,
    setProjectName,
    clearTestResult,
    // handlers
    handleNext,
    handleBack,
    handleSubmit,
    handlePresetChange,
    handleTestConnection,
    handleEnter,
  };
}
