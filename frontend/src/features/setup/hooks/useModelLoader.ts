import { useCallback, useState } from 'react';
import { setupApi } from '../../../api/setup';
import type { ModelProviderKind } from '../../../api/models';

interface ModelLoaderParams {
  providerName: string;
  providerEndpoint: string;
  providerApiKey: string;
  providerKind: ModelProviderKind;
  providerFilled: boolean;
}

/**
 * Discovers the provider's models for the setup wizard. Discovery runs
 * automatically when the model step is entered; `loadModels(true)` forces a
 * re-fetch (the Refresh affordance).
 */
export function useModelLoader(params: ModelLoaderParams, onFirstModel: (model: string) => void) {
  const [models, setModels] = useState<string[] | null>(null);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);

  const { providerName, providerEndpoint, providerApiKey, providerKind, providerFilled } = params;

  const loadModels = useCallback(async (force = false) => {
    if (!providerFilled || modelsLoading) return;
    if (models !== null && !force) return;
    setModelsLoading(true);
    setModelsError(null);
    try {
      const res = await setupApi.listModels({
        providerName: providerName.trim(),
        providerEndpoint: providerEndpoint.trim(),
        providerUpstreamApiKey: providerApiKey.trim(),
        providerKind,
      });
      setModels(res.models);
      if (res.models.length > 0) {
        onFirstModel(res.models[0]);
      }
    } catch (e) {
      setModels([]);
      setModelsError(e instanceof Error ? e.message : 'Failed to load models.');
    } finally {
      setModelsLoading(false);
    }
  }, [models, modelsLoading, providerFilled, providerName, providerEndpoint, providerApiKey, providerKind, onFirstModel]);

  function reset() {
    setModels(null);
    setModelsError(null);
  }

  return { models, modelsLoading, modelsError, loadModels, setModels, reset };
}
