import { z } from 'zod';
import { providersApi } from '../../../api/providers';
import { type ToolFactory, tool, ignore404, presentArg } from './shared';

export const createProviderTools: ToolFactory = (_ctx, store) => ({
  get_provider: tool({
    description:
      'Get a single model provider by id. Returns a curated summary (name, kind) plus a ' +
      'reference; the full provider is rendered to the user as a card.',
    parameters: z.object({ present: presentArg, providerId: z.string().describe('The id of the provider to fetch.') }),
    confirm: false,
    execute: async ({ providerId }) => {
      const provider = await ignore404(() => providersApi.get(providerId, { silentStatuses: [404] }));
      if (!provider) return { notFound: providerId };
      return store('provider', provider, { id: provider.id, name: provider.name, kind: provider.kind });
    },
  }),
});
